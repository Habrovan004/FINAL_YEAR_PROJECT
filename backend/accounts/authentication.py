from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication as BaseJWTAuthentication

# How often we actually write to the DB — every authenticated request would
# be wasteful; this is just a "recently active" signal, not an audit log.
LAST_ACTIVE_UPDATE_INTERVAL = timezone.timedelta(minutes=5)


class JWTAuthentication(BaseJWTAuthentication):
    """Same as simplejwt's JWTAuthentication, but also stamps
    `User.last_active_at` — the only place in the codebase that tracks
    whether a user has recently opened the app."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _token = result
            now = timezone.now()
            if user.last_active_at is None or now - user.last_active_at > LAST_ACTIVE_UPDATE_INTERVAL:
                type(user).objects.filter(pk=user.pk).update(last_active_at=now)
                user.last_active_at = now
        return result
