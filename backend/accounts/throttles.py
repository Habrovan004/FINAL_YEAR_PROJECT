from django.conf import settings
from rest_framework.throttling import AnonRateThrottle


class ConfigurableWindowThrottle(AnonRateThrottle):
    """Per-IP throttle whose (count, window_seconds) come from
    settings.AUTH_THROTTLE_RATES, keyed by `scope`.

    DRF's built-in rate strings (e.g. '5/min') only support fixed
    second/minute/hour/day windows, which can't express something like
    "5 requests per 10 minutes" — so this reads the window directly instead
    of going through DRF's rate-string parsing.
    """
    scope = None

    def __init__(self):
        self.num_requests, self.duration = settings.AUTH_THROTTLE_RATES[self.scope]
        # allow_request() only checks `rate is None` to decide whether
        # throttling is active at all — the value itself is never parsed.
        self.rate = (self.num_requests, self.duration)


class OTPVerifyThrottle(AnonRateThrottle):
    """Prevents brute-forcing the 6-digit password-reset code (900k combinations)."""
    scope = 'otp_verify'
    rate = '10/min'


class LoginThrottle(ConfigurableWindowThrottle):
    """Blunts credential-stuffing / brute-force login attempts from one IP."""
    scope = 'login'


class PasswordResetThrottle(ConfigurableWindowThrottle):
    """Blunts SMS-bombing via repeated password-reset code requests."""
    scope = 'password_reset'


class RegisterThrottle(AnonRateThrottle):
    """Prevents bulk account creation / SMS-gateway flooding from one IP."""
    scope = 'register'
    rate = '5/hour'

