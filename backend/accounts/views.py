import datetime

from django.conf import settings
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer
)
from .models import User, PasswordResetCode
from .sms import sms
from .throttles import LoginThrottle, PasswordResetThrottle, OTPVerifyThrottle, RegisterThrottle
from appointments.models import Appointment
from tracking.models import SymptomReport
from emergency.models import EmergencyLog
from medication.models import MedicationReminder
from clinical.models import ANCVisit


def _set_refresh_cookie(response, refresh_token_str):
    response.set_cookie(
        key=settings.AUTH_COOKIE,
        value=refresh_token_str,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path='/',
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(settings.AUTH_COOKIE, path='/')


class CookieTokenRefreshView(TokenRefreshView):
    """Reads the refresh token from the httpOnly cookie instead of the body."""

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.AUTH_COOKIE)
        if not refresh_token:
            return Response({'error': 'Refresh token cookie missing.'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = self.get_serializer(data={'refresh': refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])
        except IntegrityError:
            # Two concurrent refresh calls (e.g. a duplicate request from the
            # client, or two open tabs) can both try to blacklist the same
            # outstanding token; the loser hits a unique-constraint violation
            # rather than a clean TokenError. Treat it the same as an invalid
            # token instead of surfacing a raw 500.
            return Response({'error': 'Refresh token already used.'}, status=status.HTTP_401_UNAUTHORIZED)

        validated = dict(serializer.validated_data)
        rotated_refresh = validated.pop('refresh', None)
        response = Response(validated, status=status.HTTP_200_OK)
        if rotated_refresh:
            _set_refresh_cookie(response, rotated_refresh)
        return response


def _send_password_reset_sms(phone_number, code):
    formatted_phone = f"+255{phone_number.lstrip('0')}"
    message = f"Your Mimba Yangu password reset code is: {code}"
    try:
        response = sms.send(message, [formatted_phone])
        print(f"Password reset SMS sent successfully to {formatted_phone}: {response}")
    except Exception as e:
        print(f"Password reset SMS failed to {formatted_phone}: {e}")


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def request_password_reset(request):
    """Step 1 — send a reset code by SMS if the phone number is registered.

    Always returns the same generic response regardless of whether the
    phone number matches an account, so this endpoint can't be used to
    enumerate registered phone numbers.
    """
    phone_number = request.data.get('phone_number')
    generic_response = Response(
        {'message': 'If this number is registered, a code has been sent.'},
        status=status.HTTP_200_OK,
    )
    if not phone_number:
        return generic_response

    try:
        user = User.objects.get(phone_number=phone_number)
    except User.DoesNotExist:
        return generic_response

    reset_code = PasswordResetCode.generate_for_user(user)
    _send_password_reset_sms(phone_number, reset_code.code)
    return generic_response


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([OTPVerifyThrottle])
def confirm_password_reset(request):
    """Step 2 — verify the code and set the new password.

    Wrong code, expired code, and already-used code all return the same
    generic error so a caller can't tell which one it was.
    """
    phone_number = request.data.get('phone_number')
    code = request.data.get('code')
    new_password = request.data.get('new_password')
    invalid_code_response = Response(
        {'error': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST,
    )

    if not phone_number or not code or not new_password:
        return Response(
            {'error': 'phone_number, code, and new_password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(new_password) < 6:
        return Response(
            {'error': 'Password must be at least 6 characters.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(phone_number=phone_number)
    except User.DoesNotExist:
        return invalid_code_response

    reset_code = (
        PasswordResetCode.objects
        .filter(user=user, code=code, is_used=False)
        .order_by('-created_at')
        .first()
    )
    if not reset_code or reset_code.is_expired():
        return invalid_code_response

    user.set_password(new_password)
    user.save()
    reset_code.is_used = True
    reset_code.save(update_fields=['is_used'])
    return Response({'message': 'Password reset successful.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        tokens = RefreshToken.for_user(user)
        response = Response({
            'message': 'Account created successfully.',
            'user': UserSerializer(user).data,
            'access': str(tokens.access_token),
        }, status=status.HTTP_201_CREATED)
        _set_refresh_cookie(response, str(tokens))
        return response
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        response_data = serializer.validated_data.copy()
        refresh_token = response_data.pop('refresh')

        try:
            db_user = User.objects.get(phone_number=request.data['phone_number'])
            response_data['redirect_to'] = db_user.user_type
        except User.DoesNotExist:
            pass

        response = Response(response_data, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, refresh_token)
        return response
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Blacklist the refresh token so it cannot be reused after logout."""
    refresh_token = request.COOKIES.get(settings.AUTH_COOKIE)
    if refresh_token:
        try:
            RefreshToken(refresh_token).blacklist()
        except TokenError:
            pass  # Already invalid — still proceed with logout
    response = Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
    _clear_refresh_cookie(response)
    return response


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
    requested_appts_count = Appointment.objects.filter(
        provider=request.user,
        status='requested'
    ).count()

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
            'requested_count': requested_appts_count,
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
