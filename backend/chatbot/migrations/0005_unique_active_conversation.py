"""Enforce "one active conversation per mother" at the database level via a
partial unique index. Deactivated historical conversations are unaffected.

DEPLOYMENT ORDER
    Run ``merge_duplicate_conversations`` BEFORE this migration — if any
    mother currently has more than one active conversation, adding the
    constraint will fail with an IntegrityError.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chatbot', '0004_message_message_type_message_metadata_and_more'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='conversation',
            constraint=models.UniqueConstraint(
                condition=models.Q(('is_active', True)),
                fields=('mother',),
                name='unique_active_conversation_per_mother',
            ),
        ),
    ]
