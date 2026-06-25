"""
Module 7 — Hospital Manager dashboard endpoints.

All endpoints are scoped to the manager's facility. A user with
``user_type='hospital_manager'`` is authenticated and looked up via
``HospitalManagerProfile`` for the linked hospital.
"""
from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from appointments.models import Appointment
from chatbot.models import Conversation
from clinical.models import ANCVisit
from hospitals.models import Hospital
from patients.models import PatientProfile
from tips.models import Tip, TipCategory
from tracking.models import SymptomReport

from .models import HospitalManagerProfile, ProviderProfile, User


def _require_manager(request):
    """Return (manager_profile, hospital) tuple or raise via a Response shortcut.

    Returns either (profile, hospital, None) or (None, None, response).
    """
    if request.user.user_type != 'hospital_manager':
        return None, None, Response({'error': 'Hospital Manager role required.'}, status=403)
    mp = getattr(request.user, 'manager_profile', None)
    if not mp:
        return None, None, Response({'error': 'No facility linked to this manager.'}, status=400)
    return mp, mp.hospital, None


# ──────────────────────────────────────────────────────────────────────
# Analytics
# ──────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manager_stats(request):
    """Aggregate facility metrics for the dashboard."""
    mp, hospital, err = _require_manager(request)
    if err:
        return err

    now = timezone.now()
    month_ago = now - timedelta(days=30)
    week_ago = now - timedelta(days=7)

    mothers = User.objects.filter(user_type='patient', profile__hospital=hospital)
    providers = ProviderProfile.objects.filter(hospital=hospital)

    visits_month = ANCVisit.objects.filter(
        patient__in=mothers, visit_date__gte=month_ago
    ).count()

    high_risk_week = SymptomReport.objects.filter(
        patient__in=mothers, risk_level='high', created_at__gte=week_ago
    ).count()

    appts = Appointment.objects.filter(user__in=mothers, appointment_date__lt=now.date())
    total_past = appts.count()
    attended = appts.filter(status='attended').count()
    attendance_rate = round((attended / total_past * 100), 1) if total_past else 0.0

    chatbot_convos = Conversation.objects.filter(mother__in=mothers).count()
    escalated_convos = Conversation.objects.filter(
        mother__in=mothers, type='provider'
    ).count()
    escalation_rate = round((escalated_convos / chatbot_convos * 100), 1) if chatbot_convos else 0.0

    # Distribution of risk levels in the last 30 days
    risk_dist = (
        SymptomReport.objects
        .filter(patient__in=mothers, created_at__gte=month_ago)
        .values('risk_level')
        .annotate(count=Count('id'))
    )

    # Visits per week for the last 6 weeks (for chart)
    visit_series = []
    for i in range(5, -1, -1):
        wk_start = now - timedelta(days=(i + 1) * 7)
        wk_end = now - timedelta(days=i * 7)
        cnt = ANCVisit.objects.filter(
            patient__in=mothers, visit_date__gte=wk_start, visit_date__lt=wk_end
        ).count()
        visit_series.append({
            'week_starting': wk_start.date().isoformat(),
            'visits': cnt,
        })

    return Response({
        'hospital': {'id': hospital.id, 'name': hospital.name},
        'totals': {
            'mothers': mothers.count(),
            'providers': providers.count(),
            'visits_this_month': visits_month,
            'high_risk_this_week': high_risk_week,
        },
        'attendance_rate': attendance_rate,
        'chatbot_escalation_rate': escalation_rate,
        'risk_distribution': list(risk_dist),
        'visit_series': visit_series,
    })


