from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import MoodLog, Symptom, SymptomReport
from .serializers import MoodLogSerializer, SymptomSerializer
from .utils import assess_clinical_risk
from datetime import date, timedelta
from django.db.models import Avg

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def mood_logs(request):
    if request.method == 'POST':
        log, created = MoodLog.objects.update_or_create(
            user=request.user,
            date=date.today(),
            defaults={
                'mood': request.data.get('mood'),
                'symptoms': request.data.get('symptoms', []),
                'notes': request.data.get('notes', ''),
                'weight_kg': request.data.get('weight_kg'),
                'baby_kicks': request.data.get('baby_kicks'),
            }
        )
        serializer = MoodLogSerializer(log)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    logs = MoodLog.objects.filter(user=request.user)
    return Response(MoodLogSerializer(logs, many=True).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def timeline(request):
    """
    Returns health history timeline including weight and mood charts.
    Required for the frontend 'Timeline' page.
    """
    logs = MoodLog.objects.filter(user=request.user).order_by('date')
    
    # Mood history (last 7 days)
    seven_days = date.today() - timedelta(days=7)
    mood_history = logs.filter(date__gte=seven_days)
    
    # Weight history (all time for chart)
    weight_history = logs.exclude(weight_kg__isnull=True).values('date', 'weight_kg')
    
    return Response({
        'mood_logs': MoodLogSerializer(mood_history, many=True).data,
        'weight_history': list(weight_history),
        'summary': {
            'avg_mood': logs.aggregate(Avg('mood'))['mood__avg'],
            'last_weight': logs.exclude(weight_kg__isnull=True).first().weight_kg if logs.exclude(weight_kg__isnull=True).exists() else None
        }
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_symptom_report(request):
    """
    Module 3: Formal Symptom Reporting with Risk Assessment
    """
    symptom_ids = request.data.get('symptom_ids', [])
    notes = request.data.get('notes', '')
    
    if not symptom_ids:
        return Response({'error': 'No symptoms selected.'}, status=400)
    
    selected_symptoms = Symptom.objects.filter(id__in=symptom_ids)
    risk_level, recommendation = assess_clinical_risk(selected_symptoms)
    
    report = SymptomReport.objects.create(
        patient=request.user,
        additional_notes=notes,
        risk_level=risk_level,
        clinical_recommendation=recommendation
    )
    report.symptoms.set(selected_symptoms)
    
    if risk_level == 'high':
        # logic for provider notification
        pass
        
    return Response({
        'id': report.id,
        'risk_level': risk_level,
        'recommendation': recommendation,
        'created_at': report.created_at
    }, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def provider_patient_reports(request, patient_id):
    if request.user.user_type != 'provider':
        return Response({'error': 'Unauthorized'}, status=403)
        
    reports = SymptomReport.objects.filter(patient_id=patient_id)
    return Response([{
        'id': r.id,
        'risk_level': r.risk_level,
        'symptoms': [s.name for s in r.symptoms.all()],
        'notes': r.additional_notes,
        'is_reviewed': r.is_reviewed,
        'created_at': r.created_at
    } for r in reports])

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def symptom_list(request):
    symptoms = Symptom.objects.all()
    return Response(SymptomSerializer(symptoms, many=True).data)
