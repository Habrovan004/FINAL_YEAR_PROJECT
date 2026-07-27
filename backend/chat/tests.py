from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import ProviderProfile, User
from clinical.models import ANCVisit
from hospitals.models import Hospital
from maintenance.models import AuditLog
from patients.models import PatientProfile

from .models import ChatNudge, ChatRoom, Message
from .tasks import send_unread_chat_nudges


def auth_header(user):
    token = RefreshToken.for_user(user)
    return f'Bearer {token.access_token}'


class ChatTestBase(APITestCase):
    """Shared fixtures: one assigned mother/provider pair, plus a second,
    unrelated mother/provider pair for permission-boundary tests. Also mocks
    Africa's Talking globally so no test can make a live SMS call."""

    def setUp(self):
        cache.clear()

        sms_patcher = patch('accounts.sms.sms.send')
        self.mock_sms_send = sms_patcher.start()
        self.addCleanup(sms_patcher.stop)

        self.hospital = Hospital.objects.create(name='Test Hospital')

        self.mother = User.objects.create_user(
            phone_number='+255700000101', full_name='Asha Juma', user_type='patient',
        )
        self.provider_user = User.objects.create_user(
            phone_number='+255700000102', full_name='Dr Kessy', user_type='provider',
        )
        self.provider_profile = ProviderProfile.objects.create(
            user=self.provider_user, hospital=self.hospital, specialization='midwife',
        )
        self.patient_profile = PatientProfile.objects.create(
            user=self.mother, assigned_provider=self.provider_profile,
        )

        # An unrelated mother/provider pair, for cross-account 404 tests.
        self.other_mother = User.objects.create_user(
            phone_number='+255700000201', full_name='Neema Paul', user_type='patient',
        )
        self.other_provider_user = User.objects.create_user(
            phone_number='+255700000202', full_name='Dr Mrema', user_type='provider',
        )
        self.other_provider_profile = ProviderProfile.objects.create(
            user=self.other_provider_user, hospital=self.hospital, specialization='nurse',
        )
        PatientProfile.objects.create(user=self.other_mother, assigned_provider=self.other_provider_profile)

    def login_as(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=auth_header(user))

    def make_room(self, mother=None, provider=None):
        mother = mother or self.mother
        provider = provider or self.provider_user
        return ChatRoom.objects.create(patient=mother, provider=provider)


class LazyRoomCreationTests(ChatTestBase):
    def test_mother_lazily_creates_room_with_her_assigned_provider(self):
        self.login_as(self.mother)
        resp = self.client.post('/api/chat/rooms/')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['patient'], self.mother.id)
        self.assertEqual(resp.data['provider'], self.provider_user.id)
        self.assertEqual(ChatRoom.objects.filter(patient=self.mother, provider=self.provider_user).count(), 1)

    def test_repeated_post_is_idempotent_get_or_create(self):
        self.login_as(self.mother)
        first = self.client.post('/api/chat/rooms/')
        second = self.client.post('/api/chat/rooms/')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(ChatRoom.objects.filter(patient=self.mother).count(), 1)

    def test_mother_without_assigned_provider_gets_400(self):
        unassigned = User.objects.create_user(
            phone_number='+255700000301', full_name='No Provider Yet', user_type='patient',
        )
        PatientProfile.objects.create(user=unassigned, assigned_provider=None)
        self.login_as(unassigned)
        resp = self.client.post('/api/chat/rooms/')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['error'], 'no_provider_assigned')

    def test_provider_creates_room_for_assigned_patient(self):
        self.login_as(self.provider_user)
        resp = self.client.post('/api/chat/rooms/', {'patient_id': self.mother.id}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['patient'], self.mother.id)

    def test_provider_cannot_create_room_for_unassigned_patient(self):
        self.login_as(self.provider_user)
        resp = self.client.post('/api/chat/rooms/', {'patient_id': self.other_mother.id}, format='json')
        self.assertEqual(resp.status_code, 404)


