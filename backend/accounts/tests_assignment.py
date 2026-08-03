"""End-to-end coverage for the Assignment / one-conversation-per-mother
work (Tasks 2 through 5):

  * auto-assignment on registration is least-loaded with a stable
    tie-break by earliest provider registration
  * the OneToOne on Assignment.mother blocks a second row at the DB level
  * the partial unique index on Conversation blocks a second active row
  * ``merge_duplicate_conversations`` reports without writes under --dry-run
    and actually collapses duplicates without
  * ``conversation_entry`` never creates a second Conversation for a mother
  * the admin "Reassign selected mothers" action updates Assignment,
    re-points the Conversation, drops the Swahili system message, and
    causes the old provider's next API call to 404 while the new
    provider's returns 200
  * ``assign_unassigned_mothers --dry-run`` reports without writing
"""
from io import StringIO
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import Client, TestCase, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Assignment, ProviderProfile, User
from chatbot.models import Conversation, Message as ChatbotMessage
from hospitals.models import Hospital
from patients.models import PatientProfile


def _bearer(user):
    return f'Bearer {RefreshToken.for_user(user).access_token}'


# ── Shared fixture builder ─────────────────────────────────────────────
class AssignmentFixtureMixin:
    """One hospital, two providers (Amina onboarded first / less loaded,
    Beatrice later / more loaded), and helpers for making mothers +
    assignments quickly."""

    def _mk_provider(self, phone, name, hospital=None, workload=0, available=True):
        u = User.objects.create_user(phone_number=phone, full_name=name, user_type='provider')
        return ProviderProfile.objects.create(
            user=u, hospital=hospital or self.hospital,
            specialization='midwife', current_workload=workload,
            is_available=available,
        )

    def _mk_mother(self, phone, name, provider=None):
        u = User.objects.create_user(phone_number=phone, full_name=name, user_type='patient')
        profile = PatientProfile.objects.create(user=u, assigned_provider=provider)
        if provider:
            Assignment.objects.create(mother=profile, provider=provider)
        return u, profile

    def setUp(self):
        super().setUp() if hasattr(super(), 'setUp') else None
        self.hospital = Hospital.objects.create(name='Test Hospital')
        self.provider_a = self._mk_provider('+255700100001', 'Dr Amina', workload=1)
        self.provider_b = self._mk_provider('+255700100002', 'Dr Beatrice', workload=1)


# ── 1. Auto-assignment on registration ─────────────────────────────────
class AutoAssignRegistrationTests(AssignmentFixtureMixin, APITestCase):
    REGISTER_URL = '/api/auth/register/'

    def _register_mother(self, phone, name='Asha'):
        return self.client.post(self.REGISTER_URL, {
            'phone_number': phone, 'full_name': name,
            'user_type': 'patient', 'password': 'testpass1',
            'hospital_id': self.hospital.id,
        }, format='json')

    def test_registration_creates_assignment_row(self):
        resp = self._register_mother('+255700200001')
        self.assertEqual(resp.status_code, 201)
        mother = User.objects.get(phone_number='+255700200001')
        self.assertEqual(Assignment.objects.filter(mother__user=mother).count(), 1)

    def test_least_loaded_provider_picked_first(self):
        # A has workload=1, B has workload=1 — bump B so A becomes least-loaded.
        self.provider_b.current_workload = 5
        self.provider_b.save(update_fields=['current_workload'])
        resp = self._register_mother('+255700200002')
        self.assertEqual(resp.status_code, 201)
        mother_profile = PatientProfile.objects.get(user__phone_number='+255700200002')
        self.assertEqual(mother_profile.assignment.provider_id, self.provider_a.id)

    def test_tie_broken_by_earliest_provider_registration(self):
        # A was created first (see setUp), both have equal workload — A wins.
        self.assertEqual(self.provider_a.current_workload, self.provider_b.current_workload)
        resp = self._register_mother('+255700200003')
        self.assertEqual(resp.status_code, 201)
        mother_profile = PatientProfile.objects.get(user__phone_number='+255700200003')
        self.assertEqual(mother_profile.assignment.provider_id, self.provider_a.id)

    def test_registration_errors_when_no_provider_available(self):
        # Take every provider offline — registration should fail loudly
        # rather than silently orphan the mother.
        ProviderProfile.objects.all().update(is_available=False)
        resp = self._register_mother('+255700200004')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('provider', resp.data)
        self.assertFalse(User.objects.filter(phone_number='+255700200004').exists())


# ── 2. OneToOne constraint ─────────────────────────────────────────────
class AssignmentOneToOneConstraintTests(AssignmentFixtureMixin, TransactionTestCase):
    def test_second_assignment_for_same_mother_raises_integrityerror(self):
        _, profile = self._mk_mother('+255700300001', 'Halima', provider=self.provider_a)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Assignment.objects.create(mother=profile, provider=self.provider_b)


