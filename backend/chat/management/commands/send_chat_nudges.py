"""
Send a provider SMS nudge for every direct-chat room with an unread mother
message sitting for 30+ minutes (at most one nudge per room per day).

Invoke every ~15 minutes via Windows Task Scheduler, cron, or Celery Beat:

    python manage.py send_chat_nudges

Also folded into `run_scheduled_tasks` so a single consolidated cron tick
covers it alongside appointments/medication — this standalone command exists
for manual invocation and for isolated scheduling if ever needed.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from chat.tasks import send_unread_chat_nudges
from maintenance.services import record_task_run


class Command(BaseCommand):
    help = "Send SMS nudges for direct-chat messages unread by a provider for 30+ minutes."

    def handle(self, *args, **opts):
        start = timezone.now()
        try:
            sent = send_unread_chat_nudges()
        except Exception as e:
            record_task_run(
                'send_chat_nudges', start, timezone.now(),
                success=False, processed_count=0, detail=f'error={e}',
            )
            raise

        record_task_run(
            'send_chat_nudges', start, timezone.now(),
            success=True, processed_count=sent,
        )
        self.stdout.write(self.style.SUCCESS(
            f"Sent {sent} chat-nudge SMS message(s)."
        ))
