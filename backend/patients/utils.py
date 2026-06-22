from accounts.models import ProviderProfile
from hospitals.models import Hospital
from django.db.models import F
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Radius of Earth in kilometers
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def assign_provider_to_mother(mother_profile):
    """
    Assigns a suitable healthcare provider to a new mother based on criteria.
    Criteria:
    1. Provider workload (prefer less busy)
    2. Specialization (any relevant specialization for general ANC)
    3. Facility location (prefer closer to mother's chosen hospital)
    """
    mother_hospital = mother_profile.hospital
    if not mother_hospital or not mother_hospital.latitude or not mother_hospital.longitude:
        # If mother hasn't chosen a hospital or it lacks location, assign to any available provider
        available_providers = ProviderProfile.objects.filter(
            is_available=True,
            current_workload__lt=F('max_workload')
        ).order_by('current_workload')
        if available_providers.exists():
            provider = available_providers.first()
            provider.current_workload += 1
            provider.save()
            return provider
        return None # No provider found

    # Filter providers by availability and workload
    eligible_providers = ProviderProfile.objects.filter(
        is_available=True,
        current_workload__lt=F('max_workload')
    )

    best_provider = None
    min_distance = float('inf')
    
    for provider in eligible_providers:
        provider_hospital = provider.hospital
        if provider_hospital and provider_hospital.latitude and provider_hospital.longitude:
            distance = haversine(
                mother_hospital.latitude, mother_hospital.longitude,
                provider_hospital.latitude, provider_hospital.longitude
            )
            if distance < min_distance:
                min_distance = distance
                best_provider = provider
        elif not best_provider: # If no geo-located provider found yet, take the first eligible one
            best_provider = provider

    if best_provider:
        best_provider.current_workload += 1
        best_provider.save()
        return best_provider
    
    return None # No suitable provider found
