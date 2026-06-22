from rest_framework.test import APITestCase
from accounts.models import User
from .models import PatientProfile
from rest_framework_simplejwt.tokens import RefreshToken
from tracking.models import SymptomReport


class SkipOnboardingTests(APITestCase):
	def setUp(self):
		self.phone = '0712345679'
		self.user = User.objects.create_user(phone_number=self.phone, full_name='Patient One', password='pass123')
		# ensure profile exists
		PatientProfile._default_manager.get_or_create(user=self.user)
		tokens = RefreshToken.for_user(self.user)
		self.auth_header = f'Bearer {tokens.access_token}'

	def test_skip_onboarding(self):
		self.client.credentials(HTTP_AUTHORIZATION=self.auth_header)
		resp = self.client.post('/api/patients/skip-onboarding/')
		self.assertEqual(resp.status_code, 200)
		profile = PatientProfile._default_manager.get(user=self.user)
		self.assertTrue(profile.onboarding_completed)

	def test_skip_onboarding_requires_authentication(self):
		resp = self.client.post('/api/patients/skip-onboarding/')
		self.assertEqual(resp.status_code, 401)

	def test_complete_onboarding_logs_initial_symptoms(self):
		self.client.credentials(HTTP_AUTHORIZATION=self.auth_header)
		resp = self.client.post('/api/patients/complete-onboarding/', {
			'pregnancy_status': 'pregnant',
			'weight_kg': 62,
			'height_cm': 165,
			'initial_symptoms': [
				{'name': 'Nausea', 'severity': 'mild'},
			],
			'notifications_enabled': True,
			'audio_guidance': False,
			'font_size': 'medium',
		}, format='json')

		self.assertEqual(resp.status_code, 200)
		profile = PatientProfile._default_manager.get(user=self.user)
		self.assertTrue(profile.onboarding_completed)
		report = SymptomReport.objects.get(patient=self.user)
		self.assertEqual(report.symptoms.count(), 1)
