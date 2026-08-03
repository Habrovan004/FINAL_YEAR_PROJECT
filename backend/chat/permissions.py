"""
Object-level permission enforcing that only the two parties on a ChatRoom
(the mother and her assigned provider) may access it.

``get_room_or_404`` is the call site views should use: it raises
``Http404`` on denial (never DRF's default 403), so an authenticated user
can't distinguish "this room doesn't exist" from "this room isn't yours" —
consistent with the same pattern in ``patients.permissions``.
"""
from django.http import Http404
from rest_framework.permissions import BasePermission


class IsRoomParticipant(BasePermission):
    message = 'Conversation not found.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, room):
        # The mother side is a stable relationship — she's always the
        # patient party on any room whose patient_id is her.
        if request.user.id == room.patient_id:
            return True
        # The provider side is *not* stable: reassignment can move a mother
        # to a new provider, and we don't want the old provider to keep
        # reading her history through this room. Check the mother's
        # current Assignment rather than the FK on the room, so an old
        # provider gets a 404 on their very next request.
        if getattr(request.user, 'user_type', None) != 'provider':
            return False
        provider_profile = getattr(request.user, 'provider_profile', None)
        if not provider_profile:
            return False
        patient_profile = getattr(room.patient, 'profile', None)
        if not patient_profile:
            return False
        current = patient_profile.current_provider
        return current is not None and current.pk == provider_profile.pk


def get_room_or_404(request, room_id):
    from .models import ChatRoom

    try:
        room = ChatRoom.objects.get(pk=room_id)
    except ChatRoom.DoesNotExist:
        raise Http404('Conversation not found.')

    if not IsRoomParticipant().has_object_permission(request, None, room):
        raise Http404('Conversation not found.')

    return room
