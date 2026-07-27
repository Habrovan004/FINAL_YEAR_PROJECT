"""
Side-effects fired when a mother's conversation escalates to her provider:
an in-app Notification and an SMS via Africa's Talking.

Kept separate from ``ai_engine.py`` (pure Gemini/keyword logic, no ORM or
network side-effects) and ``views.py`` (HTTP glue) so each layer can be
tested independently — this module is the one to mock Africa's Talking
against in tests.
"""
import logging

from notifications.models import Notification

logger = logging.getLogger(__name__)


def _format_phone(phone: str) -> str:
    """Africa's Talking expects E.164 — accept '0712...', '712...', or '+255...' forms."""
    if not phone:
        return ''
    phone = phone.strip().replace(' ', '')
    if phone.startswith('+'):
        return phone
    return '+255' + phone.lstrip('0')


def _send_escalation_sms(phone: str, mother_first_name: str) -> bool:
    """Best-effort SMS dispatch — never raises, so an SMS-carrier outage can
    never block the conversation from being marked escalated.

    Swahili only, and deliberately clinical-detail-free: only the mother's
    first name is included, per the "no clinical details over SMS" rule.
    """
    if not phone:
        return False
    body = (
        f"MIMBA YANGU: {mother_first_name} anahitaji msaada wa haraka. "
        "Tafadhali angalia dashibodi yako kwa maelezo zaidi."
    )
    try:
        from accounts.sms import sms  # shared initialised Africa's Talking client
        response = sms.send(body, [_format_phone(phone)])
        recipients = response.get('SMSMessageData', {}).get('Recipients', [])
        return bool(recipients) and recipients[0].get('status') == 'Success'
    except Exception as e:  # noqa: BLE001
        logger.warning("Escalation SMS failed to %s: %s", phone, e)
        return False


def notify_provider_of_escalation(conversation, mother) -> None:
    """Create the in-app notification + SMS for the provider assigned to
    this conversation. Best-effort on both channels — a delivery failure on
    either must never prevent the conversation from staying escalated.
    """
    provider = conversation.provider
    if not provider:
        logger.warning(
            "Escalated convo=%s has no assigned provider — no notification sent",
            conversation.id,
        )
        return

    first_name = (mother.full_name or '').split(' ')[0] or 'Mama'

    try:
        Notification.objects.create(
            recipient=provider,
            verb='chat_escalated',
            message=f"{mother.full_name} sent a message flagged as a possible danger sign.",
            link='/provider/chats',
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("Failed to create escalation notification for convo=%s: %s", conversation.id, e)

    _send_escalation_sms(provider.phone_number, first_name)
