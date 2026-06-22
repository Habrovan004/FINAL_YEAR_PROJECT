from datetime import datetime, timedelta
from .models import Appointment

# This would be imported from a separate SMS utility
# from utils.sms_service import send_sms

def check_and_send_reminders():
    """
    Module 4: Background task to check and send SMS reminders.
    Typically run by Celery Beat every hour.
    """
    now = datetime.now()
    
    # 1. Check for 48-hour reminders
    target_48h = now + timedelta(hours=48)
    upcoming_48h = Appointment.objects.filter(
        appointment_date=target_48h.date(),
        status='upcoming',
        reminder_48h_sent=False
    )
    
    for appt in upcoming_48h:
        # send_sms(appt.user.phone_number, f"Mimba Yangu: Reminder of your visit on {appt.appointment_date} at {appt.appointment_time}")
        appt.reminder_48h_sent = True
        appt.save()

    # 2. Check for 2-hour reminders
    target_2h = now + timedelta(hours=2)
    upcoming_2h = Appointment.objects.filter(
        appointment_date=target_2h.date(),
        status='upcoming',
        reminder_2h_sent=False
    )
    
    for appt in upcoming_2h:
        # send_sms(appt.user.phone_number, f"Mimba Yangu: Your visit is in 2 hours at {appt.hospital.name}")
        appt.reminder_2h_sent = True
        appt.save()

def handle_missed_appointments():
    """
    Identify appointments that were past their date/time and still 'upcoming'.
    """
    past_due = Appointment.objects.filter(
        appointment_date__lt=datetime.now().date(),
        status='upcoming'
    )
    
    for appt in past_due:
        appt.status = 'missed'
        appt.save()
        # Integrate with Clinical Recommendation Engine
        # patient_profile = appt.user.profile
        # generate_follow_up_recommendation(patient_profile)
