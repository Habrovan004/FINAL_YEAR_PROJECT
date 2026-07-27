from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Appointment
from .serializers import AppointmentSerializer
from patients.models import PatientProfile
from notifications.models import Notification
from maintenance.models import AuditLog
from datetime import date
from django.db import IntegrityError
from django.db.models import Q

# An active row (requested or upcoming) reserves its slot; cancelled/missed/
# attended rows don't (mirrors the partial DB constraint on Appointment).
ACTIVE_STATUSES = ['requested', 'upcoming']

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def appointment_list(request):
    """
    POST: Book an appointment. Verifies provider availability.
      - Patient caller: books with their own assigned provider.
      - Provider caller: books directly for one of their own patients
        (payload must include `patient_id`).
    GET: Fetch user appointments.
    """
    if request.method == 'POST':
        if request.user.user_type == 'provider':
            provider_profile = getattr(request.user, 'provider_profile', None)
            if not provider_profile:
                return Response({'error': 'Provider profile not found.'}, status=status.HTTP_404_NOT_FOUND)

            patient_id = request.data.get('patient_id')
            if not patient_id:
                return Response({'error': 'patient_id is required.'}, status=400)

            patient_profile = PatientProfile.objects.filter(
                user_id=patient_id, assigned_provider=provider_profile
            ).select_related('user').first()
            if not patient_profile:
                return Response({'error': 'This patient is not assigned to you.'}, status=status.HTTP_403_FORBIDDEN)

            data = request.data.copy()
            data['provider'] = request.user.id
            data['hospital'] = provider_profile.hospital_id

            serializer = AppointmentSerializer(data=data)
            if serializer.is_valid():
                try:
                    date_val = serializer.validated_data['appointment_date']
                    time_val = serializer.validated_data['appointment_time']

                    if Appointment.objects.filter(
                        provider=request.user, appointment_date=date_val, appointment_time=time_val,
                        status__in=ACTIVE_STATUSES,
                    ).exists():
                        return Response({'error': 'You already have an appointment booked at this time.'}, status=status.HTTP_409_CONFLICT)

                    # Provider is the one setting it, so it's confirmed immediately.
                    serializer.save(user=patient_profile.user, provider=request.user, status='upcoming')
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                except IntegrityError:
                    return Response({'error': 'Double booking error. Please select another time.'}, status=400)

            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Get patient's assigned provider automatically
        assigned_provider = None
        if hasattr(request.user, 'profile') and request.user.profile.assigned_provider:
            assigned_provider = request.user.profile.assigned_provider.user

        if not assigned_provider:
            return Response({'error': 'You must be assigned a healthcare provider to book an appointment.'}, status=400)

        data = request.data.copy()
        data['provider'] = assigned_provider.id
        data['hospital'] = request.user.profile.hospital.id if request.user.profile.hospital else None

        serializer = AppointmentSerializer(data=data)
        if serializer.is_valid():
            try:
                # Check for double booking
                date_val = serializer.validated_data['appointment_date']
                time_val = serializer.validated_data['appointment_time']

                if Appointment.objects.filter(
                    provider=assigned_provider, appointment_date=date_val, appointment_time=time_val,
                    status__in=ACTIVE_STATUSES,
                ).exists():
                    return Response({'error': 'This time slot is already booked for your provider. Please choose another.'}, status=status.HTTP_409_CONFLICT)

                # A patient's own booking is a *request* — the provider must confirm it.
                appt = serializer.save(user=request.user, provider=assigned_provider, status='requested')
                Notification.objects.create(
                    recipient=assigned_provider,
                    verb='appointment_requested',
                    message=f'{request.user.full_name} requested an appointment on {appt.appointment_date} at {appt.appointment_time}.',
                    link='/provider/dashboard',
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except IntegrityError:
                return Response({'error': 'Double booking error. Please select another time.'}, status=400)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Filtering logic
    filter_type = request.query_params.get('filter', 'all')
    appointments = Appointment.objects.filter(user=request.user)

    if request.user.user_type == 'provider':
        appointments = Appointment.objects.filter(provider=request.user)

    if filter_type == 'upcoming':
        # Includes the caller's own pending requests alongside confirmed
        # appointments, so a mother sees a request she made before it's
        # confirmed, and a provider can see both from a single "upcoming"
        # style call if needed.
        appointments = appointments.filter(appointment_date__gte=date.today(), status__in=ACTIVE_STATUSES)
    elif filter_type == 'requested':
        appointments = appointments.filter(status='requested')
    elif filter_type == 'history':
        appointments = appointments.exclude(status__in=ACTIVE_STATUSES)

    serializer = AppointmentSerializer(appointments, many=True)
    return Response(serializer.data)

@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def appointment_detail(request, pk):
    # Scoped in the query itself and 404 (not 403) on a mismatch, so an
    # authenticated user can't confirm a foreign appointment ID exists.
    try:
        appointment = Appointment.objects.get(
            Q(pk=pk) & (Q(user=request.user) | Q(provider=request.user))
        )
    except Appointment.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    if request.method == 'PATCH':
        is_provider = request.user.id == appointment.provider_id
        current_status = appointment.status
        new_status = request.data.get('status')
        date_or_time_changed = 'appointment_date' in request.data or 'appointment_time' in request.data

        if new_status is None:
            # No status change — the only field-only update allowed is a
            # provider proposing a new date/time on a still-pending request.
            if not (is_provider and current_status == 'requested' and date_or_time_changed):
                return Response({'error': 'This update is not allowed.'}, status=403)
        elif not is_provider:
            # Patient: withdraw a pending request or cancel a confirmed booking.
            if not (current_status in ('requested', 'upcoming') and new_status == 'cancelled'):
                return Response({'error': 'This status change is not allowed.'}, status=403)
        else:
            # Provider: confirm/decline a request, or record the outcome of a
            # confirmed appointment.
            allowed = (
                (current_status == 'requested' and new_status in ('upcoming', 'cancelled'))
                or (current_status == 'upcoming' and new_status in ('attended', 'missed', 'cancelled'))
            )
            if not allowed:
                return Response({'error': 'This status change is not allowed.'}, status=403)

        # Confirming a request: the slot may have been taken by another
        # confirmed booking while this one was still pending.
        if new_status == 'upcoming' and current_status == 'requested':
            collision = Appointment.objects.filter(
                provider_id=appointment.provider_id,
                appointment_date=appointment.appointment_date,
                appointment_time=appointment.appointment_time,
                status='upcoming',
            ).exclude(pk=appointment.pk).exists()
            if collision:
                return Response(
                    {'error': 'This slot was already confirmed for another appointment.'},
                    status=status.HTTP_409_CONFLICT,
                )

        serializer = AppointmentSerializer(appointment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()

            if new_status == 'upcoming' and current_status == 'requested':
                Notification.objects.create(
                    recipient=appointment.user, verb='appointment_confirmed',
                    message=f'Your appointment on {appointment.appointment_date} at {appointment.appointment_time} has been confirmed.',
                    link='/appointments',
                )
            elif new_status == 'cancelled' and current_status == 'requested' and is_provider:
                Notification.objects.create(
                    recipient=appointment.user, verb='appointment_declined',
                    message=f'Your appointment request for {appointment.appointment_date} was declined.',
                    link='/appointments',
                )
            elif new_status is None and date_or_time_changed:
                Notification.objects.create(
                    recipient=appointment.user, verb='appointment_time_proposed',
                    message=f'Your provider proposed a new time: {appointment.appointment_date} at {appointment.appointment_time}. Please confirm or decline.',
                    link='/appointments',
                )
            elif new_status == 'cancelled':
                other_party = appointment.user if is_provider else appointment.provider
                if other_party:
                    Notification.objects.create(
                        recipient=other_party, verb='appointment_cancelled',
                        message=f'The appointment on {appointment.appointment_date} was cancelled by {"the provider" if is_provider else "the patient"}.',
                        link='/appointments' if is_provider else '/provider/dashboard',
                    )

            if new_status == 'cancelled':
                AuditLog.objects.create(
                    user=request.user,
                    event_type='data_change',
                    description=f"Appointment #{appointment.id} cancelled by {request.user.user_type} {request.user.full_name}",
                )

            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if request.method == 'DELETE':
        appointment.delete()
        return Response(status=204)
