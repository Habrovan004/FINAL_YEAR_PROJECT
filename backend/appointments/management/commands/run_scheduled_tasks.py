"""
Run every scheduled background task once. Designed to be invoked every
15-30 minutes by Windows Task Scheduler / cron / Celery Beat.

All sub-tasks are idempotent (they only act on rows still flagged as unsent
or unprocessed), so re-running is safe.

    python manage.py run_scheduled_tasks
"""
from django.core.management.base import BaseCommand

from appointments.tasks import (
    mark_missed_appointments,
    send_hour_reminders,
    send_tomorrow_reminders,
)
from medication.tasks import send_due_medication_reminders


class Command(BaseCommand):
    help = "Run every scheduled background job (appointments + medication) once."

    def handle(self, *args, **opts):
        sent_24h = send_tomorrow_reminders()
        sent_2h = send_hour_reminders()
        missed = mark_missed_appointments()
        med_sent = send_due_medication_reminders()

        self.stdout.write(self.style.SUCCESS(
            f"Appointments: {sent_24h} day-ahead SMS, {sent_2h} 2-hour SMS, "
            f"{missed} marked missed. Medication: {med_sent} SMS."
        ))
