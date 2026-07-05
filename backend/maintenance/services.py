"""Observability for scheduled/background management commands.

Writes one AuditLog row per run so a missed or failed run is visible by
querying existing data (no new monitoring dependency needed):

    AuditLog.objects.filter(event_type='scheduled_task').order_by('-timestamp')
"""
from maintenance.models import AuditLog


def record_task_run(task_name, start_time, end_time, success, processed_count, detail=''):
    duration = (end_time - start_time).total_seconds()
    status = 'success' if success else 'FAILURE'
    description = (
        f"{task_name} | status={status} | duration={duration:.2f}s | "
        f"processed={processed_count} | start={start_time.isoformat()} | "
        f"end={end_time.isoformat()}"
    )
    if detail:
        description += f" | {detail}"
    AuditLog.objects.create(event_type='scheduled_task', description=description)
