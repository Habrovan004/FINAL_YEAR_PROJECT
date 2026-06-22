from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ANCVisit
from .serializers import ANCVisitSerializer
from accounts.models import User

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def anc_visit_list(request):
    """
    GET: Fetch visits for a specific patient (using ?patient_id=X)
    POST: Record a new visit (only for Providers)
    """
    if request.method == 'POST':
        if request.user.user_type != 'provider':
            return Response({'error': 'Only healthcare providers can record ANC visits.'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = ANCVisitSerializer(data=request.data)
        if serializer.is_valid():
            # Save the visit, the save() method in models.py will trigger recommendations
            serializer.save(provider=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # GET logic
    patient_id = request.query_params.get('patient_id')
    if patient_id:
        visits = ANCVisit.objects.filter(patient_id=patient_id)
    else:
        # If no patient_id, return the user's own visits if they are a patient
        visits = ANCVisit.objects.filter(patient=request.user)
        
    serializer = ANCVisitSerializer(visits, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_summary(request, patient_id):
    """
    Provides medical context (summary of previous visits) before recording a new one.
    """
    try:
        patient = User.objects.get(pk=patient_id, user_type='patient')
        visits = ANCVisit.objects.filter(patient=patient).order_by('-visit_date')
        
        return Response({
            'patient_name': patient.full_name,
            'visit_count': visits.count(),
            'last_visit': ANCVisitSerializer(visits.first()).data if visits.exists() else None,
            'history': ANCVisitSerializer(visits, many=True).data
        })
    except User.DoesNotExist:
        return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)