# ──────────────────────────────────────────────────────────────────────
# Provider management
# ──────────────────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manager_providers(request):
    mp, hospital, err = _require_manager(request)
    if err:
        return err

    if request.method == 'GET':
        rows = ProviderProfile.objects.filter(hospital=hospital).select_related('user')
        return Response([{
            'id': p.id,
            'user_id': p.user_id,
            'full_name': p.user.full_name,
            'phone_number': p.user.phone_number,
            'email': p.user.email,
            'specialization': p.specialization,
            'is_available': p.is_available,
            'current_workload': p.current_workload,
            'max_workload': p.max_workload,
            'is_active': p.user.is_active,
        } for p in rows])

    # POST — register a new provider at this hospital
    data = request.data
    required = ['phone_number', 'full_name', 'password']
    for key in required:
        if not data.get(key):
            return Response({'error': f'{key} is required.'}, status=400)
    if User.objects.filter(phone_number=data['phone_number']).exists():
        return Response({'error': 'Phone number already registered.'}, status=400)

    user = User.objects.create_user(
        phone_number=data['phone_number'],
        full_name=data['full_name'],
        email=data.get('email') or None,
        password=data['password'],
        user_type='provider',
        is_verified=True,  # manager-created accounts are pre-verified
    )
    spec = data.get('specialization') or 'nurse'
    if spec not in {'obstetrician', 'midwife', 'nurse'}:
        spec = 'nurse'
    profile = ProviderProfile.objects.create(
        user=user, hospital=hospital, specialization=spec,
    )
    return Response({
        'id': profile.id,
        'user_id': user.id,
        'full_name': user.full_name,
        'phone_number': user.phone_number,
        'email': user.email,
        'specialization': profile.specialization,
    }, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def manager_provider_detail(request, pk):
    mp, hospital, err = _require_manager(request)
    if err:
        return err
    try:
        profile = ProviderProfile.objects.select_related('user').get(pk=pk, hospital=hospital)
    except ProviderProfile.DoesNotExist:
        return Response({'error': 'Provider not found at this facility.'}, status=404)

    data = request.data
    if 'is_active' in data:
        profile.user.is_active = bool(data['is_active'])
        profile.user.save(update_fields=['is_active'])
    if 'is_available' in data:
        profile.is_available = bool(data['is_available'])
    if 'max_workload' in data:
        try:
            profile.max_workload = int(data['max_workload'])
        except (TypeError, ValueError):
            pass
    profile.save()
    return Response({'ok': True})


# ──────────────────────────────────────────────────────────────────────
# Educational content (uses the existing Tip model — bilingual + trimester)
# ──────────────────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manager_content(request):
    mp, hospital, err = _require_manager(request)
    if err:
        return err

    if request.method == 'GET':
        tips = Tip.objects.all().select_related('category')
        return Response([{
            'id': t.id,
            'title': t.title,
            'title_sw': t.title_sw,
            'description': t.description,
            'description_sw': t.description_sw,
            'category_id': t.category_id,
            'category_name': t.category.name if t.category_id else None,
            'tip_type': t.tip_type,
            'trimester': t.trimester,
            'is_daily': t.is_daily,
            'is_reviewed': t.is_reviewed,
            'is_ai_generated': t.is_ai_generated,
        } for t in tips])

    # POST — create content
    data = request.data
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    if not title or not description:
        return Response({'error': 'title and description are required.'}, status=400)

    category_id = data.get('category_id')
    if not category_id:
        cat, _ = TipCategory.objects.get_or_create(name='General')
        category_id = cat.id

    tip = Tip.objects.create(
        category_id=category_id,
        title=title,
        title_sw=data.get('title_sw', ''),
        description=description,
        description_sw=data.get('description_sw', ''),
        tip_type=data.get('tip_type', 'tip'),
        trimester=data.get('trimester', 'all'),
        is_daily=bool(data.get('is_daily', False)),
        is_reviewed=bool(data.get('is_reviewed', True)),  # manager-created = approved
    )
    return Response({'id': tip.id}, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def manager_content_detail(request, pk):
    mp, hospital, err = _require_manager(request)
    if err:
        return err
    try:
        tip = Tip.objects.get(pk=pk)
    except Tip.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'DELETE':
        tip.delete()
        return Response(status=204)

    data = request.data
    for field in ['title', 'title_sw', 'description', 'description_sw',
                  'tip_type', 'trimester']:
        if field in data:
            setattr(tip, field, data[field])
    if 'is_daily' in data:
        tip.is_daily = bool(data['is_daily'])
    if 'is_reviewed' in data:
        tip.is_reviewed = bool(data['is_reviewed'])
    if 'category_id' in data and data['category_id']:
        tip.category_id = data['category_id']
    tip.save()
    return Response({'ok': True})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manager_categories(request):
    mp, hospital, err = _require_manager(request)
    if err:
        return err
    if request.method == 'POST':
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'name is required.'}, status=400)
        cat, _ = TipCategory.objects.get_or_create(
            name=name, defaults={'name_sw': request.data.get('name_sw', '')},
        )
        return Response({'id': cat.id, 'name': cat.name}, status=201)
    cats = TipCategory.objects.all()
    return Response([{
        'id': c.id, 'name': c.name, 'name_sw': c.name_sw,
    } for c in cats])


# ──────────────────────────────────────────────────────────────────────
# Mother roster (read-only)
# ──────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manager_mothers(request):
    mp, hospital, err = _require_manager(request)
    if err:
        return err
    profiles = (
        PatientProfile.objects
        .filter(hospital=hospital)
        .select_related('user', 'assigned_provider__user')
    )
    return Response([{
        'id': p.user_id,
        'full_name': p.user.full_name,
        'phone_number': p.user.phone_number,
        'assigned_provider': p.assigned_provider.user.full_name if p.assigned_provider else None,
        'pregnancy_week': p.pregnancy_week(),
        'trimester': p.trimester(),
    } for p in profiles])
