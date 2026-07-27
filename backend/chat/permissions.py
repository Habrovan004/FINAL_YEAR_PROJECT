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
        return request.user.id in (room.patient_id, room.provider_id)


def get_room_or_404(request, room_id):
    from .models import ChatRoom

    try:
        room = ChatRoom.objects.get(pk=room_id)
    except ChatRoom.DoesNotExist:
        raise Http404('Conversation not found.')

    if not IsRoomParticipant().has_object_permission(request, None, room):
        raise Http404('Conversation not found.')

    return room
