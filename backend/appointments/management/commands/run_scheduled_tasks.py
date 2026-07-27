"""
Run every scheduled background task once. Designed to be invoked every
15-30 minutes by Windows Task Scheduler / cron / Celery Beat.

All sub-tasks are idempotent (they only act on rows still flagged as unsent
or unprocessed), so re-running is safe.

    python manage.py run_scheduled_tasks
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from appointments.tasks import (
    mark_missed_appointments,
    send_hour_reminders,
    send_tomorrow_reminders,
)
from chat.tasks import send_unread_chat_nudges
from maintenance.services import record_task_run
from medication.tasks import send_due_medication_reminders


class Command(BaseCommand):
    help = "Run every scheduled background job (appointments + medication + chat nudges) once."

    def handle(self, *args, **opts):
        start = timezone.now()
        try:
            sent_24h = send_tomorrow_reminders()
            sent_2h = send_hour_reminders()
            missed = mark_missed_appointments()
            med_sent = send_due_medication_reminders()
            chat_nudges_sent = send_unread_chat_nudges()
        except Exception as e:
            record_task_run(
                'run_scheduled_tasks', start, timezone.now(),
                success=False, processed_count=0, detail=f'error={e}',
            )
            raise

        total = sent_24h + sent_2h + missed + med_sent + chat_nudges_sent
        record_task_run(
            'run_scheduled_tasks', start, timezone.now(),
            success=True, processed_count=total,
            detail=(
                f'day_ahead_sms={sent_24h} two_hour_sms={sent_2h} '
                f'marked_missed={missed} medication_sms={med_sent} '
                f'chat_nudge_sms={chat_nudges_sent}'
            ),
        )
        self.stdout.write(self.style.SUCCESS(
            f"Appointments: {sent_24h} day-ahead SMS, {sent_2h} 2-hour SMS, "
            f"{missed} marked missed. Medication: {med_sent} SMS. "
            f"Chat nudges: {chat_nudges_sent} SMS."
        ))
