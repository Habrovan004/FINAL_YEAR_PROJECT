from rest_framework import serializers
from .models import Tip, Bookmark


class TipSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = Tip
        # Explicit field list so `is_approved` is always present in the
        # serialized payload (and required to be there even if `fields = '__all__'`
        # was ever scoped down).
        fields = [
            'id',
            'category', 'category_name',
            'title', 'title_sw',
            'description', 'description_sw',
            'tip_type', 'trimester',
            'is_daily', 'order',
            'is_ai_generated', 'is_reviewed', 'is_approved',
            'is_bookmarked',
        ]

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Bookmark.objects.filter(user=request.user, tip=obj).exists()
        return False
