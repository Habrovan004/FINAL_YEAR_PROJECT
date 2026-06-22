from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import EmergencyLog, EmergencyContact, EmergencyInstruction
from .serializers import EmergencyLogSerializer, EmergencyContactSerializer
from hospitals.models import Hospital
from hospitals.serializers import HospitalSerializer
from .sms import send_sos_sms # Import the new SMS utility

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_sos(request):
    """
    Module 7: One-Tap Emergency Response.
    Captures GPS, alerts provider via App/SMS, returns instructions.
    """
    lat = request.data.get('latitude')
    lng = request.data.get('longitude')
    
    # 1. Get user's assigned provider
    provider = None
    if hasattr(request.user, 'profile') and request.user.profile.assigned_provider:
        provider = request.user.profile.assigned_provider.user

    # 2. Log the SOS Action
    log = EmergencyLog.objects.create(
        user=request.user,
        action='sos_trigger',
        latitude=lat,
        longitude=lng,
        provider_notified=provider
    )

    # 3. Send Provider Notification (SMS via Africa's Talking)
    if provider and provider.phone_number:
        send_sos_sms(provider.phone_number, request.user.full_name, lat, lng)
        log.is_sms_sent = True
        log.save()

    # 4. Fetch Emergency Instructions
    instructions = EmergencyInstruction.objects.all()

    return Response({
        'status': 'alert_triggered',
        'provider_name': provider.full_name if provider else "Emergency Center",
        'instructions': [{
            'title': i.title,
            'text': i.text,
            'title_sw': i.title_sw,
            'text_sw': i.text_sw
        } for i in instructions]
    }, status=status.HTTP_201_CREATED)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def contact_list(request):
    if request.method == 'POST':
        serializer = EmergencyContactSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    contacts = EmergencyContact.objects.filter(user=request.user)
    serializer = EmergencyContactSerializer(contacts, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def emergency_hospitals(request):
    profile = getattr(request.user, 'profile', None)
    assigned_hospital = profile.hospital if profile else None
    hospitals = Hospital.objects.all()[:5]
    return Response({
        'assigned_hospital': HospitalSerializer(assigned_hospital).data if assigned_hospital else None,
        'all_hospitals': HospitalSerializer(hospitals, many=True).data
    })
