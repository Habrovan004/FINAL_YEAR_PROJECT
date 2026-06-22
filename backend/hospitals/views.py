import math
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import Hospital
from .serializers import HospitalSerializer

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

@api_view(['GET'])
@permission_classes([AllowAny])
def hospital_list(request):
    hospitals = Hospital.objects.filter(is_active=True)
    query = request.query_params.get('q', '')
    lat = request.query_params.get('lat')
    lng = request.query_params.get('lng')

    if query:
        hospitals = hospitals.filter(name__icontains=query)

    data = HospitalSerializer(hospitals, many=True).data

    if lat and lng:
        lat, lng = float(lat), float(lng)
        for h in data:
            if h['latitude'] and h['longitude']:
                h['distance_km'] = round(haversine(lat, lng, h['latitude'], h['longitude']), 1)
            else:
                h['distance_km'] = None
        data = sorted(data, key=lambda x: x['distance_km'] or 9999)

    return Response(data)
