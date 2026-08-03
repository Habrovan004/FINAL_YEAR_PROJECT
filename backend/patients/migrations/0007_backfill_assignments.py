"""Data migration: copy every existing ``PatientProfile.assigned_provider``
FK into a corresponding ``accounts.Assignment`` row so the new model is a
truthful mirror of the legacy field at the moment of cutover.

The legacy ``PatientProfile.assigned_provider`` field is intentionally left
in place by this migration — dropping it also requires updating every
reader (chat/views.py, chatbot/views.py, tracking/signals.py,
patients/permissions.py, and the reassign endpoint), which is Task 5's
scope. Until then the two are kept in sync by dual-writing.

Idempotent: uses ``get_or_create`` on the OneToOne ``mother`` field, so
re-running is a no-op even if it's partially applied.
"""
from django.db import migrations


def backfill_from_assigned_provider(apps, schema_editor):
    PatientProfile = apps.get_model('patients', 'PatientProfile')
    Assignment = apps.get_model('accounts', 'Assignment')

    created = 0
    skipped_no_provider = 0
    skipped_already = 0

    for profile in PatientProfile.objects.select_related('assigned_provider').iterator():
        if profile.assigned_provider_id is None:
            skipped_no_provider += 1
            continue
        _, was_created = Assignment.objects.get_or_create(
            mother=profile,
            defaults={
                'provider_id': profile.assigned_provider_id,
                'assigned_by': None,
            },
        )
        if was_created:
            created += 1
        else:
            skipped_already += 1

    print(
        f"[backfill_assignments] created={created} "
        f"skipped_already_assigned={skipped_already} "
        f"skipped_no_provider={skipped_no_provider}"
    )


def reverse_delete_all_assignments(apps, schema_editor):
    """On reverse migration, wipe every Assignment row. The legacy
    ``PatientProfile.assigned_provider`` field still holds the same data,
    so no information is lost."""
    Assignment = apps.get_model('accounts', 'Assignment')
    Assignment.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0006_babygrowth_baby_facts_babygrowth_baby_facts_sw_and_more'),
        ('accounts', '0010_assignment'),
    ]

    operations = [
        migrations.RunPython(
            backfill_from_assigned_provider,
            reverse_code=reverse_delete_all_assignments,
        ),
    ]
