from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Prescription, MedicationReminder
from .serializers import PrescriptionSerializer, MedicationReminderSerializer
from datetime import datetime, timedelta

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def prescription_list(request):
    """
    POST: Create a new prescription (Providers only). Generates reminders.
    GET: List active prescriptions for the patient.
    """
    if request.method == 'POST':
        if request.user.user_type != 'provider':
            return Response({'error': 'Only healthcare providers can issue prescriptions.'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = PrescriptionSerializer(data=request.data)
        if serializer.is_valid():
            prescription = serializer.save(provider=request.user)
            
            # Auto-generate reminders based on frequency and duration
            _generate_reminders(prescription)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # GET for patients
    prescriptions = Prescription.objects.filter(patient=request.user, is_active=True)
    if request.user.user_type == 'provider':
        patient_id = request.query_params.get('patient_id')
        if patient_id:
            prescriptions = Prescription.objects.filter(patient_id=patient_id)
            
    serializer = PrescriptionSerializer(prescriptions, many=True)
    return Response(serializer.data)

def _generate_reminders(prescription):
    """
    Internal helper to schedule reminders for a new prescription.
    """
    days = prescription.duration_days
    times_per_day = int(prescription.frequency) if prescription.frequency.isdigit() else 1
    
    start_dt = datetime.combine(prescription.start_date, datetime.min.time())
    
    for day in range(days):
        for time_idx in range(times_per_day):
            # Simple logic: distribute doses across the day
            # e.g., if 2 times/day, take at 8 AM and 8 PM
            hour = 8 + (time_idx * (12 // times_per_day))
            scheduled_time = start_dt + timedelta(days=day, hours=hour)
            
            MedicationReminder.objects.create(
                prescription=prescription,
                scheduled_time=scheduled_time
            )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def acknowledge_reminder(request, reminder_id):
    """
    Allow the mother to confirm she has taken her medication.
    """
    try:
        reminder = MedicationReminder.objects.get(pk=reminder_id, prescription__patient=request.user)
        reminder.is_acknowledged = True
        reminder.save()
        return Response({'status': 'acknowledged'})
    except MedicationReminder.DoesNotExist:
        return Response({'error': 'Reminder not found.'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def compliance_report(request, patient_id):
    """
    Module 9: Compliance Overview for Providers.
    """
    if request.user.user_type != 'provider':
        return Response({'error': 'Unauthorized'}, status=403)
        
    reminders = MedicationReminder.objects.filter(
        prescription__patient_id=patient_id, 
        scheduled_time__lte=datetime.now()
    )
    
    total = reminders.count()
    taken = reminders.filter(is_acknowledged=True).count()
    compliance_rate = (taken / total * 100) if total > 0 else 0
    
    return Response({
        'total_reminders': total,
        'taken_count': taken,
        'compliance_rate': round(compliance_rate, 2),
        'missed_reminders': MedicationReminderSerializer(reminders.filter(is_acknowledged=False), many=True).data
    })
