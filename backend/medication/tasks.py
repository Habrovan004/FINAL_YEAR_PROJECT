"""
Medication SMS reminder dispatch — Module 9.

Designed to be invoked by:
  - The ``send_medication_reminders`` management command (Windows Task
    Scheduler / cron — see project README).
  - A Celery Beat schedule in production.

The reminder model carries `scheduled_time` and `is_sent`. This task scans for
unsent reminders whose `scheduled_time` is now or in the past and sends an SMS
to the patient.
"""
from django.utils import timezone

from accounts.sms import sms
from .models import MedicationReminder


def _format_phone(phone: str) -> str:
    if not phone:
        return ''
    phone = phone.strip().replace(' ', '')
    if phone.startswith('+'):
        return phone
    return '+255' + phone.lstrip('0')


def _send_sms(phone: str, body: str) -> tuple[bool, str]:
    if not phone:
        return False, 'no_phone'
    try:
        sms.send(body, [_format_phone(phone)])
        print(f"[Medication SMS] sent to {phone}: {body[:60]}…")
        return True, 'sent'
    except Exception as e:  # noqa: BLE001
        print(f"[Medication SMS] FAILED to {phone}: {e}")
        return False, f'error:{e.__class__.__name__}'


def send_due_medication_reminders() -> int:
    """Send SMS for every reminder due-or-overdue and not yet sent. Returns count sent."""
    now = timezone.now()
    qs = (
        MedicationReminder.objects
        .filter(is_sent=False, scheduled_time__lte=now, prescription__is_active=True)
        .select_related('prescription', 'prescription__patient')
    )

    sent = 0
    for reminder in qs:
        prescription = reminder.prescription
        patient = prescription.patient
        body = (
            f"MIMBA YANGU: Time to take your {prescription.medication_name} "
            f"({prescription.dosage}). {prescription.instructions or ''}".strip()
        )
        ok, status_label = _send_sms(patient.phone_number, body)
        reminder.sms_status = status_label
        if ok:
            reminder.is_sent = True
            reminder.sent_at = now
            sent += 1
        reminder.save(update_fields=['is_sent', 'sent_at', 'sms_status'])
    return sent
