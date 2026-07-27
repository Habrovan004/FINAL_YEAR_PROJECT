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
from accounts.models import User, ProviderProfile
from accounts.serializers import UserSerializer
from clinical.models import ANCVisit
from clinical.serializers import ANCVisitSerializer
from django.db.models import Q, F
from django.db import transaction as db_transaction
from django.utils import timezone
from datetime import date
import random
import json
from .utils import assign_provider_to_mother
from .permissions import get_patient_or_404
from chat.models import Message

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

        if profile.pregnancy_status == 'pregnant' and profile.onboarding_completed and not profile.assigned_provider:
            provider = assign_provider_to_mother(profile)
            if provider:
                profile.assigned_provider = provider
                profile.save()

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
    if profile.pregnancy_status == 'pregnant' and not profile.assigned_provider:
        provider = assign_provider_to_mother(profile)
        if provider:
            profile.assigned_provider = provider
            profile.save()

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
    # Same tip for the same user on the same day — stable across refreshes
    rng = random.Random(f"{request.user.id}-{date.today().isoformat()}")
    daily_tip = rng.choice(list(tips)) if tips.exists() else None

    unread_count = Message.objects.filter(
        room__patient=request.user,
        is_read=False,
    ).exclude(sender=request.user).count()

    last_mood = MoodLog.objects.filter(user=request.user).order_by('-logged_at').first()

    # Only a confirmed appointment is shown here — a still-pending request
    # isn't a commitment yet, so it'd be misleading in a "next appointment" banner.
    next_appt = Appointment.objects.filter(
        user=request.user, status='upcoming', appointment_date__gte=date.today(),
    ).order_by('appointment_date', 'appointment_time').first()

    return Response({
        'user_name': request.user.full_name,
        'pregnancy_info': {
            'week': profile.pregnancy_week() if profile.pregnancy_status == 'pregnant' else 0,
            'trimester': profile.trimester(),
            'status': profile.pregnancy_status
        },
        'baby_growth': BabyGrowthSerializer(growth).data if growth else None,
        'daily_tip': TipSerializer(daily_tip).data if daily_tip else None,
        'health_status': {
            'mood_label': last_mood.get_mood_display() if last_mood else None,
            'logged_at': last_mood.logged_at.isoformat() if last_mood else None,
        },
        'next_appointment': {
            'date': next_appt.appointment_date.isoformat(),
            'visit_type': next_appt.get_visit_type_display(),
        } if next_appt else None,
        'notifications_count': unread_count,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def skip_onboarding(request):
    profile, _ = PatientProfile.objects.get_or_create(user=request.user)
    profile.onboarding_completed = True
    profile.save()
    return Response(PatientProfileSerializer(profile).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def baby_growth(request):
    """
    Returns baby-growth data. Without `?week=`, returns every seeded week so the
    BabyGrowthPage can power its slider client-side. With `?week=N`, returns the
    single closest-week row plus the requested week echoed back, so callers can
    tell when they got an approximation vs an exact match.
    """
    week_param = request.query_params.get('week')
    rows = BabyGrowth.objects.all().order_by('week')

    if week_param is None:
        return Response(BabyGrowthSerializer(rows, many=True).data)

    try:
        requested = int(week_param)
    except (TypeError, ValueError):
        return Response({'error': 'week must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

    if not rows.exists():
        return Response({'requested_week': requested, 'match': None})

    closest = min(rows, key=lambda r: abs(r.week - requested))
    return Response({
        'requested_week': requested,
        'match': BabyGrowthSerializer(closest).data,
        'is_exact': closest.week == requested,
    })


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

    Uses 3 DB queries total regardless of patient count (was 2N+1).
    """
    if request.user.user_type != 'provider':
        return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    provider_profile = getattr(request.user, 'provider_profile', None)
    if not provider_profile:
        return Response({'error': 'Provider profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Query 1: all profiles for this provider (text search applied at DB level)
    qs = (
        PatientProfile.objects
        .filter(assigned_provider=provider_profile)
        .select_related('user', 'hospital', 'assigned_provider__user')
    )
    search = (request.query_params.get('search') or '').strip()
    if search:
        qs = qs.filter(
            Q(user__full_name__icontains=search)
            | Q(user__phone_number__icontains=search)
        )

    profiles = list(qs)
    if not profiles:
        return Response([])

    patient_ids = [p.user_id for p in profiles]

    # Query 2: latest ANC visit per patient — order newest-first, deduplicate in Python
    latest_visits: dict = {}
    for v in (
        ANCVisit.objects
        .filter(patient_id__in=patient_ids)
        .order_by('-visit_date')
        .values('patient_id', 'risk_level', 'visit_date')
    ):
        if v['patient_id'] not in latest_visits:
            latest_visits[v['patient_id']] = v

    # Query 3: latest symptom report per patient
    latest_symptoms: dict = {}
    for r in (
        SymptomReport.objects
        .filter(patient_id__in=patient_ids)
        .order_by('-created_at')
        .values('patient_id', 'risk_level')
    ):
        if r['patient_id'] not in latest_symptoms:
            latest_symptoms[r['patient_id']] = r

    RISK_RANK = {'low': 0, 'medium': 1, 'high': 2}

    summaries = []
    for p in profiles:
        uid = p.user_id
        lv = latest_visits.get(uid)
        ls = latest_symptoms.get(uid)
        effective_risk = max(
            lv['risk_level'] if lv else 'low',
            ls['risk_level'] if ls else 'low',
            key=lambda r: RISK_RANK.get(r, 0),
        )
        summaries.append({
            'id': uid,
            'full_name': p.user.full_name,
            'phone_number': p.user.phone_number,
            'date_of_birth': p.user.date_of_birth,
            'pregnancy_status': p.pregnancy_status,
            'gestational_age_weeks': p.pregnancy_week(),
            'trimester': p.trimester(),
            'lmp_date': p.lmp_date,
            'due_date': p.due_date,
            'hospital': p.hospital.name if p.hospital else None,
            'assigned_provider': p.assigned_provider.user.full_name if p.assigned_provider else None,
            'last_visit_date': lv['visit_date'] if lv else None,
            'risk_level': effective_risk,
        })

    # Apply risk and gestational-age filters (data already in memory — no extra queries)
    risk = request.query_params.get('risk')
    if risk in ('low', 'medium', 'high'):
        summaries = [s for s in summaries if s['risk_level'] == risk]

    min_week = request.query_params.get('min_week')
    max_week = request.query_params.get('max_week')
    if min_week:
        try:
            summaries = [s for s in summaries if (s['gestational_age_weeks'] or 0) >= int(min_week)]
        except ValueError:
            pass
    if max_week:
        try:
            summaries = [s for s in summaries if (s['gestational_age_weeks'] or 0) <= int(max_week)]
        except ValueError:
            pass

    return Response(summaries)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_detail(request, patient_id):
    """Full patient view: profile + visit history. Provider-scoped."""
    if request.user.user_type == 'provider':
        # 404 (not 403) for a patient not assigned to this provider, so
        # patient IDs belonging to other providers can't be enumerated.
        patient_user = get_patient_or_404(request, patient_id)
    else:
        try:
            patient_user = User.objects.get(pk=patient_id, user_type='patient')
        except User.DoesNotExist:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.user != patient_user:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    profile = getattr(patient_user, 'profile', None)
    if not profile:
        return Response({'error': 'Patient has no profile.'}, status=status.HTTP_404_NOT_FOUND)

    visits = ANCVisit.objects.filter(patient=patient_user).order_by('-visit_date')
    return Response({
        'summary': _summarize_patient(profile),
        'profile': PatientProfileSerializer(profile).data,
        'visits': ANCVisitSerializer(visits, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_providers_for_reassignment(request, patient_id):
    """Providers at the mother's hospital she could be reassigned to (excludes
    her current provider). Used to populate the reassignment picker."""
    if request.user.user_type != 'provider':
        return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    patient_user = get_patient_or_404(request, patient_id)
    profile = getattr(patient_user, 'profile', None)
    if not profile:
        return Response({'error': 'Patient has no profile.'}, status=status.HTTP_404_NOT_FOUND)

    qs = ProviderProfile.objects.filter(is_available=True).select_related('user', 'hospital')
    if profile.hospital_id:
        qs = qs.filter(hospital_id=profile.hospital_id)
    if profile.assigned_provider_id:
        qs = qs.exclude(pk=profile.assigned_provider_id)

    return Response([{
        'id': p.id,
        'full_name': p.user.full_name,
        'specialization': p.get_specialization_display(),
        'current_workload': p.current_workload,
        'max_workload': p.max_workload,
    } for p in qs])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reassign_patient(request, patient_id):
    """Reassign a mother to a different provider. Transfers her active
    chatbot conversation (if any) with history intact, and drops a system
    message in that thread noting the change and date.
    """
    if request.user.user_type != 'provider':
        return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    # 404s if the requesting provider isn't the mother's *current* provider —
    # only the provider currently responsible for her can hand her off.
    patient_user = get_patient_or_404(request, patient_id)
    profile = getattr(patient_user, 'profile', None)
    if not profile:
        return Response({'error': 'Patient has no profile.'}, status=status.HTTP_404_NOT_FOUND)

    new_provider_id = request.data.get('new_provider_id')
    if not new_provider_id:
        return Response({'error': 'new_provider_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        new_provider_profile = ProviderProfile.objects.select_related('user').get(pk=new_provider_id)
    except ProviderProfile.DoesNotExist:
        return Response({'error': 'Provider not found.'}, status=status.HTTP_404_NOT_FOUND)

    old_provider_profile = profile.assigned_provider
    if old_provider_profile and old_provider_profile.id == new_provider_profile.id:
        return Response({'error': 'Patient is already assigned to this provider.'},
                        status=status.HTTP_400_BAD_REQUEST)

    with db_transaction.atomic():
        profile.assigned_provider = new_provider_profile
        profile.save(update_fields=['assigned_provider'])

        if old_provider_profile:
            ProviderProfile.objects.filter(pk=old_provider_profile.id).update(
                current_workload=F('current_workload') - 1
            )
        ProviderProfile.objects.filter(pk=new_provider_profile.id).update(
            current_workload=F('current_workload') + 1
        )

        # Transfer the active chatbot conversation, if one exists, and note
        # the change in the thread — for both the old and new provider, and
        # for the mother, since it's the same shared message history.
        from chatbot.models import Conversation, Message as ChatMessage

        convo = (
            Conversation.objects
            .filter(mother=patient_user, is_active=True)
            .order_by('-updated_at')
            .first()
        )
        if convo:
            convo.provider = new_provider_profile.user
            convo.save(update_fields=['provider', 'updated_at'])
            ChatMessage.objects.create(
                conversation=convo,
                sender=None,
                sender_type='system',
                message_type='system',
                content=(
                    f"Care provider changed to {new_provider_profile.user.full_name} "
                    f"on {timezone.localdate().isoformat()}."
                ),
            )

    return Response({
        'success': True,
        'new_provider_id': new_provider_profile.id,
        'new_provider_name': new_provider_profile.user.full_name,
    })
