import uuid
import datetime

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    VerifyOTPSerializer, PartnerLinkSerializer
)
from .models import User, OTPCode, PartnerLink
from .throttles import OTPRequestThrottle, PasswordResetThrottle
from appointments.models import Appointment
from tracking.models import SymptomReport
from emergency.models import EmergencyLog
from medication.models import MedicationReminder
from .sms import send_otp_sms
from .email_otp import send_otp_email


def _deliver_otp(user, code, channel: str, purpose: str = 'verification') -> str:
    """Send the OTP via 'sms' or 'email'. Returns the channel actually used.

    Falls back to the alternate channel if the requested one fails or is unavailable.
    """
    requested = (channel or 'sms').lower()

    def try_email():
        if not user.email:
            return False
        try:
            send_otp_email(user.email, code, purpose=purpose)
            return True
        except Exception as e:
            print(f"[OTP] Email delivery failed for {user.email}: {e}")
            return False

    def try_sms():
        try:
            send_otp_sms(user.phone_number, code)
            return True
        except Exception as e:
            print(f"[OTP] SMS delivery failed for {user.phone_number}: {e}")
            return False

    if requested == 'email':
        if try_email():
            return 'email'
        return 'sms' if try_sms() else 'none'

    if try_sms():
        return 'sms'
    return 'email' if try_email() else 'none'


def generate_invitation_code():
    """Generate a unique 8-character uppercase invitation code."""
    while True:
        code = uuid.uuid4().hex[:8].upper()
        if not PartnerLink.objects.filter(invitation_code=code).exists():
            return code


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([OTPRequestThrottle])
def send_otp(request):
    """Resend OTP code via SMS or email.

    Body: { phone_number, channel: 'sms' | 'email' (default 'sms') }
    """
    phone_number = request.data.get('phone_number')
    channel = (request.data.get('channel') or 'sms').lower()
    if not phone_number:
        return Response({'error': 'Phone number is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(phone_number=phone_number)
        if channel == 'email' and not user.email:
            return Response({'error': 'No email address on file for this account.'}, status=status.HTTP_400_BAD_REQUEST)

        otp = OTPCode.generate_for_user(user)
        used_channel = _deliver_otp(user, otp.code, channel)

        # Always print the code in the dev terminal
        print(f"\n******************************************")
        print(f"VERIFICATION CODE FOR {user.phone_number}: {otp.code}  (via {used_channel})")
        print(f"******************************************\n")

        response_data = {
            'message': f'OTP code sent via {used_channel}.',
            'channel': used_channel,
        }
        if settings.DEBUG:
            response_data['dev_otp'] = otp.code

        return Response(response_data, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"OTP send failed: {e}")
        return Response({'error': 'Could not send OTP.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def request_password_reset(request):
    """Generate and send a password reset OTP via SMS or email.

    Body: { phone_number, channel: 'sms' | 'email' (default 'sms') }
    """
    phone_number = request.data.get('phone_number')
    channel = (request.data.get('channel') or 'sms').lower()
    if not phone_number:
        return Response({'error': 'Phone number is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(phone_number=phone_number)
        if channel == 'email' and not user.email:
            return Response({'error': 'No email address on file for this account.'}, status=status.HTTP_400_BAD_REQUEST)

        otp = OTPCode.generate_for_user(user)
        used_channel = _deliver_otp(user, otp.code, channel, purpose='password_reset')

        response_data = {
            'message': f'Password reset code sent via {used_channel}.',
            'channel': used_channel,
        }
        if settings.DEBUG:
            response_data['dev_otp'] = otp.code
        return Response(response_data, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def confirm_password_reset(request):
    """Confirm OTP and set a new password for the user."""
    phone_number = request.data.get('phone_number')
    code = request.data.get('code')
    new_password = request.data.get('new_password')

    if not all([phone_number, code, new_password]):
        return Response({'error': 'phone_number, code and new_password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(phone_number=phone_number)
        otp = OTPCode.objects.filter(user=user, code=code, is_used=False).last()

        if otp and not otp.is_expired():
            otp.is_used = True
            otp.save()
            user.set_password(new_password)
            user.save()
            return Response({'message': 'Password reset successful.'}, status=status.HTTP_200_OK)
        return Response({'error': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        otp = OTPCode.generate_for_user(user)

        # Honour preferred channel if provided; default to SMS but fall back to email
        channel = (request.data.get('verification_channel') or 'sms').lower()
        used_channel = _deliver_otp(user, otp.code, channel)

        response_data = {
            'message': f'Account created. Verification code sent via {used_channel}.',
            'user': UserSerializer(user).data,
            'channel': used_channel,
        }

        print(f"\n******************************************")
        print(f"VERIFICATION CODE FOR {user.phone_number}: {otp.code}  (via {used_channel})")
        print(f"******************************************\n")

        if settings.DEBUG:
            response_data['dev_otp'] = otp.code

        return Response(response_data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    serializer = VerifyOTPSerializer(data=request.data)
    if serializer.is_valid():
        phone_number = serializer.validated_data['phone_number']
        code = serializer.validated_data['code']
        try:
            user = User.objects.get(phone_number=phone_number)
            otp = OTPCode.objects.filter(user=user, code=code, is_used=False).last()

            if otp and not otp.is_expired():
                otp.is_used = True
                otp.save()
                user.is_verified = True
                user.save()

                tokens = RefreshToken.for_user(user)
                return Response({
                    'message': 'Verified successfully.',
                    'access': str(tokens.access_token),
                    'refresh': str(tokens),
                    'user': UserSerializer(user).data,
                    'redirect_to': user.user_type
                }, status=status.HTTP_200_OK)
            else:
                return Response({'error': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)

        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

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

    all_past_appts = Appointment.objects.filter(
        provider=request.user,
        appointment_date__lt=today_date
    )
    total_past = all_past_appts.count()
    attended_count = all_past_appts.filter(status='attended').count()
    attendance_rate = (attended_count / total_past * 100) if total_past > 0 else 100

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
            'attendance_rate': round(attendance_rate, 1),
            'adherence_rate': round(adherence_rate, 1),
            'pending_alerts': symptom_alerts.count() + sos_alerts.count()
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
        'critical_alerts': list([{
            'id': s.id,
            'type': 'symptom',
            'patient': s.patient.full_name,
            'risk': s.risk_level,
            'time': s.created_at
        } for s in symptom_alerts]) + list([{
            'id': e.id,
            'type': 'sos',
            'patient': e.user.full_name,
            'location': f"{e.latitude}, {e.longitude}",
            'time': e.triggered_at
        } for e in sos_alerts])
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
