"""
Daily ANC appointment SMS reminder.

Designed to be invoked every morning at 8 AM. In production this is what a
Celery Beat schedule would call; for the demo environment use Windows Task
Scheduler (or cron on Linux) instead:

    python manage.py send_appointment_reminders

Options:
    --hours       Also send 2-hour reminders for today's later appointments
    --mark-missed Mark past-due 'upcoming' appointments as 'missed'
"""
from django.core.management.base import BaseCommand

from appointments.tasks import (
    mark_missed_appointments,
    send_hour_reminders,
    send_tomorrow_reminders,
)


class Command(BaseCommand):
    help = "Send daily SMS reminders for tomorrow's ANC appointments."

    def add_arguments(self, parser):
        parser.add_argument('--hours', action='store_true', help='Also send 2-hour reminders')
        parser.add_argument('--mark-missed', action='store_true', help='Mark past-due upcoming appts as missed')

    def handle(self, *args, **opts):
        sent_24h = send_tomorrow_reminders()
        self.stdout.write(self.style.SUCCESS(
            f"Sent {sent_24h} tomorrow-reminder SMS message(s)."
        ))

        if opts['hours']:
            sent_2h = send_hour_reminders()
            self.stdout.write(self.style.SUCCESS(
                f"Sent {sent_2h} 2-hour-reminder SMS message(s)."
            ))

        if opts['mark_missed']:
            n = mark_missed_appointments()
            self.stdout.write(self.style.WARNING(
                f"Marked {n} past-due appointment(s) as missed."
            ))