# ── 3. Conversation partial-unique constraint + get_or_create ─────────
class ConversationUniquenessTests(AssignmentFixtureMixin, APITestCase):
    def test_second_active_conversation_for_same_mother_raises_integrityerror(self):
        mother, _ = self._mk_mother('+255700400001', 'Zawadi', provider=self.provider_a)
        Conversation.objects.create(mother=mother, provider=self.provider_a.user, type='chatbot')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Conversation.objects.create(mother=mother, provider=self.provider_a.user, type='chatbot')

    def test_conversation_entry_returns_same_pk_on_repeat(self):
        mother, _ = self._mk_mother('+255700400002', 'Furaha', provider=self.provider_a)
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(mother))
        r1 = self.client.get('/api/chatbot/conversation/')
        r2 = self.client.get('/api/chatbot/conversation/')
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r1.data['id'], r2.data['id'])
        self.assertEqual(Conversation.objects.filter(mother=mother).count(), 1)


# ── 4. merge_duplicate_conversations ──────────────────────────────────
class MergeDuplicateConversationsTests(AssignmentFixtureMixin, TransactionTestCase):
    """Uses TransactionTestCase so we can INSERT duplicates without the
    partial unique index kicking in — the merge command must be usable
    *before* the constraint migration is applied. The index is dropped
    for the duration of each test (TransactionTestCase truncates tables
    between tests, so leaving the index dropped is safe)."""

    def setUp(self):
        super().setUp()
        _drop_unique_index_if_exists()

    def _seed_duplicates(self, mother, provider_user):
        c_old = Conversation.objects.create(mother=mother, provider=None, type='chatbot')
        c_new = Conversation.objects.create(
            mother=mother, provider=provider_user, type='provider',
            escalated_at=timezone.now(),
        )
        ChatbotMessage.objects.create(conversation=c_old, sender_type='chatbot', content='old-msg')
        ChatbotMessage.objects.create(
            conversation=c_new, sender_type='provider', sender=provider_user, content='new-msg',
        )
        return c_old, c_new

    def test_dry_run_reports_but_writes_nothing(self):
        mother, _ = self._mk_mother('+255700500001', 'Neema', provider=self.provider_a)
        c_old, c_new = self._seed_duplicates(mother, self.provider_a.user)
        self.assertEqual(Conversation.objects.filter(mother=mother, is_active=True).count(), 2)

        out = StringIO()
        call_command('merge_duplicate_conversations', '--dry-run', stdout=out)
        self.assertIn('DRY RUN', out.getvalue())
        # Nothing was actually written.
        self.assertEqual(Conversation.objects.filter(mother=mother, is_active=True).count(), 2)
        self.assertEqual(ChatbotMessage.objects.filter(conversation__mother=mother).count(), 2)

    def test_live_merges_messages_and_inserts_system_message(self):
        mother, _ = self._mk_mother('+255700500002', 'Rehema', provider=self.provider_a)
        c_old, c_new = self._seed_duplicates(mother, self.provider_a.user)

        call_command('merge_duplicate_conversations', stdout=StringIO())

        surviving = Conversation.objects.filter(mother=mother, is_active=True)
        self.assertEqual(surviving.count(), 1)
        self.assertEqual(surviving.first().pk, c_old.pk)  # oldest wins
        # Messages from the duplicate were re-parented into the canonical.
        canonical_messages = ChatbotMessage.objects.filter(conversation=c_old).order_by('created_at')
        contents = [m.content for m in canonical_messages]
        self.assertIn('old-msg', contents)
        self.assertIn('new-msg', contents)
        self.assertTrue(any('Mazungumzo yameunganishwa' in c for c in contents),
                        f'expected Swahili merge notice, got: {contents}')
        self.assertFalse(Conversation.objects.filter(pk=c_new.pk).exists())

    def test_escalation_state_promoted_from_duplicate(self):
        mother, _ = self._mk_mother('+255700500003', 'Salma', provider=self.provider_a)
        c_old, c_new = self._seed_duplicates(mother, self.provider_a.user)
        # c_old was chatbot-only, c_new was already escalated.
        self.assertEqual(c_old.type, 'chatbot')
        self.assertEqual(c_new.type, 'provider')

        call_command('merge_duplicate_conversations', stdout=StringIO())

        canonical = Conversation.objects.get(pk=c_old.pk)
        self.assertEqual(canonical.type, 'provider', 'canonical should inherit escalation')
        self.assertEqual(canonical.provider_id, self.provider_a.user.id)
        self.assertIsNotNone(canonical.escalated_at)


