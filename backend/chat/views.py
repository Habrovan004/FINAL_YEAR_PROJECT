"""
Provider ↔ patient direct messaging.

This complements the chatbot app, which handles AI-mediated conversation that
auto-escalates to a provider. The chat app is for the *proactive* case: a
provider wants to message a patient (or vice-versa) without going through the
AI gateway — e.g. a follow-up after an ANC visit, lab-result review, or
medication-adherence check-in.

Access rules:
  - A provider may create a room only for a patient assigned to them.
  - A patient may view/post in any room where they are the `patient`.
  - Either party may mark received messages as read.
"""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from .models import ChatRoom, Message
from .serializers import ChatRoomSerializer, MessageSerializer


def _room_for_user(user, room_id):
    """Return the room iff `user` is the patient or provider on it. Else None."""
    room = ChatRoom.objects.filter(pk=room_id).first()
    if room is None:
        return None
    if user.id not in (room.patient_id, room.provider_id):
        return None
    return room


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def rooms(request):
    """
    GET  /api/chat/rooms/        — list the caller's active rooms (newest first)
    POST /api/chat/rooms/        — provider creates (or gets) a room with a patient
                                   body: { "patient_id": <int> }
    """
    user = request.user

    if request.method == 'POST':
        if user.user_type != 'provider':
            return Response(
                {'error': 'Only providers can initiate a chat room.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        patient_id = request.data.get('patient_id')
        if not patient_id:
            return Response({'error': 'patient_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        patient = get_object_or_404(User, pk=patient_id, user_type='patient')

        # A provider can only chat with patients assigned to them.
        provider_profile = getattr(user, 'provider_profile', None)
        patient_profile = getattr(patient, 'profile', None)
        if (
            provider_profile is None
            or patient_profile is None
            or patient_profile.assigned_provider_id != provider_profile.id
        ):
            return Response(
                {'error': 'This patient is not assigned to you.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        room, _ = ChatRoom.objects.get_or_create(patient=patient, provider=user)
        return Response(
            ChatRoomSerializer(room, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # GET — list rooms for caller
    if user.user_type == 'provider':
        qs = ChatRoom.objects.filter(provider=user, is_active=True)
    else:
        qs = ChatRoom.objects.filter(patient=user, is_active=True)

    qs = qs.order_by('-created_at')
    return Response(ChatRoomSerializer(qs, many=True, context={'request': request}).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def messages(request, room_id):
    """
    GET  /api/chat/rooms/<id>/messages/  — fetch all messages in chronological order
    POST /api/chat/rooms/<id>/messages/  — post a message ({"text": "..."})
    """
    room = _room_for_user(request.user, room_id)
    if room is None:
        return Response({'error': 'Room not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'POST':
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'text is required.'}, status=status.HTTP_400_BAD_REQUEST)

        msg = Message.objects.create(room=room, sender=request.user, text=text)
        return Response(
            MessageSerializer(msg, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # GET — cursor-based pagination
    # ?before=<message_id>  load messages older than this id (for "load more")
    # ?limit=<n>            page size, default 50, capped at 100
    try:
        limit = min(int(request.query_params.get('limit', 50)), 100)
    except (TypeError, ValueError):
        limit = 50

    qs = room.messages.order_by('-created_at')  # newest-first for slicing

    before_id = request.query_params.get('before')
    if before_id:
        try:
            qs = qs.filter(id__lt=int(before_id))
        except (TypeError, ValueError):
            return Response({'error': 'before must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

    # Fetch one extra to know whether older messages exist
    page = list(qs[:limit + 1])
    has_more = len(page) > limit
    if has_more:
        page = page[:limit]

    # Return in chronological order (oldest first) for display
    page.reverse()

    return Response({
        'results': MessageSerializer(page, many=True, context={'request': request}).data,
        'has_more': has_more,
        'next_before': page[0].id if has_more and page else None,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_read(request, room_id):
    """Mark every message in the room not sent by the caller as read."""
    room = _room_for_user(request.user, room_id)
    if room is None:
        return Response({'error': 'Room not found.'}, status=status.HTTP_404_NOT_FOUND)

    updated = room.messages.exclude(sender=request.user).filter(is_read=False).update(is_read=True)
    return Response({'marked_read': updated})