class PermissionTests(ChatTestBase):
    def test_mother_cannot_access_another_mothers_room(self):
        room = self.make_room()
        self.login_as(self.other_mother)
        resp = self.client.get(f'/api/chat/rooms/{room.id}/messages/')
        self.assertEqual(resp.status_code, 404)

    def test_unassigned_provider_cannot_access_a_room_they_are_not_part_of(self):
        room = self.make_room()
        self.login_as(self.other_provider_user)
        resp = self.client.get(f'/api/chat/rooms/{room.id}/messages/')
        self.assertEqual(resp.status_code, 404)

    def test_unassigned_provider_cannot_mark_read_on_a_room_they_are_not_part_of(self):
        room = self.make_room()
        self.login_as(self.other_provider_user)
        resp = self.client.post(f'/api/chat/rooms/{room.id}/mark-read/')
        self.assertEqual(resp.status_code, 404)

    def test_participants_can_access_their_own_room(self):
        room = self.make_room()
        self.login_as(self.mother)
        resp = self.client.get(f'/api/chat/rooms/{room.id}/messages/')
        self.assertEqual(resp.status_code, 200)
        self.login_as(self.provider_user)
        resp = self.client.get(f'/api/chat/rooms/{room.id}/messages/')
        self.assertEqual(resp.status_code, 200)


class CursorPaginationTests(ChatTestBase):
    def test_after_cursor_returns_only_messages_newer_than_cursor(self):
        room = self.make_room()
        m1 = Message.objects.create(room=room, sender=self.mother, text='first')
        m2 = Message.objects.create(room=room, sender=self.provider_user, text='second')

        self.login_as(self.mother)
        resp = self.client.get(f'/api/chat/rooms/{room.id}/messages/?after={m1.id}')
        self.assertEqual(resp.status_code, 200)
        ids = [m['id'] for m in resp.data['results']]
        self.assertEqual(ids, [m2.id])

        m3 = Message.objects.create(room=room, sender=self.provider_user, text='third')
        resp2 = self.client.get(f'/api/chat/rooms/{room.id}/messages/?after={m2.id}')
        ids2 = [m['id'] for m in resp2.data['results']]
        self.assertEqual(ids2, [m3.id])

    def test_initial_load_paginates_with_has_more_and_next_before(self):
        room = self.make_room()
        base = timezone.now() - timedelta(minutes=10)
        for i in range(3):
            # Explicit, strictly-increasing timestamps — auto_now_add alone
            # can produce equal created_at values for rapid-fire creates,
            # which would make the ordering assertion below flaky.
            msg = Message.objects.create(room=room, sender=self.mother, text=f'msg {i}')
            Message.objects.filter(pk=msg.pk).update(created_at=base + timedelta(seconds=i))

        self.login_as(self.mother)
        resp = self.client.get(f'/api/chat/rooms/{room.id}/messages/?limit=2')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['results']), 2)
        self.assertTrue(resp.data['has_more'])
        self.assertIsNotNone(resp.data['next_before'])

        # Chronological order within the page.
        created = [m['id'] for m in resp.data['results']]
        self.assertEqual(created, sorted(created))


