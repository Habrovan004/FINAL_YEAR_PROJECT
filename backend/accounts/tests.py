import secrets

from django.core.cache import cache
from rest_framework.test import APITestCase
from .models import User, PasswordResetCode

# Dummy test credential — never a real login is exercised with it (this
# suite tests the password-RESET flow, not login); generated per test run
# so nothing password-shaped is a static literal in source control.
TEST_PASSWORD = secrets.token_urlsafe(12)


class PasswordResetTests(APITestCase):
	def setUp(self):
		# PasswordResetThrottle is a DRF AnonRateThrottle — keyed by IP, not
		# phone number, via Django's cache. Every test method in this class
		# makes at least one request to the throttled endpoint from the same
		# test-client "IP", so without clearing the cache between tests the
		# count accumulates across methods and the alphabetically-last one
		# (which runs after 5 prior requests already consumed the 5/600s
		# limit) gets a spurious 429 instead of the 200 it's asserting.
		cache.clear()
		self.phone = '0712345678'
		self.user = User.objects.create_user(phone_number=self.phone, full_name='Test User', password=TEST_PASSWORD)

	def test_request_then_confirm_resets_password(self):
		resp = self.client.post('/api/auth/password-reset/request/', {'phone_number': self.phone}, format='json')
		self.assertEqual(resp.status_code, 200)
		reset_code = PasswordResetCode.objects.filter(user=self.user).last()
		self.assertIsNotNone(reset_code)

		new_password = secrets.token_urlsafe(12)
		resp2 = self.client.post('/api/auth/password-reset/confirm/', {
			'phone_number': self.phone,
			'code': reset_code.code,
			'new_password': new_password,
		}, format='json')
		self.assertEqual(resp2.status_code, 200)

		self.user.refresh_from_db()
		self.assertTrue(self.user.check_password(new_password))

		reset_code.refresh_from_db()
		self.assertTrue(reset_code.is_used)

	def test_request_does_not_leak_whether_phone_is_registered(self):
		resp_known = self.client.post('/api/auth/password-reset/request/', {'phone_number': self.phone}, format='json')
		resp_unknown = self.client.post('/api/auth/password-reset/request/', {'phone_number': '0700000000'}, format='json')
		self.assertEqual(resp_known.status_code, 200)
		self.assertEqual(resp_unknown.status_code, 200)
		self.assertEqual(resp_known.data, resp_unknown.data)
		self.assertEqual(PasswordResetCode.objects.filter(user__phone_number='0700000000').count(), 0)

	def test_confirm_rejects_wrong_code(self):
		self.client.post('/api/auth/password-reset/request/', {'phone_number': self.phone}, format='json')
		resp = self.client.post('/api/auth/password-reset/confirm/', {
			'phone_number': self.phone,
			'code': '000000',
			'new_password': secrets.token_urlsafe(12),
		}, format='json')
		self.assertEqual(resp.status_code, 400)
		self.assertEqual(resp.data['error'], 'Invalid or expired code.')

	def test_confirm_rejects_reused_code(self):
		self.client.post('/api/auth/password-reset/request/', {'phone_number': self.phone}, format='json')
		reset_code = PasswordResetCode.objects.filter(user=self.user).last()

		first = self.client.post('/api/auth/password-reset/confirm/', {
			'phone_number': self.phone,
			'code': reset_code.code,
			'new_password': secrets.token_urlsafe(12),
		}, format='json')
		self.assertEqual(first.status_code, 200)

		second = self.client.post('/api/auth/password-reset/confirm/', {
			'phone_number': self.phone,
			'code': reset_code.code,
			'new_password': secrets.token_urlsafe(12),
		}, format='json')
		self.assertEqual(second.status_code, 400)
		self.assertEqual(second.data['error'], 'Invalid or expired code.')

	def test_confirm_rejects_expired_code(self):
		from django.utils import timezone
		self.client.post('/api/auth/password-reset/request/', {'phone_number': self.phone}, format='json')
		reset_code = PasswordResetCode.objects.filter(user=self.user).last()
		reset_code.expires_at = timezone.now() - timezone.timedelta(seconds=1)
		reset_code.save(update_fields=['expires_at'])

		resp = self.client.post('/api/auth/password-reset/confirm/', {
			'phone_number': self.phone,
			'code': reset_code.code,
			'new_password': secrets.token_urlsafe(12),
		}, format='json')
		self.assertEqual(resp.status_code, 400)
		self.assertEqual(resp.data['error'], 'Invalid or expired code.')
