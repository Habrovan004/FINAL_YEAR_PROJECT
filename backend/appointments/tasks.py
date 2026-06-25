"""
Appointment SMS reminder logic — Module 4.

Designed so it can be invoked by:
  - The ``send_appointment_reminders`` management command (current setup)
  - A Celery Beat schedule (production setup described in the workflow)

Either path produces the same SMS dispatch.
"""
from datetime import timedelta

from django.utils import timezone

from accounts.sms import sms
from .models import Appointment


def _format_phone(phone: str) -> str:
    if not phone:
        return ''
    phone = phone.strip().replace(' ', '')
    if phone.startswith('+'):
        return phone
    return '+255' + phone.lstrip('0')


def _send_sms(phone: str, body: str) -> bool:
    if not phone:
        return False
    try:
        sms.send(body, [_format_phone(phone)])
        print(f"[Reminder SMS] sent to {phone}: {body[:60]}…")
        return True
    except Exception as e:
        print(f"[Reminder SMS] FAILED to {phone}: {e}")
        return False


def send_tomorrow_reminders():
    """Send one-day-ahead reminders. This is the 8am Celery Beat job in production."""
    tomorrow = timezone.localdate() + timedelta(days=1)
    qs = Appointment.objects.filter(
        appointment_date=tomorrow,
        status='upcoming',
        reminder_48h_sent=False,
    )
    sent = 0
    for appt in qs:
        body = (
            f"MIMBA YANGU: Reminder — your ANC visit is tomorrow "
            f"{appt.appointment_date} at {appt.appointment_time.strftime('%H:%M')}"
        )
        if appt.hospital:
            body += f" at {appt.hospital.name}."
        else:
            body += "."
        ok = _send_sms(appt.user.phone_number, body)
        if ok:
            appt.reminder_48h_sent = True
            appt.save(update_fields=['reminder_48h_sent'])
            sent += 1
    return sent


def send_hour_reminders():
    """Send 2-hour-ahead reminders. Optional second daily run."""
    now = timezone.now()
    target = now + timedelta(hours=2)
    qs = Appointment.objects.filter(
        appointment_date=target.date(),
        status='upcoming',
        reminder_2h_sent=False,
    )
    sent = 0
    for appt in qs:
        body = (
            f"MIMBA YANGU: Your ANC visit is in 2 hours at "
            f"{appt.appointment_time.strftime('%H:%M')}"
        )
        ok = _send_sms(appt.user.phone_number, body)
        if ok:
            appt.reminder_2h_sent = True
            appt.save(update_fields=['reminder_2h_sent'])
            sent += 1
    return sent


def mark_missed_appointments():
    """Move any past-due 'upcoming' appointments to 'missed' so providers can act."""
    today = timezone.localdate()
    past_due = Appointment.objects.filter(appointment_date__lt=today, status='upcoming')
    updated = past_due.update(status='missed')
    return updated