class ReadReceiptTests(ChatTestBase):
    def test_fetching_via_after_marks_recipients_unread_messages_as_read(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.mother, text='please read me')
        self.assertIsNone(msg.read_at)

        self.login_as(self.provider_user)
        resp = self.client.get(f'/api/chat/rooms/{room.id}/messages/?after=0')
        self.assertEqual(resp.status_code, 200)

        msg.refresh_from_db()
        self.assertTrue(msg.is_read)
        self.assertIsNotNone(msg.read_at)

    def test_fetching_your_own_sent_message_does_not_mark_it_read(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.mother, text='my own message')

        self.login_as(self.mother)
        self.client.get(f'/api/chat/rooms/{room.id}/messages/?after=0')

        msg.refresh_from_db()
        self.assertFalse(msg.is_read)
        self.assertIsNone(msg.read_at)

    def test_mark_read_endpoint_marks_all_unread_messages_not_sent_by_caller(self):
        room = self.make_room()
        Message.objects.create(room=room, sender=self.mother, text='one')
        Message.objects.create(room=room, sender=self.mother, text='two')

        self.login_as(self.provider_user)
        resp = self.client.post(f'/api/chat/rooms/{room.id}/mark-read/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['marked_read'], 2)
        self.assertEqual(room.messages.filter(read_at__isnull=True).count(), 0)


class VisitCardTests(ChatTestBase):
    def _make_visit(self, patient, provider=None):
        return ANCVisit.objects.create(
            patient=patient,
            provider=provider or self.provider_user,
            weight_kg=60.0,
            blood_pressure_systolic=118,
            blood_pressure_diastolic=76,
            gestational_age_weeks=24,
        )

    def test_provider_can_insert_visit_card_for_their_patient(self):
        room = self.make_room()
        visit = self._make_visit(self.mother)
        self.login_as(self.provider_user)
        resp = self.client.post(
            f'/api/chat/rooms/{room.id}/messages/', {'type': 'visit_card', 'visit_id': visit.id}, format='json',
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['message_type'], 'visit_card')
        self.assertEqual(resp.data['visit_card']['id'], visit.id)
        self.assertEqual(resp.data['visit_card']['risk_level'], visit.risk_level)

    def test_mother_cannot_insert_a_visit_card(self):
        room = self.make_room()
        visit = self._make_visit(self.mother)
        self.login_as(self.mother)
        resp = self.client.post(
            f'/api/chat/rooms/{room.id}/messages/', {'type': 'visit_card', 'visit_id': visit.id}, format='json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_provider_cannot_insert_a_visit_card_belonging_to_a_different_mother(self):
        room = self.make_room()  # mother <-> provider_user
        other_mothers_visit = self._make_visit(self.other_mother, provider=self.other_provider_user)
        self.login_as(self.provider_user)
        resp = self.client.post(
            f'/api/chat/rooms/{room.id}/messages/',
            {'type': 'visit_card', 'visit_id': other_mothers_visit.id}, format='json',
        )
        self.assertEqual(resp.status_code, 404)


class RateLimitTests(ChatTestBase):
    def test_message_send_is_rate_limited_at_30_per_minute(self):
        room = self.make_room()
        self.login_as(self.mother)
        for i in range(30):
            resp = self.client.post(
                f'/api/chat/rooms/{room.id}/messages/', {'type': 'text', 'text': f'msg {i}'}, format='json',
            )
            self.assertEqual(resp.status_code, 201, f'message {i} should succeed')

        resp = self.client.post(
            f'/api/chat/rooms/{room.id}/messages/', {'type': 'text', 'text': 'one too many'}, format='json',
        )
        self.assertEqual(resp.status_code, 429)

    def test_polling_get_requests_are_never_throttled(self):
        room = self.make_room()
        self.login_as(self.mother)
        for _ in range(40):
            resp = self.client.get(f'/api/chat/rooms/{room.id}/messages/?after=0')
            self.assertEqual(resp.status_code, 200)


class UnreadCountTests(ChatTestBase):
    def test_unread_count_sums_across_all_of_the_callers_rooms(self):
        room = self.make_room()
        other_room = ChatRoom.objects.create(patient=self.other_mother, provider=self.provider_user)

        Message.objects.create(room=room, sender=self.mother, text='a')
        Message.objects.create(room=room, sender=self.mother, text='b')
        Message.objects.create(room=other_room, sender=self.other_mother, text='c')

        self.login_as(self.provider_user)
        resp = self.client.get('/api/chat/unread-count/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['unread_count'], 3)

    def test_unread_count_drops_after_mark_read(self):
        room = self.make_room()
        Message.objects.create(room=room, sender=self.mother, text='a')
        Message.objects.create(room=room, sender=self.mother, text='b')

        self.login_as(self.provider_user)
        self.client.post(f'/api/chat/rooms/{room.id}/mark-read/')
        resp = self.client.get('/api/chat/unread-count/')
        self.assertEqual(resp.data['unread_count'], 0)

    def test_unread_count_excludes_the_callers_own_messages(self):
        room = self.make_room()
        Message.objects.create(room=room, sender=self.mother, text='from mother')

        self.login_as(self.mother)
        resp = self.client.get('/api/chat/unread-count/')
        self.assertEqual(resp.data['unread_count'], 0)


class ChatNudgeSmsDedupTests(ChatTestBase):
    """`send_unread_chat_nudges` — Task 5's provider nudge, at most once per
    room per calendar day. Africa's Talking is mocked (see ChatTestBase)."""

    def _stale_unread_message(self, room, minutes_ago=45):
        msg = Message.objects.create(room=room, sender=self.mother, text='unread and old')
        Message.objects.filter(pk=msg.pk).update(created_at=timezone.now() - timedelta(minutes=minutes_ago))
        return msg

    def test_sends_one_nudge_for_a_stale_unread_message(self):
        room = self.make_room()
        self._stale_unread_message(room)

        sent = send_unread_chat_nudges()

        self.assertEqual(sent, 1)
        self.mock_sms_send.assert_called_once()
        body, recipients = self.mock_sms_send.call_args.args
        self.assertIn(self.mother.full_name.split(' ')[0], body)
        self.assertNotIn('unread and old', body)  # never the message content
        self.assertEqual(ChatNudge.objects.filter(room=room, sent_date=timezone.now().date()).count(), 1)

    def test_does_not_nudge_twice_in_the_same_day(self):
        room = self.make_room()
        self._stale_unread_message(room)

        first = send_unread_chat_nudges()
        second = send_unread_chat_nudges()

        self.assertEqual(first, 1)
        self.assertEqual(second, 0)
        self.mock_sms_send.assert_called_once()
        self.assertEqual(ChatNudge.objects.filter(room=room).count(), 1)

    def test_does_not_nudge_for_a_message_younger_than_30_minutes(self):
        room = self.make_room()
        Message.objects.create(room=room, sender=self.mother, text='just sent')

        sent = send_unread_chat_nudges()

        self.assertEqual(sent, 0)
        self.mock_sms_send.assert_not_called()
        self.assertEqual(ChatNudge.objects.count(), 0)

    def test_does_not_nudge_for_an_already_read_message(self):
        room = self.make_room()
        msg = self._stale_unread_message(room)
        msg.read_at = timezone.now()
        msg.is_read = True
        msg.save(update_fields=['read_at', 'is_read'])

        sent = send_unread_chat_nudges()

        self.assertEqual(sent, 0)
        self.mock_sms_send.assert_not_called()

    def test_does_not_nudge_for_a_stale_message_sent_by_the_provider(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.provider_user, text='provider said something')
        Message.objects.filter(pk=msg.pk).update(created_at=timezone.now() - timedelta(minutes=45))

        sent = send_unread_chat_nudges()

        self.assertEqual(sent, 0)
        self.mock_sms_send.assert_not_called()


class InactiveMotherSmsTests(ChatTestBase):
    """Task 5's other SMS path: a provider's reply to a mother inactive 24h+
    triggers a generic, content-free SMS to her."""

    def test_provider_reply_sms_nudges_a_mother_inactive_for_24h(self):
        room = self.make_room()
        self.mother.last_active_at = timezone.now() - timedelta(hours=25)
        self.mother.save(update_fields=['last_active_at'])

        self.login_as(self.provider_user)
        resp = self.client.post(
            f'/api/chat/rooms/{room.id}/messages/',
            {'type': 'text', 'text': 'How are you feeling today?'}, format='json',
        )

        self.assertEqual(resp.status_code, 201)
        self.mock_sms_send.assert_called_once()
        body, recipients = self.mock_sms_send.call_args.args
        self.assertEqual(body, 'Una ujumbe mpya kutoka kwa muuguzi wako kwenye Mimba Yangu.')
        self.assertNotIn('How are you feeling today', body)

    def test_provider_reply_does_not_sms_a_recently_active_mother(self):
        room = self.make_room()
        self.mother.last_active_at = timezone.now()
        self.mother.save(update_fields=['last_active_at'])

        self.login_as(self.provider_user)
        self.client.post(
            f'/api/chat/rooms/{room.id}/messages/', {'type': 'text', 'text': 'hello'}, format='json',
        )

        self.mock_sms_send.assert_not_called()

    def test_mothers_own_message_never_triggers_the_inactivity_sms(self):
        room = self.make_room()
        self.mother.last_active_at = timezone.now() - timedelta(hours=48)
        self.mother.save(update_fields=['last_active_at'])

        self.login_as(self.mother)
        self.client.post(
            f'/api/chat/rooms/{room.id}/messages/', {'type': 'text', 'text': 'hi doctor'}, format='json',
        )

        self.mock_sms_send.assert_not_called()


class MessageDeletionTests(ChatTestBase):
    """POST /api/chat/messages/delete/ — soft delete only, never a physical
    row removal (see Message.deleted_for_everyone / hidden_for)."""

    def test_delete_for_me_hides_only_for_the_requester(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.mother, text='hide me')

        self.login_as(self.provider_user)
        resp = self.client.post(
            '/api/chat/messages/delete/', {'message_ids': [msg.id], 'scope': 'me'}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['deleted'], [msg.id])
        self.assertEqual(resp.data['rejected'], [])
        self.assertTrue(Message.objects.get(pk=msg.id).hidden_for.filter(pk=self.provider_user.pk).exists())

        provider_fetch = self.client.get(f'/api/chat/rooms/{room.id}/messages/?after=0')
        self.assertNotIn(msg.id, [m['id'] for m in provider_fetch.data['results']])

        # The mother (the other participant) is completely unaffected.
        self.login_as(self.mother)
        mother_fetch = self.client.get(f'/api/chat/rooms/{room.id}/messages/?after=0')
        self.assertIn(msg.id, [m['id'] for m in mother_fetch.data['results']])

    def test_delete_for_everyone_within_window_succeeds(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.mother, text='delete me everywhere')

        self.login_as(self.mother)
        resp = self.client.post(
            '/api/chat/messages/delete/', {'message_ids': [msg.id], 'scope': 'everyone'}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['deleted'], [msg.id])
        self.assertEqual(resp.data['rejected'], [])

        msg.refresh_from_db()
        self.assertTrue(msg.deleted_for_everyone)
        self.assertIsNotNone(msg.deleted_at)
        self.assertEqual(msg.deleted_by_id, self.mother.id)
        # Soft delete only — the raw row keeps its content.
        self.assertEqual(msg.text, 'delete me everywhere')

    def test_delete_for_everyone_after_15_minutes_is_rejected(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.mother, text='too old')
        Message.objects.filter(pk=msg.pk).update(created_at=timezone.now() - timedelta(minutes=16))

        self.login_as(self.mother)
        resp = self.client.post(
            '/api/chat/messages/delete/', {'message_ids': [msg.id], 'scope': 'everyone'}, format='json',
        )
        self.assertEqual(resp.data['deleted'], [])
        self.assertEqual(resp.data['rejected'], [{'id': msg.id, 'reason': 'too_old'}])
        self.assertFalse(Message.objects.get(pk=msg.id).deleted_for_everyone)

    def test_delete_for_everyone_on_another_users_message_is_rejected(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.provider_user, text='provider said this')

        self.login_as(self.mother)
        resp = self.client.post(
            '/api/chat/messages/delete/', {'message_ids': [msg.id], 'scope': 'everyone'}, format='json',
        )
        self.assertEqual(resp.data['deleted'], [])
        self.assertEqual(resp.data['rejected'], [{'id': msg.id, 'reason': 'not_own_message'}])

    def test_delete_for_everyone_on_system_message_is_rejected(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=None, message_type='system', text='Care provider changed.')

        self.login_as(self.mother)
        resp = self.client.post(
            '/api/chat/messages/delete/', {'message_ids': [msg.id], 'scope': 'everyone'}, format='json',
        )
        self.assertEqual(resp.data['rejected'], [{'id': msg.id, 'reason': 'system_message'}])

    def test_delete_for_everyone_on_visit_card_is_rejected_even_when_own_and_recent(self):
        room = self.make_room()
        visit = ANCVisit.objects.create(
            patient=self.mother, provider=self.provider_user, weight_kg=60.0,
            blood_pressure_systolic=118, blood_pressure_diastolic=76, gestational_age_weeks=24,
        )
        msg = Message.objects.create(
            room=room, sender=self.provider_user, message_type='visit_card',
            text='ANC visit summary', visit=visit,
        )

        self.login_as(self.provider_user)
        resp = self.client.post(
            '/api/chat/messages/delete/', {'message_ids': [msg.id], 'scope': 'everyone'}, format='json',
        )
        self.assertEqual(resp.data['rejected'], [{'id': msg.id, 'reason': 'visit_card_not_deletable_for_everyone'}])

    def test_mixed_batch_returns_per_id_results(self):
        room = self.make_room()
        own_recent = Message.objects.create(room=room, sender=self.mother, text='own recent')
        not_mine = Message.objects.create(room=room, sender=self.provider_user, text='not mine')

        self.login_as(self.mother)
        resp = self.client.post(
            '/api/chat/messages/delete/',
            {'message_ids': [own_recent.id, not_mine.id], 'scope': 'everyone'}, format='json',
        )
        self.assertEqual(resp.data['deleted'], [own_recent.id])
        self.assertEqual(resp.data['rejected'], [{'id': not_mine.id, 'reason': 'not_own_message'}])

    def test_serializer_never_returns_deleted_content(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.mother, text='secret content')
        Message.objects.filter(pk=msg.pk).update(
            deleted_for_everyone=True, deleted_at=timezone.now(), deleted_by=self.mother,
        )

        self.login_as(self.provider_user)
        resp = self.client.get(f'/api/chat/rooms/{room.id}/messages/?after=0')
        [payload] = resp.data['results']
        self.assertEqual(payload['message_type'], 'deleted')
        self.assertEqual(payload['text'], '')
        self.assertNotIn(b'secret content', resp.content)

    def test_polling_propagates_deletion_to_the_other_participant(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.mother, text='will be deleted')

        # Provider already fetched this message once (simulating it already
        # being in their local state before the deletion happens).
        self.login_as(self.provider_user)
        first_fetch = self.client.get(f'/api/chat/rooms/{room.id}/messages/?after=0')
        self.assertIn(msg.id, [m['id'] for m in first_fetch.data['results']])

        self.login_as(self.mother)
        self.client.post(
            '/api/chat/messages/delete/', {'message_ids': [msg.id], 'scope': 'everyone'}, format='json',
        )

        # Provider polls again with a cursor already past this message's id
        # (no new messages) — deleted_ids is what surfaces the change.
        self.login_as(self.provider_user)
        second_fetch = self.client.get(f'/api/chat/rooms/{room.id}/messages/?after={msg.id}')
        self.assertEqual(second_fetch.data['results'], [])
        self.assertIn(msg.id, second_fetch.data['deleted_ids'])

    def test_permissions_404_for_non_member(self):
        room = self.make_room()  # mother <-> provider_user only
        msg = Message.objects.create(room=room, sender=self.mother, text='not yours')

        self.login_as(self.other_provider_user)
        resp = self.client.post(
            '/api/chat/messages/delete/', {'message_ids': [msg.id], 'scope': 'me'}, format='json',
        )
        # Never a blanket 404 — a batch endpoint reports per-id, enumeration-
        # safe, exactly like every other object-level check in this app.
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['deleted'], [])
        self.assertEqual(resp.data['rejected'], [{'id': msg.id, 'reason': 'not_found'}])

    def test_audit_row_written_on_successful_deletion(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.mother, text='audit me')

        self.login_as(self.mother)
        self.client.post(
            '/api/chat/messages/delete/', {'message_ids': [msg.id], 'scope': 'everyone'}, format='json',
        )

        log = AuditLog.objects.filter(event_type='chat_msg_delete', user=self.mother).first()
        self.assertIsNotNone(log)
        self.assertIn(str(msg.id), log.description)
        self.assertIn('everyone', log.description)

    def test_no_audit_row_when_nothing_was_actually_deleted(self):
        room = self.make_room()
        msg = Message.objects.create(room=room, sender=self.provider_user, text='not mine')

        self.login_as(self.mother)
        self.client.post(
            '/api/chat/messages/delete/', {'message_ids': [msg.id], 'scope': 'everyone'}, format='json',
        )

        self.assertFalse(AuditLog.objects.filter(event_type='chat_msg_delete').exists())
