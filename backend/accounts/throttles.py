from rest_framework.throttling import AnonRateThrottle


class OTPRequestThrottle(AnonRateThrottle):
    scope = 'otp_request'
    rate = '5/min'


class PasswordResetThrottle(AnonRateThrottle):
    scope = 'password_reset'
    rate = '3/min'

