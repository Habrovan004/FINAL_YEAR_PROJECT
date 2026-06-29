from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import TipCategory, Tip, Bookmark
from .serializers import TipCategorySerializer, TipSerializer
from django.db.models import Q

MANAGEMENT_ROLES = {'hospital_manager', 'admin'}


def _is_manager_or_admin(user) -> bool:
    user_type = getattr(user, 'user_type', '') or ''
    return bool(user.is_staff) or user_type in MANAGEMENT_ROLES


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tip_list(request):
    """
    Get list of tips with advanced filtering.
    Patient-facing GETs only return tips that are approved AND reviewed.
    Managers / admins see every tip so they can approve drafts.
    """
    tips = Tip.objects.all()
    if not _is_manager_or_admin(request.user):
        tips = tips.filter(is_approved=True, is_reviewed=True)
    trimester = request.query_params.get('trimester')
    category_id = request.query_params.get('category')
    tip_type = request.query_params.get('type')
    query = request.query_params.get('q')
    daily = request.query_params.get('daily')

    if trimester:
        tips = tips.filter(Q(trimester=trimester) | Q(trimester='all'))
    
    if category_id:
        tips = tips.filter(category_id=category_id)
        
    if tip_type:
        tips = tips.filter(tip_type=tip_type)
        
    if query:
        tips = tips.filter(
            Q(title__icontains=query) | 
            Q(description__icontains=query) |
            Q(category__name__icontains=query)
        )
        
    if daily:
        tips = tips.filter(is_daily=True)

    return Response(TipSerializer(tips, many=True, context={'request': request}).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def categories(request): 
    """Return all tip categories"""
    _ = request 
    cats = TipCategory.objects.all()
    return Response(TipCategorySerializer(cats, many=True).data)

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
