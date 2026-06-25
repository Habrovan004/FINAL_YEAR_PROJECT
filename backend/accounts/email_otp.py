"""Email OTP delivery — alternative to SMS for accounts that registered an email."""
from django.conf import settings
from django.core.mail import send_mail


def send_otp_email(email: str, otp_code: str, purpose: str = 'verification') -> None:
    """Send the 6-digit OTP to the user's email. Raises on failure."""
    if not email:
        raise ValueError('No email address on file.')
    subject_map = {
        'verification': 'Mimba Yangu — Verify your account',
        'password_reset': 'Mimba Yangu — Password reset code',
    }
    subject = subject_map.get(purpose, 'Mimba Yangu — Your code')
    body = (
        f"Habari,\n\n"
        f"Your Mimba Yangu code is: {otp_code}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you did not request this, you can safely ignore this email.\n"
    )
    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )
