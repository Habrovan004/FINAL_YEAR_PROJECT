from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Appointment
from .serializers import AppointmentSerializer
from datetime import date
from django.db import IntegrityError

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def appointment_list(request):
    """
    POST: Book an appointment. Verifies provider availability.
    GET: Fetch user appointments.
    """
    if request.method == 'POST':
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

                if Appointment.objects.filter(provider=assigned_provider, appointment_date=date_val, appointment_time=time_val).exists():
                    return Response({'error': 'This time slot is already booked for your provider. Please choose another.'}, status=status.HTTP_409_CONFLICT)

                serializer.save(user=request.user, provider=assigned_provider)
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
        appointments = appointments.filter(appointment_date__gte=date.today(), status='upcoming')
    elif filter_type == 'history':
        appointments = appointments.exclude(status='upcoming')

    serializer = AppointmentSerializer(appointments, many=True)
    return Response(serializer.data)

@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def appointment_detail(request, pk):
    try:
        # Check permission: Only owner or assigned provider can access
        appointment = Appointment.objects.get(pk=pk)
        if appointment.user != request.user and appointment.provider != request.user:
             return Response({'error': 'Unauthorized'}, status=403)
    except Appointment.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    if request.method == 'PATCH':
        # Module 4: Provider updates status as attended or missed
        if request.user.user_type == 'provider' and 'status' in request.data:
            new_status = request.data.get('status')
            if new_status == 'missed':
                # Flag for follow-up logic could go here
                print(f"Appointment {pk} missed. Flagging for follow-up.")

        serializer = AppointmentSerializer(appointment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if request.method == 'DELETE':
        appointment.delete()
        return Response(status=204)
