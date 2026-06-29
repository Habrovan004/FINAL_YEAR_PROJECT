"""
/api/learn/articles/ — canonical Learn article endpoint.

Patient-facing GETs only return articles where `is_approved=True`.
Hospital managers, admins, and staff users see every article (so they can
approve drafts from the manager dashboard).
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q

from tips.models import Tip, TipCategory
from tips.serializers import TipSerializer


# Roles that may read drafts and create / update / delete articles.
MANAGEMENT_ROLES = {'hospital_manager', 'admin'}


def _is_manager_or_admin(user) -> bool:
    user_type = getattr(user, 'user_type', '') or ''
    return bool(user.is_staff) or user_type in MANAGEMENT_ROLES


def _serialize(tip, request):
    return TipSerializer(tip, context={'request': request}).data


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def articles_list(request):
    if request.method == 'GET':
        qs = Tip.objects.all().select_related('category')

        # Patients only see approved tips. Managers / admins see everything.
        if not _is_manager_or_admin(request.user):
            qs = qs.filter(is_approved=True)

        # ?trimester=1|2|3  → that trimester + the "all" bucket
        # ?trimester=all    → only the "all" bucket
        # (omitted)         → no trimester filter
        trimester = request.query_params.get('trimester')
        if trimester == 'all':
            qs = qs.filter(trimester='all')
        elif trimester in {'1', '2', '3'}:
            qs = qs.filter(Q(trimester=trimester) | Q(trimester='all'))

        return Response(TipSerializer(qs, many=True, context={'request': request}).data)

    # POST — managers / admins only
    if not _is_manager_or_admin(request.user):
        return Response({'error': 'Manager access required.'}, status=403)

    data = request.data
    # Accept both spec field names (title_en / body_en) and the model names
    # (title / description). Whichever the client sends, we store the same way.
    title = (data.get('title_en') or data.get('title') or '').strip()
    description = (data.get('body_en') or data.get('description') or '').strip()
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
        description_sw=data.get('body_sw') or data.get('description_sw', ''),
        tip_type=data.get('tip_type', 'tip'),
        trimester=str(data.get('trimester', 'all')),
        is_approved=bool(data.get('is_approved', False)),
        is_reviewed=bool(data.get('is_reviewed', True)),
    )
    return Response(_serialize(tip, request), status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def articles_detail(request, pk):
    try:
        tip = Tip.objects.get(pk=pk)
    except Tip.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.method == 'GET':
        if not _is_manager_or_admin(request.user) and not tip.is_approved:
            return Response({'error': 'Not found.'}, status=404)
        return Response(_serialize(tip, request))

    # Mutations require manager / admin
    if not _is_manager_or_admin(request.user):
        return Response({'error': 'Manager access required.'}, status=403)

    if request.method == 'DELETE':
        tip.delete()
        return Response(status=204)

    # PATCH
    data = request.data
    for field in ('title', 'title_sw', 'description', 'description_sw',
                  'tip_type', 'trimester'):
        if field in data:
            setattr(tip, field, data[field])
    # Spec field-name aliases
    if 'title_en' in data:
        tip.title = data['title_en']
    if 'body_en' in data:
        tip.description = data['body_en']
    if 'body_sw' in data:
        tip.description_sw = data['body_sw']
    if 'is_approved' in data:
        tip.is_approved = bool(data['is_approved'])
    if 'is_reviewed' in data:
        tip.is_reviewed = bool(data['is_reviewed'])
    if 'category_id' in data and data['category_id']:
        tip.category_id = data['category_id']
    tip.save()
    return Response(_serialize(tip, request))
