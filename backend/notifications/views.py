from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_list(request):
    """GET /api/notifications/  — caller's notifications, newest first.
    ?unread=1 restricts to unread only (used by the polling badge)."""
    qs = Notification.objects.filter(recipient=request.user)
    if request.query_params.get('unread') == '1':
        qs = qs.filter(is_read=False)
    return Response(NotificationSerializer(qs[:50], many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    updated = Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({'marked_read': updated}, status=status.HTTP_200_OK)
