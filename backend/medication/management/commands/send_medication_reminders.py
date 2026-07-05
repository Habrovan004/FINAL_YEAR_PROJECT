"""
Send SMS reminders for every medication dose that is due or overdue.

Invoke regularly (every 15–30 minutes works well) via Windows Task Scheduler,
cron, or Celery Beat:

    python manage.py send_medication_reminders
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from maintenance.services import record_task_run
from medication.tasks import send_due_medication_reminders


class Command(BaseCommand):
    help = "Send SMS reminders for due/overdue medication doses."

    def handle(self, *args, **opts):
        start = timezone.now()
        try:
            sent = send_due_medication_reminders()
        except Exception as e:
            record_task_run(
                'send_medication_reminders', start, timezone.now(),
                success=False, processed_count=0, detail=f'error={e}',
            )
            raise

        record_task_run(
            'send_medication_reminders', start, timezone.now(),
            success=True, processed_count=sent,
        )
        self.stdout.write(self.style.SUCCESS(
            f"Sent {sent} medication-reminder SMS message(s)."
        ))
