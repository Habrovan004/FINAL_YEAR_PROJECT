"""
Send SMS reminders for every medication dose that is due or overdue.

Invoke regularly (every 15–30 minutes works well) via Windows Task Scheduler,
cron, or Celery Beat:

    python manage.py send_medication_reminders
"""
from django.core.management.base import BaseCommand

from medication.tasks import send_due_medication_reminders


class Command(BaseCommand):
    help = "Send SMS reminders for due/overdue medication doses."

    def handle(self, *args, **opts):
        sent = send_due_medication_reminders()
        self.stdout.write(self.style.SUCCESS(
            f"Sent {sent} medication-reminder SMS message(s)."
        ))