# ── 5. Admin reassign action ──────────────────────────────────────────
class AdminReassignActionTests(AssignmentFixtureMixin, APITestCase):
    def setUp(self):
        super().setUp()
        # A superuser for the admin session, plus one mother currently
        # assigned to A. The Client posts to the admin URL; the
        # APIClient handles the DRF endpoints for the 404/200 flip.
        self.admin_user = User.objects.create_superuser(
            phone_number='+255700900001', password='adminpass',
            full_name='Site Admin',
        )
        self.mother, self.mother_profile = self._mk_mother(
            '+255700900002', 'Neema', provider=self.provider_a,
        )
        # A live conversation the reassignment should re-point in place.
        self.convo = Conversation.objects.create(
            mother=self.mother, provider=self.provider_a.user, type='provider',
            escalated_at=timezone.now(),
        )

        self.admin_client = Client()
        self.admin_client.force_login(self.admin_user)

    def _run_reassign(self):
        """Emulate submitting the reassign confirmation form in one POST.
        Django's admin action machinery runs the action with the selected
        queryset regardless of whether the intermediate page was rendered
        first — passing ``apply=1`` short-circuits straight to the write."""
        url = reverse('admin:accounts_assignment_changelist')
        assignment = Assignment.objects.get(mother=self.mother_profile)
        # follow=False on purpose: the redirect target is the admin
        # changelist, which renders static-referencing templates that
        # aren't safe to load in all local dev environments.
        return self.admin_client.post(url, {
            'action': 'reassign_selected_mothers',
            '_selected_action': [assignment.pk],
            'apply': '1',
            'new_provider': self.provider_b.pk,
            'notes': 'Reassigned by test',
        })

    def test_admin_action_updates_assignment_and_conversation(self):
        resp = self._run_reassign()
        self.assertEqual(resp.status_code, 302)  # redirect back to changelist
        a = Assignment.objects.get(mother=self.mother_profile)
        self.assertEqual(a.provider_id, self.provider_b.pk)
        self.assertEqual(a.assigned_by_id, self.admin_user.pk)
        self.assertEqual(a.notes, 'Reassigned by test')
        # Conversation was re-pointed, NOT duplicated.
        self.assertEqual(Conversation.objects.filter(mother=self.mother).count(), 1)
        convo = Conversation.objects.get(mother=self.mother)
        self.assertEqual(convo.provider_id, self.provider_b.user.id)
        # Swahili system message was inserted.
        sw_msg = ChatbotMessage.objects.filter(
            conversation=convo, sender_type='system',
            content__startswith='Mama huyu amehamishiwa kwa Dr Beatrice',
        )
        self.assertTrue(sw_msg.exists())

    def test_old_provider_gets_404_and_new_provider_gets_200(self):
        self._run_reassign()

        # Old provider: 404 on the reassigned mother's conversation.
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.provider_a.user))
        old = self.client.get(f'/api/chatbot/conversation/{self.convo.pk}/messages/')
        self.assertEqual(old.status_code, 404,
                         'old provider must lose access on next request')

        # New provider: 200, full history available.
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.provider_b.user))
        new = self.client.get(f'/api/chatbot/conversation/{self.convo.pk}/messages/')
        self.assertEqual(new.status_code, 200)
        self.assertEqual(new.data['id'], self.convo.pk)

    def test_old_provider_no_longer_sees_mother_in_provider_queue(self):
        self._run_reassign()
        self.client.credentials(HTTP_AUTHORIZATION=_bearer(self.provider_a.user))
        resp = self.client.get('/api/chatbot/provider/queue/')
        self.assertEqual(resp.status_code, 200)
        mother_ids = {c['mother_id'] for c in resp.data} if resp.data else set()
        self.assertNotIn(self.mother.id, mother_ids)


# ── 6. assign_unassigned_mothers command ──────────────────────────────
class AssignUnassignedMothersDryRunTests(AssignmentFixtureMixin, TestCase):
    def test_dry_run_reports_without_writing(self):
        # Mother with no provider *and* no Assignment row.
        u = User.objects.create_user(
            phone_number='+255700600001', full_name='Fatuma', user_type='patient',
        )
        PatientProfile.objects.create(user=u, hospital=self.hospital)
        self.assertFalse(Assignment.objects.filter(mother__user=u).exists())

        out = StringIO()
        call_command('assign_unassigned_mothers', '--dry-run', stdout=out)
        report = out.getvalue()
        self.assertIn('DRY RUN', report)
        # No row was written.
        self.assertFalse(Assignment.objects.filter(mother__user=u).exists())
        u.profile.refresh_from_db()
        self.assertIsNone(u.profile.assigned_provider)

    def test_live_run_creates_assignment_for_orphaned_mother(self):
        u = User.objects.create_user(
            phone_number='+255700600002', full_name='Zaituni', user_type='patient',
        )
        PatientProfile.objects.create(user=u, hospital=self.hospital)

        call_command('assign_unassigned_mothers', stdout=StringIO())

        assignment = Assignment.objects.get(mother__user=u)
        # Least-loaded, earliest-registered: provider_a wins the tie.
        self.assertEqual(assignment.provider_id, self.provider_a.pk)
        u.profile.refresh_from_db()
        self.assertEqual(u.profile.assigned_provider_id, self.provider_a.pk)  # dual-write


# ── Test-support: drop the partial unique index so we can INSERT the
#    duplicates the merge command is designed to clean up. TransactionTestCase
#    truncates data between tests, so the index doesn't need re-creating —
#    the test DB is torn down entirely at the end of the class run. ──
def _drop_unique_index_if_exists():
    from django.db import connection
    index = 'unique_active_conversation_per_mother'
    with connection.cursor() as cur:
        try:
            cur.execute(f'DROP INDEX IF EXISTS {index};')
        except Exception:
            # Older sqlite without IF EXISTS — swallow the missing-index case.
            try:
                cur.execute(f'DROP INDEX {index};')
            except Exception:
                pass
