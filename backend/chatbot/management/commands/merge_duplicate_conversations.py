"""Collapse every mother's multiple active Conversation rows into one.

For each mother with >1 active conversation:
  * The **oldest** (lowest pk) is kept as canonical.
  * All Messages from the duplicates are re-parented to it (created_at
    order is naturally preserved by the ordering on Message.Meta).
  * The canonical row inherits escalation state from any duplicate that
    was further along the workflow — a 'provider'-typed duplicate promotes
    the canonical, its provider FK and earliest ``escalated_at`` carry
    over. Otherwise the canonical is left untouched.
  * A Swahili system message is inserted into the canonical noting the
    merge and the date.
  * The now-empty duplicate rows are deleted.

Idempotent: on a second run the mother already has exactly one active
conversation and is skipped.

MUST run BEFORE ``chatbot/migrations/0005_unique_active_conversation.py``
is applied — that migration will fail with an IntegrityError otherwise.

Usage:

    python manage.py merge_duplicate_conversations
    python manage.py merge_duplicate_conversations --dry-run
"""
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from chatbot.models import Conversation, Message


MERGE_NOTICE_SW = 'Mazungumzo yameunganishwa - {date}.'


class Command(BaseCommand):
    help = 'Merge duplicate active Conversation rows so each mother has exactly one.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print the plan but write nothing.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        duplicate_mother_ids = list(
            Conversation.objects
            .filter(is_active=True)
            .values('mother_id')
            .annotate(c=Count('id'))
            .filter(c__gt=1)
            .values_list('mother_id', flat=True)
        )

        header = '[DRY RUN] ' if dry_run else ''
        self.stdout.write(self.style.MIGRATE_HEADING(
            f'{header}merge_duplicate_conversations: '
            f'{len(duplicate_mother_ids)} mothers with duplicate active conversations'
        ))

        if not duplicate_mother_ids:
            self.stdout.write(self.style.SUCCESS('  Nothing to merge.'))
            return

        totals = defaultdict(int)
        per_mother_report = []

        for mother_id in duplicate_mother_ids:
            duplicates = list(
                Conversation.objects
                .filter(mother_id=mother_id, is_active=True)
                .order_by('pk')
            )
            canonical, *others = duplicates
            other_ids = [c.pk for c in others]

            message_count = Message.objects.filter(conversation_id__in=other_ids).count()

            # Decide inherited escalation state — the canonical wins for its
            # own type, but a duplicate that has already escalated to a
            # provider outranks a canonical still on the chatbot.
            promoted_type = canonical.type
            promoted_provider_id = canonical.provider_id
            promoted_escalated_at = canonical.escalated_at

            escalated_others = [c for c in others if c.type == 'provider']
            if canonical.type != 'provider' and escalated_others:
                # Take the most-recently-updated escalation as the source
                # of truth for who the mother's provider currently is.
                latest_escalated = max(escalated_others, key=lambda c: c.updated_at)
                promoted_type = 'provider'
                promoted_provider_id = latest_escalated.provider_id
                candidate_dates = [c.escalated_at for c in duplicates if c.escalated_at]
                promoted_escalated_at = min(candidate_dates) if candidate_dates else timezone.now()

            per_mother_report.append({
                'mother_id': mother_id,
                'canonical_id': canonical.pk,
                'duplicate_ids': other_ids,
                'messages_moved': message_count,
                'promotion': (
                    None if promoted_type == canonical.type and promoted_provider_id == canonical.provider_id
                    else {'type': promoted_type, 'provider_id': promoted_provider_id}
                ),
            })

            totals['mothers'] += 1
            totals['duplicates_removed'] += len(others)
            totals['messages_moved'] += message_count

            if dry_run:
                continue

            with transaction.atomic():
                Message.objects.filter(conversation_id__in=other_ids).update(
                    conversation=canonical,
                )

                # Promote canonical if needed.
                changed_fields = []
                if promoted_type != canonical.type:
                    canonical.type = promoted_type
                    changed_fields.append('type')
                if promoted_provider_id != canonical.provider_id:
                    canonical.provider_id = promoted_provider_id
                    changed_fields.append('provider')
                if promoted_escalated_at != canonical.escalated_at:
                    canonical.escalated_at = promoted_escalated_at
                    changed_fields.append('escalated_at')
                if changed_fields:
                    changed_fields.append('updated_at')
                    canonical.save(update_fields=changed_fields)

                Message.objects.create(
                    conversation=canonical,
                    sender=None,
                    sender_type='system',
                    message_type='system',
                    content=MERGE_NOTICE_SW.format(date=timezone.localdate().isoformat()),
                )

                Conversation.objects.filter(pk__in=other_ids).delete()

        self._report(dry_run=dry_run, totals=totals, per_mother=per_mother_report)

    def _report(self, *, dry_run, totals, per_mother):
        self.stdout.write('')
        self.stdout.write(f'  Mothers processed:     {totals["mothers"]}')
        self.stdout.write(f'  Duplicates removed:    {totals["duplicates_removed"]}')
        self.stdout.write(f'  Messages re-parented:  {totals["messages_moved"]}')
        self.stdout.write('')
        self.stdout.write('  Per-mother detail:')
        for row in per_mother:
            promo = ''
            if row['promotion']:
                promo = f'  [promoted → {row["promotion"]["type"]}, provider_id={row["promotion"]["provider_id"]}]'
            self.stdout.write(
                f'    mother={row["mother_id"]}  keep={row["canonical_id"]}  '
                f'delete={row["duplicate_ids"]}  msgs={row["messages_moved"]}{promo}'
            )

        if dry_run:
            self.stdout.write('')
            self.stdout.write(self.style.NOTICE('  (no changes written — remove --dry-run to apply)'))
        else:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('  Done.'))
