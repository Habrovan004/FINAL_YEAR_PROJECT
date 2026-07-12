from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Tip, Bookmark
from .serializers import TipSerializer

@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def toggle_bookmark(request, tip_id):
    """Toggle a bookmark for a specific tip"""
    try:
        tip = Tip.objects.get(pk=tip_id)
    except Tip.DoesNotExist:
        return Response({'error': 'Tip not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'POST':
        Bookmark.objects.get_or_create(user=request.user, tip=tip)
        return Response({'bookmarked': True}, status=status.HTTP_201_CREATED)
    
    if request.method == 'DELETE':
        Bookmark.objects.filter(user=request.user, tip=tip).delete()
        return Response({'bookmarked': False}, status=status.HTTP_200_OK)

    return Response({'error': 'Method not allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def saved_tips(request):
    """Return all tips bookmarked by the current user"""
    bookmarks = Bookmark.objects.filter(user=request.user).select_related('tip')
    tips = [b.tip for b in bookmarks]
    return Response(TipSerializer(tips, many=True, context={'request': request}).data)
