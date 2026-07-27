"""
Provider ↔ patient direct messaging.

This complements the chatbot app, which handles AI-mediated conversation that
auto-escalates to a provider. The chat app is for the *proactive* case: a
provider wants to message a patient (or vice-versa) without going through the
AI gateway — e.g. a follow-up after an ANC visit, lab-result review, or
medication-adherence check-in.

Access rules:
  - A provider may create a room only for a patient assigned to them.
  - A patient may create a room only with her own assigned provider (no
    `patient_id` needed — resolved from her profile), and may view/post in
    any room where they are the `patient`.
  - Either party may mark received messages as read.
"""
from django.db.models import Max, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from datetime import timedelta

from clinical.models import ANCVisit
from maintenance.models import AuditLog
from notifications.models import Notification
from patients.permissions import get_patient_or_404
from .models import ChatRoom, Message
from .permissions import get_room_or_404
from .serializers import ChatRoomSerializer, MessageSerializer
from .tasks import send_sms
from .throttles import ChatMessageSendThrottle

# "Hasn't opened the app" threshold for the provider-reply SMS nudge below.
MOTHER_INACTIVITY_SMS_THRESHOLD = timedelta(hours=24)

# "Delete for everyone" is only allowed within this window of sending.
DELETE_FOR_EVERYONE_WINDOW = timedelta(minutes=15)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def rooms(request):
    """
    GET  /api/chat/rooms/        — list the caller's active rooms (newest first)
    POST /api/chat/rooms/        — create (or get) a room with the other party
                                   provider caller body: { "patient_id": <int> }
                                   patient caller: no body needed, uses her
                                   assigned provider
    """
    user = request.user

    if request.method == 'POST':
        if user.user_type == 'provider':
            patient_id = request.data.get('patient_id')
            if not patient_id:
                return Response({'error': 'patient_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

            # 404 (not 403) for a patient not assigned to this provider, so
            # patient IDs belonging to other providers can't be enumerated —
            # same rule as every other provider-scoped, patient-keyed view.
            patient = get_patient_or_404(request, patient_id)

            room, _ = ChatRoom.objects.get_or_create(patient=patient, provider=user)
            return Response(
                ChatRoomSerializer(room, context={'request': request}).data,
                status=status.HTTP_201_CREATED,
            )

        # Patient caller — resolve her own assigned provider, no patient_id needed.
        patient_profile = getattr(user, 'profile', None)
        assigned_provider = patient_profile.assigned_provider if patient_profile else None
        if assigned_provider is None:
            return Response(
                {'error': 'no_provider_assigned', 'detail': 'You do not have an assigned provider yet.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        room, _ = ChatRoom.objects.get_or_create(patient=user, provider=assigned_provider.user)
        return Response(
            ChatRoomSerializer(room, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # GET — list rooms for caller, sorted by most recent activity (latest
    # message time, falling back to room creation time for a room with no
    # messages yet — not creation time alone, which would misorder an old
    # room that just got a fresh reply above a newer, still-silent one).
    if user.user_type == 'provider':
        qs = ChatRoom.objects.filter(provider=user, is_active=True)
    else:
        qs = ChatRoom.objects.filter(patient=user, is_active=True)

    qs = qs.annotate(
        last_activity=Coalesce(Max('messages__created_at'), 'created_at')
    ).order_by('-last_activity')
    return Response(ChatRoomSerializer(qs, many=True, context={'request': request}).data)


def _notify_recipient(room, sender, msg):
    recipient_id = room.provider_id if sender.id == room.patient_id else room.patient_id
    preview = f'{sender.full_name}: {msg.text[:80]}' if msg.text else f'{sender.full_name} sent an update.'
    Notification.objects.create(
        recipient_id=recipient_id,
        verb='chat_message',
        message=preview,
        link='/chat' if recipient_id == room.patient_id else '/provider/chats',
    )


def _maybe_sms_inactive_mother(room, sender):
    """If a provider just replied and the mother hasn't opened the app in
    24h+, send her a generic Swahili SMS — never the message content."""
    if sender.id != room.provider_id:
        return
    mother = room.patient
    last_active = mother.last_active_at
    if last_active is not None and timezone.now() - last_active < MOTHER_INACTIVITY_SMS_THRESHOLD:
        return
    send_sms(mother.phone_number, "Una ujumbe mpya kutoka kwa muuguzi wako kwenye Mimba Yangu.")


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ChatMessageSendThrottle])
def messages(request, room_id):
    """
    GET  /api/chat/rooms/<id>/messages/            — backward-pagination page
                                                       (?before=<id>, for "load older")
    GET  /api/chat/rooms/<id>/messages/?after=<id> — incremental fetch for polling:
                                                       messages after the cursor,
                                                       ascending, capped at 100.
                                                       Marks fetched messages
                                                       addressed to the caller
                                                       as read.
    POST /api/chat/rooms/<id>/messages/            — send a message.
         {"type": "text", "text": "..."}            (type defaults to "text";
                                                       "body" also accepted as
                                                       an alias for "text")
         {"type": "visit_card", "visit_id": <int>}  (providers only, and only
                                                       for a visit belonging to
                                                       this room's mother)
    """
    room = get_room_or_404(request, room_id)

    if request.method == 'POST':
        msg_type = (request.data.get('type') or 'text').strip()

        if msg_type == 'visit_card':
            if request.user.user_type != 'provider':
                return Response({'error': 'Only providers can insert a visit card.'}, status=403)
            visit_id = request.data.get('visit_id')
            if not visit_id:
                return Response({'error': 'visit_id is required.'}, status=400)
            try:
                visit = ANCVisit.objects.get(pk=visit_id, patient_id=room.patient_id)
            except ANCVisit.DoesNotExist:
                return Response({'error': 'Visit not found.'}, status=404)
            msg = Message.objects.create(
                room=room, sender=request.user, message_type='visit_card',
                text=f"ANC visit summary — {visit.visit_date.date().isoformat()}",
                visit=visit,
            )
        elif msg_type == 'text':
            text = (request.data.get('text') or request.data.get('body') or '').strip()
            if not text:
                return Response({'error': 'text is required.'}, status=status.HTTP_400_BAD_REQUEST)
            msg = Message.objects.create(room=room, sender=request.user, message_type='text', text=text)
        else:
            return Response({'error': 'Unsupported message type.'}, status=400)

        _notify_recipient(room, request.user, msg)
        _maybe_sms_inactive_mother(room, request.user)

        return Response(
            MessageSerializer(msg, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ---- GET ----
    after = request.query_params.get('after')
    if after is not None:
        try:
            after_id = int(after)
        except (TypeError, ValueError):
            return Response({'error': 'after must be an integer message id.'}, status=status.HTTP_400_BAD_REQUEST)

        results = list(
            room.messages.filter(id__gt=after_id).exclude(hidden_for=request.user).order_by('id')[:100]
        )

        # Mark newly-fetched messages addressed to the caller as read.
        unread_ids = [m.id for m in results if m.sender_id != request.user.id and m.read_at is None]
        if unread_ids:
            now = timezone.now()
            Message.objects.filter(id__in=unread_ids).update(read_at=now, is_read=True)
            for m in results:
                if m.id in unread_ids:
                    m.read_at = now
                    m.is_read = True

        unread_count = (
            room.messages.filter(read_at__isnull=True)
            .exclude(sender=request.user)
            .exclude(hidden_for=request.user)
            .exclude(deleted_for_everyone=True)
            .count()
        )

        # "Delete for everyone" can target a message the caller already has
        # in local state from before the deletion — the full current set of
        # deleted-for-everyone ids in this room lets the client patch any of
        # those over to the deleted placeholder. Deletions are rare, so this
        # stays cheap; a fresh/initial fetch doesn't need this separately
        # since the serializer above already reflects each message's current
        # state directly.
        deleted_ids = list(
            room.messages.filter(deleted_for_everyone=True).values_list('id', flat=True)
        )

        return Response({
            'results': MessageSerializer(results, many=True, context={'request': request}).data,
            'unread_count': unread_count,
            'deleted_ids': deleted_ids,
        })

    # ---- backward pagination (?before=, for "load older") — unchanged ----
    try:
        limit = min(int(request.query_params.get('limit', 50)), 100)
    except (TypeError, ValueError):
        limit = 50

    qs = room.messages.exclude(hidden_for=request.user).order_by('-created_at')  # newest-first for slicing

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
    room = get_room_or_404(request, room_id)
    updated = (
        room.messages.exclude(sender=request.user)
        .exclude(hidden_for=request.user)
        .filter(read_at__isnull=True)
        .update(is_read=True, read_at=timezone.now())
    )
    return Response({'marked_read': updated})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    """Total unread direct-chat messages for the requesting user, across all
    their conversations — for nav-bar / tab badges."""
    count = (
        Message.objects
        .filter(read_at__isnull=True)
        .filter(Q(room__patient=request.user) | Q(room__provider=request.user))
        .exclude(sender=request.user)
        .exclude(hidden_for=request.user)
        .exclude(deleted_for_everyone=True)
        .count()
    )
    return Response({'unread_count': count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_messages(request):
    """
    POST /api/chat/messages/delete/
        {"message_ids": [1, 2, 3], "scope": "me" | "everyone"}

    scope "me": hides any message in a conversation the caller belongs to,
    from the caller's own view only — the other participant is unaffected.

    scope "everyone": only the caller's OWN messages, only within 15 minutes
    of being sent, never a system message or a visit_card. Content is never
    physically deleted — only blanked at the serializer level (see
    MessageSerializer.get_text/get_message_type/get_visit_card).

    Never a blanket 404 for the whole request — each id is independently
    resolved against the caller's own rooms, so this is inherently a batch
    operation; ids that don't exist or aren't the caller's are reported as
    "not_found" per-id (enumeration-safe, same as everywhere else in this
    app) rather than failing the whole request.
    """
    message_ids = request.data.get('message_ids')
    scope = request.data.get('scope')

    if not isinstance(message_ids, list) or not message_ids:
        return Response({'error': 'message_ids must be a non-empty list.'}, status=status.HTTP_400_BAD_REQUEST)
    if scope not in ('me', 'everyone'):
        return Response({'error': 'scope must be "me" or "everyone".'}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    messages_qs = (
        Message.objects.filter(pk__in=message_ids)
        .filter(Q(room__patient=user) | Q(room__provider=user))
        .select_related('room')
    )
    found_by_id = {m.id: m for m in messages_qs}

    deleted_ids = []
    rejected = []

    if scope == 'me':
        to_hide = []
        for mid in message_ids:
            msg = found_by_id.get(mid)
            if msg is None:
                rejected.append({'id': mid, 'reason': 'not_found'})
                continue
            to_hide.append(msg)
        for msg in to_hide:
            msg.hidden_for.add(user)
            deleted_ids.append(msg.id)

    else:  # scope == 'everyone'
        now = timezone.now()
        to_delete = []
        for mid in message_ids:
            msg = found_by_id.get(mid)
            if msg is None:
                rejected.append({'id': mid, 'reason': 'not_found'})
                continue
            # Checked before ownership: a system message has sender=None,
            # which would otherwise always fail the ownership check first
            # and mask the more specific/accurate rejection reason.
            if msg.message_type == 'system':
                rejected.append({'id': mid, 'reason': 'system_message'})
                continue
            if msg.sender_id != user.id:
                rejected.append({'id': mid, 'reason': 'not_own_message'})
                continue
            if msg.message_type == 'visit_card':
                rejected.append({'id': mid, 'reason': 'visit_card_not_deletable_for_everyone'})
                continue
            if now - msg.created_at > DELETE_FOR_EVERYONE_WINDOW:
                rejected.append({'id': mid, 'reason': 'too_old'})
                continue
            to_delete.append(msg)

        if to_delete:
            Message.objects.filter(pk__in=[m.id for m in to_delete]).update(
                deleted_for_everyone=True, deleted_at=now, deleted_by=user,
            )
            deleted_ids = [m.id for m in to_delete]

    if deleted_ids:
        AuditLog.objects.create(
            user=user,
            event_type='chat_msg_delete',
            description=f"Deleted chat message(s) {deleted_ids} scope={scope}",
        )

    return Response({'deleted': deleted_ids, 'rejected': rejected})
