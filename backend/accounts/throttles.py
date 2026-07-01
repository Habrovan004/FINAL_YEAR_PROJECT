from rest_framework.throttling import AnonRateThrottle


class OTPRequestThrottle(AnonRateThrottle):
    scope = 'otp_request'
    rate = '5/min'


class OTPVerifyThrottle(AnonRateThrottle):
    """Prevents brute-forcing the 6-digit OTP (900k combinations)."""
    scope = 'otp_verify'
    rate = '10/min'


class PasswordResetThrottle(AnonRateThrottle):
    scope = 'password_reset'
    rate = '3/min'


class RegisterThrottle(AnonRateThrottle):
    """Prevents bulk account creation / SMS-gateway flooding from one IP."""
    scope = 'register'
    rate = '5/hour'

