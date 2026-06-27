from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import PatientProfile, BabyGrowth, ANCMilestone
from .serializers import PatientProfileSerializer, BabyGrowthSerializer, ANCMilestoneSerializer
from tips.models import Tip
from tips.serializers import TipSerializer
from tracking.models import MoodLog, Symptom, SymptomReport
from appointments.models import Appointment
from accounts.models import User
from accounts.serializers import UserSerializer
from clinical.models import ANCVisit
from clinical.serializers import ANCVisitSerializer
from django.db.models import Q
from datetime import date
import random
import json
from .utils import assign_provider_to_mother

@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile(request):
    """
    Onboarding Screen 1 & Profile Management.
    Saves pregnancy_status to personalize the entire app experience.
    When hospital is selected, marks onboarding as complete.
    """
    profile, _ = PatientProfile.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        return Response(PatientProfileSerializer(profile).data)

    serializer = PatientProfileSerializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        
        if 'hospital' in request.data or 'hospital_id' in request.data:
            profile.onboarding_completed = True
            profile.save()

        if profile.pregnancy_status == 'pregnant' and profile.onboarding_completed:
            assign_provider_to_mother(profile)
                
        return Response(PatientProfileSerializer(profile).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_onboarding(request):
    """
    Finalizes the onboarding process by saving all health and preference data.
    """
    profile, _ = PatientProfile.objects.get_or_create(user=request.user)
    data = request.data

    # Update profile fields
    profile.pregnancy_status = data.get('pregnancy_status', profile.pregnancy_status)
    profile.lmp_date = data.get('lmp_date') or profile.lmp_date
    profile.due_date = data.get('due_date') or profile.due_date
    profile.is_first_pregnancy = data.get('is_first_pregnancy', profile.is_first_pregnancy)
    profile.previous_pregnancies = data.get('previous_pregnancies', profile.previous_pregnancies)
    profile.previous_complications = data.get('previous_complications', profile.previous_complications)
    profile.weight_kg = data.get('weight_kg', profile.weight_kg)
    profile.height_cm = data.get('height_cm', profile.height_cm)
    profile.hospital_id = data.get('hospital_id', profile.hospital_id)
    profile.language = data.get('language', profile.language)
    profile.notifications_enabled = data.get('notifications_enabled', profile.notifications_enabled)
    profile.audio_guidance = data.get('audio_guidance', profile.audio_guidance)
    profile.font_size = data.get('font_size', profile.font_size)
    profile.onboarding_completed = True
    profile.save()

    # Log initial symptoms if provided
    initial_symptoms = data.get('initial_symptoms', [])
    if initial_symptoms:
        report = SymptomReport.objects.create(
            patient=request.user,
            additional_notes=json.dumps({
                'source': 'onboarding',
                'symptoms': initial_symptoms,
            })
        )
        symptom_records = []
        for sym in initial_symptoms:
            name = sym.get('name')
            if not name:
                continue
            symptom, _ = Symptom.objects.get_or_create(name=name)
            symptom_records.append(symptom)
        report.symptoms.set(symptom_records)
        report.evaluate_risk()
        report.save()

    # Assign provider if pregnant
    if profile.pregnancy_status == 'pregnant':
        assign_provider_to_mother(profile)

    return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pregnancy_info(request):
    profile, _ = PatientProfile.objects.get_or_create(user=request.user)
    return Response({
        'week': profile.pregnancy_week(),
        'trimester': profile.trimester(),
        'lmp_date': profile.lmp_date,
        'due_date': profile.due_date,
        'status': profile.pregnancy_status,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    profile, _ = PatientProfile.objects.get_or_create(user=request.user)

    growth = None
    if profile.pregnancy_status == 'pregnant':
        week = profile.pregnancy_week()
        growth = BabyGrowth.objects.filter(week=week).first()

    trimester_val = profile.trimester()[0] if profile.trimester() != 'Not Pregnant' else 'all'
    tips = Tip.objects.filter(Q(trimester=trimester_val) | Q(trimester='all'), is_daily=True)
    daily_tip = random.choice(tips) if tips.exists() else None

    return Response({
        'user_name': request.user.full_name,
        'pregnancy_info': {
            'week': profile.pregnancy_week() if profile.pregnancy_status == 'pregnant' else 0,
            'trimester': profile.trimester(),
            'status': profile.pregnancy_status
        },
        'baby_growth': BabyGrowthSerializer(growth).data if growth else None,
        'daily_tip': TipSerializer(daily_tip).data if daily_tip else None,
        'notifications_count': 0
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def skip_onboarding(request):
    profile, _ = PatientProfile.objects.get_or_create(user=request.user)
    profile.onboarding_completed = True
    profile.save()
    return Response(PatientProfileSerializer(profile).data)


def _summarize_patient(profile: PatientProfile) -> dict:
    """Slim patient summary for the provider's patient list."""
    latest = ANCVisit.objects.filter(patient=profile.user).order_by('-visit_date').first()
    latest_symptom = SymptomReport.objects.filter(patient=profile.user).order_by('-created_at').first()
    # Effective risk = max(latest ANC visit risk, latest symptom report risk)
    levels = {'low': 0, 'medium': 1, 'high': 2}
    effective = 'low'
    for r in (latest.risk_level if latest else None, latest_symptom.risk_level if latest_symptom else None):
        if r and levels.get(r, 0) > levels.get(effective, 0):
            effective = r

    return {
        'id': profile.user_id,
        'full_name': profile.user.full_name,
        'phone_number': profile.user.phone_number,
        'date_of_birth': profile.user.date_of_birth,
        'pregnancy_status': profile.pregnancy_status,
        'gestational_age_weeks': profile.pregnancy_week(),
        'trimester': profile.trimester(),
        'lmp_date': profile.lmp_date,
        'due_date': profile.due_date,
        'hospital': profile.hospital.name if profile.hospital else None,
        'assigned_provider': profile.assigned_provider.user.full_name if profile.assigned_provider else None,
        'last_visit_date': latest.visit_date if latest else None,
        'risk_level': effective,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_list(request):
    """
    Provider-scoped patient list with filters.
    Query params:
      ?search=<name or phone>
      ?risk=low|medium|high
      ?min_week=<int>
      ?max_week=<int>
    """
    if request.user.user_type != 'provider':
        return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    provider_profile = getattr(request.user, 'provider_profile', None)
    if not provider_profile:
        return Response({'error': 'Provider profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    qs = PatientProfile.objects.filter(assigned_provider=provider_profile).select_related('user', 'hospital')

    search = (request.query_params.get('search') or '').strip()
    if search:
        qs = qs.filter(
            Q(user__full_name__icontains=search)
            | Q(user__phone_number__icontains=search)
        )

    summaries = [_summarize_patient(p) for p in qs]

    risk = request.query_params.get('risk')
    if risk in ('low', 'medium', 'high'):
        summaries = [s for s in summaries if s['risk_level'] == risk]

    min_week = request.query_params.get('min_week')
    max_week = request.query_params.get('max_week')
    if min_week is not None and min_week != '':
        try:
            mw = int(min_week)
            summaries = [s for s in summaries if (s['gestational_age_weeks'] or 0) >= mw]
        except ValueError:
            pass
    if max_week is not None and max_week != '':
        try:
            xw = int(max_week)
            summaries = [s for s in summaries if (s['gestational_age_weeks'] or 0) <= xw]
        except ValueError:
            pass

    return Response(summaries)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_detail(request, patient_id):
    """Full patient view: profile + visit history. Provider-scoped."""
    try:
        patient_user = User.objects.get(pk=patient_id, user_type='patient')
    except User.DoesNotExist:
        return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

    profile = getattr(patient_user, 'profile', None)
    if not profile:
        return Response({'error': 'Patient has no profile.'}, status=status.HTTP_404_NOT_FOUND)

    if request.user.user_type == 'provider':
        provider_profile = getattr(request.user, 'provider_profile', None)
        if profile.assigned_provider_id != getattr(provider_profile, 'id', None):
            return Response({'error': 'This patient is not assigned to you.'},
                            status=status.HTTP_403_FORBIDDEN)
    elif request.user != patient_user:
        return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    visits = ANCVisit.objects.filter(patient=patient_user).order_by('-visit_date')
    return Response({
        'summary': _summarize_patient(profile),
        'profile': PatientProfileSerializer(profile).data,
        'visits': ANCVisitSerializer(visits, many=True).data,
    })
