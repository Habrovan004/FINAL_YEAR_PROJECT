import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ANCVisit
from .serializers import ANCVisitSerializer
from accounts.models import User
from patients.permissions import get_patient_or_404

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

        # Permission: provider can only record visits for their own patients.
        # 404s (not 403) for a patient_id that exists but isn't assigned to
        # this provider, so patient IDs belonging to other providers can't
        # be enumerated by an authenticated-but-unrelated provider.
        patient_id = request.data.get('patient')
        if patient_id:
            get_patient_or_404(request, patient_id)

        serializer = ANCVisitSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning('ANC visit validation failed: %s | payload=%s', serializer.errors, request.data)
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
        # Restrict to assigned patients only — 404 (not a silent empty list)
        # for a patient_id that isn't assigned to this provider, so a bad or
        # foreign patient_id gives an unambiguous signal instead of looking
        # identical to "this patient just has no visits yet".
        if patient_id:
            get_patient_or_404(request, patient_id)
            visits = ANCVisit.objects.filter(
                patient_id=patient_id,
                patient__profile__assignment__provider=provider_profile,
            )
        else:
            visits = ANCVisit.objects.filter(
                patient__profile__assignment__provider=provider_profile,
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
    if request.user.user_type == 'provider':
        # 404 (not 403) for a patient not assigned to this provider.
        patient = get_patient_or_404(request, patient_id)
    else:
        try:
            patient = User.objects.get(pk=patient_id, user_type='patient')
        except User.DoesNotExist:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.user != patient:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    visits = ANCVisit.objects.filter(patient=patient).order_by('-visit_date')

    return Response({
        'patient_name': patient.full_name,
        'visit_count': visits.count(),
        'last_visit': ANCVisitSerializer(visits.first()).data if visits.exists() else None,
        'history': ANCVisitSerializer(visits, many=True).data,
    })
