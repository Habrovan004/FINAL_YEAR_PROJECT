from rest_framework import serializers
from .models import TipCategory, Tip, Bookmark

class TipCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TipCategory
        fields = '__all__'

class TipSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = Tip
        fields = '__all__'

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Bookmark.objects.filter(user=request.user, tip=obj).exists()
        return False
