"""
Object-level access control for "does this provider own this mother"
checks, used by any view keyed on a patient/mother ID (ANC visits, visit
summaries, patient profiles, chat conversations).

``get_patient_or_404`` is the one call site views should use: it always
raises ``Http404`` rather than returning a 403 when the provider isn't the
mother's assigned provider, so a provider probing patient IDs that belong to
another provider can't even confirm the patient exists.
"""
from django.http import Http404
from rest_framework.permissions import BasePermission


class IsAssignedProvider(BasePermission):
    """Object-level permission: request.user (a provider) is the assigned
    provider for the mother `obj` resolves to.

    `obj` may be a patient User (with a `.profile` reverse relation) or a
    PatientProfile itself.
    """
    message = 'This patient is not assigned to you.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.user_type == 'provider'
        )

    def has_object_permission(self, request, view, obj):
        profile = self._resolve_profile(obj)
        if profile is None:
            return False
        provider_profile = getattr(request.user, 'provider_profile', None)
        return bool(provider_profile) and profile.assigned_provider_id == provider_profile.id

    @staticmethod
    def _resolve_profile(obj):
        if hasattr(obj, 'assigned_provider_id'):
            return obj  # already a PatientProfile
        return getattr(obj, 'profile', None)  # a patient User


def get_patient_or_404(request, patient_id):
    """Fetch the patient `request.user` (a provider) is asking about, or
    raise Http404 — for both "no such patient" and "not assigned to you".
    Never distinguishes the two in the response, so patient IDs belonging
    to other providers' mothers can't be enumerated.
    """
    from accounts.models import User  # local import avoids a circular import at module load

    try:
        patient = User.objects.get(pk=patient_id, user_type='patient')
    except User.DoesNotExist:
        raise Http404('Patient not found.')

    if not IsAssignedProvider().has_object_permission(request, None, patient):
        raise Http404('Patient not found.')

    return patient
