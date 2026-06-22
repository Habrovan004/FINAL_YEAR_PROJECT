from rest_framework.test import APITestCase
from .models import User, OTPCode


class PasswordResetTests(APITestCase):
	def setUp(self):
		self.phone = '0712345678'
		self.user = User.objects.create_user(phone_number=self.phone, full_name='Test User', password='oldpass')

	def test_password_reset_flow(self):
		# Request password reset
		resp = self.client.post('/api/auth/password-reset/request/', {'phone_number': self.phone}, format='json')
		self.assertEqual(resp.status_code, 200)
		otp = OTPCode.objects.filter(user=self.user).last()
		self.assertIsNotNone(otp)

		# Confirm password reset
		resp2 = self.client.post('/api/auth/password-reset/confirm/', {
			'phone_number': self.phone,
			'code': otp.code,
			'new_password': 'newpass123'
		}, format='json')
		self.assertEqual(resp2.status_code, 200)

		# Verify password changed
		self.user.refresh_from_db()
		self.assertTrue(self.user.check_password('newpass123'))

	def test_password_reset_request_rejects_unknown_phone(self):
		resp = self.client.post('/api/auth/password-reset/request/', {'phone_number': '0700000000'}, format='json')
		self.assertEqual(resp.status_code, 404)
		self.assertEqual(resp.data['error'], 'User not found.')

	def test_password_reset_confirm_rejects_invalid_code(self):
		resp = self.client.post('/api/auth/password-reset/confirm/', {
			'phone_number': self.phone,
			'code': '000000',
			'new_password': 'newpass123'
		}, format='json')
		self.assertEqual(resp.status_code, 400)
		self.assertEqual(resp.data['error'], 'Invalid or expired code.')

