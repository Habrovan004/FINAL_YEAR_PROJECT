"""
Direct-chat SMS side effects — Task 5.

Two separate notification paths live here / in `chat.views`:

  1. A mother's message sits unread by the provider for 30+ minutes ->
     `send_unread_chat_nudges()` (called by the `send_chat_nudges` management
     command, and folded into `run_scheduled_tasks`) sends the provider ONE
     SMS nudge per room per calendar day (see `ChatNudge` for the de-dup).
  2. A provider replies to a mother who hasn't touched the app in 24h+ ->
     handled synchronously in `chat.views.messages()` via `format_phone`/
     `send_sms` from this module (no de-dup — one SMS per such reply, per
     the spec).

Neither path ever puts message content in the SMS body.
"""
from datetime import timedelta

from django.utils import timezone

from accounts.sms import sms
from .models import ChatNudge, ChatRoom, Message


def format_phone(phone: str) -> str:
    if not phone:
        return ''
    phone = phone.strip().replace(' ', '')
    if phone.startswith('+'):
        return phone
    return '+255' + phone.lstrip('0')


def send_sms(phone: str, body: str) -> tuple[bool, str]:
    if not phone:
        return False, 'no_phone'
    try:
        sms.send(body, [format_phone(phone)])
        print(f"[Chat SMS] sent to {phone}: {body[:60]}…")
        return True, 'sent'
    except Exception as e:  # noqa: BLE001
        print(f"[Chat SMS] FAILED to {phone}: {e}")
        return False, f'error:{e.__class__.__name__}'


UNREAD_NUDGE_DELAY = timedelta(minutes=30)


def send_unread_chat_nudges() -> int:
    """Send one SMS nudge (per room, per calendar day) to a provider who has
    an unread message from a mother sitting for 30+ minutes. Returns the
    count of SMS actually sent."""
    now = timezone.now()
    cutoff = now - UNREAD_NUDGE_DELAY
    today = now.date()

    stale_room_ids = (
        Message.objects
        .filter(sender__user_type='patient', read_at__isnull=True, created_at__lte=cutoff)
        .exclude(deleted_for_everyone=True)
        .values_list('room_id', flat=True)
        .distinct()
    )

    sent = 0
    rooms = (
        ChatRoom.objects
        .filter(id__in=stale_room_ids, is_active=True)
        .select_related('patient', 'provider')
    )
    for room in rooms:
        # get_or_create is the de-dup guard: if today's row already exists
        # (this room was already nudged today), `created` is False and we
        # skip — this also makes concurrent/overlapping cron runs safe.
        _nudge, created = ChatNudge.objects.get_or_create(room=room, sent_date=today)
        if not created:
            continue

        first_name = (room.patient.full_name or '').split(' ')[0] or 'Mama'
        body = (
            f"Muuguzi, {first_name} amekutumia ujumbe kwenye Mimba Yangu ambao "
            f"bado haujausoma. Tafadhali fungua programu ili kumjibu."
        )
        ok, _status = send_sms(room.provider.phone_number, body)
        if ok:
            sent += 1
    return sent
