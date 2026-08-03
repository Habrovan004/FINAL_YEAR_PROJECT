"""Add the Assignment model — single source of truth for which provider is
currently responsible for which mother. OneToOne on ``mother`` enforces the
"one active assignment per mother, always" invariant at the database level.

Data backfill from the legacy ``PatientProfile.assigned_provider`` FK lives
in ``patients/migrations/0007_backfill_assignments.py`` and depends on this
schema being in place.
"""
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_user_last_active_at'),
        ('patients', '0006_babygrowth_baby_facts_babygrowth_baby_facts_sw_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Assignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True)),
                ('assigned_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=models.deletion.SET_NULL,
                    related_name='assignments_made',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('mother', models.OneToOneField(
                    on_delete=models.deletion.PROTECT,
                    related_name='assignment',
                    to='patients.patientprofile',
                )),
                ('provider', models.ForeignKey(
                    on_delete=models.deletion.PROTECT,
                    related_name='assignments',
                    to='accounts.providerprofile',
                )),
            ],
        ),
    ]
