import uuid
import datetime

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer, PartnerLinkSerializer
)
from .models import User, PartnerLink
from .throttles import PasswordResetThrottle, RegisterThrottle
from appointments.models import Appointment
from tracking.models import SymptomReport
from emergency.models import EmergencyLog
from medication.models import MedicationReminder
from clinical.models import ANCVisit


def generate_invitation_code():
    """Generate a unique 8-character uppercase invitation code."""
    while True:
        code = uuid.uuid4().hex[:8].upper()
        if not PartnerLink.objects.filter(invitation_code=code).exists():
            return code


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def reset_password(request):
    """Reset password by phone number — no OTP required."""
    phone_number = request.data.get('phone_number')
    new_password = request.data.get('new_password')

    if not phone_number or not new_password:
        return Response(
            {'error': 'phone_number and new_password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(new_password) < 6:
        return Response(
            {'error': 'Password must be at least 6 characters.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(phone_number=phone_number)
        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password reset successful.'}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        tokens = RefreshToken.for_user(user)
        return Response({
            'message': 'Account created successfully.',
            'user': UserSerializer(user).data,
            'access': str(tokens.access_token),
            'refresh': str(tokens),
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        response_data = serializer.validated_data.copy()
        
        try:
            db_user = User.objects.get(phone_number=request.data['phone_number'])
            response_data['redirect_to'] = db_user.user_type
        except User.DoesNotExist:
            pass

        return Response(response_data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Blacklist the refresh token so it cannot be reused after logout."""
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response({'error': 'Refresh token required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        RefreshToken(refresh_token).blacklist()
    except TokenError:
        pass  # Already invalid — still proceed with logout
    return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    _ = request.user
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def provider_dashboard(request):
    if request.user.user_type != 'provider':
        return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

    provider_profile = getattr(request.user, 'provider_profile', None)
    if not provider_profile:
        return Response({'error': 'Provider profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    today_date = datetime.date.today()
    patients = User.objects.filter(profile__assigned_provider=provider_profile)

    upcoming_appts = Appointment.objects.filter(
        provider=request.user,
        appointment_date__gte=today_date,
        status='upcoming'
    )
    missed_appts = Appointment.objects.filter(
        provider=request.user,
        status='missed'
    )

    symptom_alerts = SymptomReport.objects.filter(
        patient__profile__assigned_provider=provider_profile,
        risk_level='high',
        is_reviewed=False
    )

    sos_alerts = EmergencyLog.objects.filter(
        provider_notified=request.user,
        action='sos_trigger'
    ).order_by('-triggered_at')[:10]

    # Recent high-risk ANC visits (last 30 days) for this provider's patients
    cutoff = timezone.now() - datetime.timedelta(days=30)
    anc_high_risk = ANCVisit.objects.filter(
        patient__profile__assigned_provider=provider_profile,
        risk_level='high',
        visit_date__gte=cutoff,
    ).order_by('-visit_date')[:20]

    all_past_appts = Appointment.objects.filter(
        provider=request.user,
        appointment_date__lt=today_date
    )
    total_past = all_past_appts.count()
    attended_count = all_past_appts.filter(status='attended').count()
    attendance_rate = (attended_count / total_past * 100) if total_past > 0 else None

    all_reminders = MedicationReminder.objects.filter(
        prescription__patient__profile__assigned_provider=provider_profile
    )
    total_reminders = all_reminders.count()
    acknowledged_count = all_reminders.filter(is_acknowledged=True).count()
    adherence_rate = (acknowledged_count / total_reminders * 100) if total_reminders > 0 else 0

    return Response({
        'provider_name': request.user.full_name,
        'hospital': provider_profile.hospital.name,
        'stats': {
            'total_patients': patients.count(),
            'attendance_rate': round(attendance_rate, 1) if attendance_rate is not None else None,
            'attendance_total': total_past,
            'attendance_attended': attended_count,
            'adherence_rate': round(adherence_rate, 1),
            'pending_alerts': symptom_alerts.count() + sos_alerts.count() + anc_high_risk.count(),
        },
        'appointments': {
            'upcoming_count': upcoming_appts.count(),
            'missed_count': missed_appts.count(),
            'today': [{
                'id': a.id,
                'patient': a.user.full_name,
                'time': str(a.appointment_time),
                'type': a.get_visit_type_display()
            } for a in upcoming_appts.filter(appointment_date=today_date)]
        },
        'critical_alerts': (
            [{
                'id': s.id,
                'type': 'symptom',
                'patient': s.patient.full_name,
                'risk': s.risk_level,
                'time': s.created_at,
            } for s in symptom_alerts]
            + [{
                'id': e.id,
                'type': 'sos',
                'patient': e.user.full_name,
                'location': f"{e.latitude}, {e.longitude}",
                'time': e.triggered_at,
            } for e in sos_alerts]
            + [{
                'id': v.id,
                'type': 'anc_visit',
                'patient': v.patient.full_name,
                'risk': v.risk_level,
                'reasons': v.risk_reasons,
                'time': v.visit_date,
            } for v in anc_high_risk]
        ),
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def partner_link(request):
    if request.method == 'POST':
        partner_phone = request.data.get('partner_phone')
        if not partner_phone:
            return Response({'error': 'Partner phone is required.'}, status=status.HTTP_400_BAD_REQUEST)

        link, created = PartnerLink.objects.update_or_create(
            patient=request.user,
            defaults={
                'partner_phone': partner_phone,
                'invitation_code': generate_invitation_code(),
                'is_confirmed': False
            }
        )
        return Response(PartnerLinkSerializer(link).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    try:
        link = PartnerLink.objects.get(patient=request.user)
        return Response(PartnerLinkSerializer(link).data)
    except PartnerLink.DoesNotExist:
        return Response({'message': 'No partner linked.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_invitation(request):
    code = request.data.get('code')
    if not code:
        return Response({'error': 'Invitation code is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        link = PartnerLink.objects.get(invitation_code=code, is_confirmed=False)
        link.partner = request.user
        link.is_confirmed = True
        link.save()
        return Response({'message': f'Linked successfully to {link.patient.full_name}.'})
    except PartnerLink.DoesNotExist:
        return Response({'error': 'Invalid or already used invitation code.'}, status=status.HTTP_404_NOT_FOUND)
