import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ANCVisit
from .serializers import ANCVisitSerializer
from accounts.models import User

logger = logging.getLogger(__name__)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def anc_visit_list(request):
    """
    GET: Fetch visits.
       - patient: returns own visits.
       - provider: ?patient_id=X required, only patients assigned to them.
    POST: Record a new visit (provider only).
    """
    if request.method == 'POST':
        if request.user.user_type != 'provider':
            return Response({'error': 'Only healthcare providers can record ANC visits.'},
                            status=status.HTTP_403_FORBIDDEN)

        # Permission: provider can only record visits for their own patients
        patient_id = request.data.get('patient')
        if patient_id:
            try:
                patient = User.objects.get(pk=patient_id, user_type='patient')
            except User.DoesNotExist:
                return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

            provider_profile = getattr(request.user, 'provider_profile', None)
            patient_profile = getattr(patient, 'profile', None)
            if not patient_profile or patient_profile.assigned_provider_id != getattr(provider_profile, 'id', None):
                return Response({'error': 'This patient is not assigned to you.'},
                                status=status.HTTP_403_FORBIDDEN)

        serializer = ANCVisitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            serializer.save(provider=request.user)
        except Exception:
            logger.exception('Failed to save ANC visit')
            return Response(
                {'error': 'Server error while saving the visit. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ---- GET ----
    patient_id = request.query_params.get('patient_id')

    if request.user.user_type == 'provider':
        provider_profile = getattr(request.user, 'provider_profile', None)
        if not provider_profile:
            return Response({'error': 'Provider profile not found.'},
                            status=status.HTTP_404_NOT_FOUND)
        # Restrict to assigned patients only
        if patient_id:
            visits = ANCVisit.objects.filter(
                patient_id=patient_id,
                patient__profile__assigned_provider=provider_profile,
            )
        else:
            visits = ANCVisit.objects.filter(
                patient__profile__assigned_provider=provider_profile,
            )
    else:
        # Patient sees their own visits regardless of patient_id param
        visits = ANCVisit.objects.filter(patient=request.user)

    serializer = ANCVisitSerializer(visits, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_summary(request, patient_id):
    """Summary of previous visits before recording a new one."""
    try:
        patient = User.objects.get(pk=patient_id, user_type='patient')
    except User.DoesNotExist:
        return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Provider can only see their own patients
    if request.user.user_type == 'provider':
        provider_profile = getattr(request.user, 'provider_profile', None)
        patient_profile = getattr(patient, 'profile', None)
        if not patient_profile or patient_profile.assigned_provider_id != getattr(provider_profile, 'id', None):
            return Response({'error': 'This patient is not assigned to you.'},
                            status=status.HTTP_403_FORBIDDEN)
    elif request.user != patient:
        return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    visits = ANCVisit.objects.filter(patient=patient).order_by('-visit_date')

    return Response({
        'patient_name': patient.full_name,
        'visit_count': visits.count(),
        'last_visit': ANCVisitSerializer(visits.first()).data if visits.exists() else None,
        'history': ANCVisitSerializer(visits, many=True).data,
    })
