from django.contrib import admin, messages
from .models import Tip, TipCategory, Bookmark
from .ai_service import generate_maternal_tip

@admin.register(TipCategory)
class TipCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'name_sw', 'icon', 'color')
    search_fields = ('name', 'name_sw')
    actions = ['generate_ai_tips']

    @admin.action(description='Generate 3 AI tips for selected categories')
    def generate_ai_tips(self, request, queryset):
        generated_count = 0
        trimesters = ['1', '2', '3'] # Simplified trimester values for model field

        for category in queryset:
            for trimester in trimesters:
                # Call the AI service utility
                ai_data = generate_maternal_tip(category.name, trimester)

                # Create the new tip record (defaults to reviewed=False)
                Tip.objects.create(
                    category=category,
                    title=ai_data['title'],
                    description=ai_data['description'],
                    title_sw=ai_data['title_sw'],
                    description_sw=ai_data['description_sw'],
                    trimester=trimester,
                    tip_type='tip',
                    is_ai_generated=True,
                    is_reviewed=False
                )
                generated_count += 1

        self.message_user(request, f'Successfully generated {generated_count} AI tips. Please review them.', messages.SUCCESS)

@admin.register(Tip)
class TipAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'trimester', 'tip_type', 'is_reviewed', 'is_ai_generated')
    list_filter = ('trimester', 'category', 'tip_type', 'is_reviewed', 'is_ai_generated')
    search_fields = ('title', 'title_sw', 'description', 'description_sw')
    ordering = ('-is_reviewed', 'order', 'title')

    actions = ['mark_as_reviewed']

    fieldsets = (
        ('AI Status', {
            'fields': ('is_ai_generated', 'is_reviewed'),
            'classes': ('collapse',),
        }),
        ('Categorization', {
            'fields': ('category', 'tip_type', 'trimester', 'is_daily', 'order')
        }),
        ('English Content', {
            'fields': ('title', 'description'),
            'description': 'Enter or review the educational content in English.'
        }),
        ('Swahili Content (Maudhui ya Kiswahili)', {
            'fields': ('title_sw', 'description_sw'),
            'description': 'Weka au kagua maelezo ya elimu kwa lugha ya Kiswahili.'
        }),
    )

    @admin.action(description='Mark selected tips as reviewed')
    def mark_as_reviewed(self, request, queryset):
        queryset.update(is_reviewed=True)
        self.message_user(request, 'Selected tips marked as reviewed.', messages.SUCCESS)

@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ('user', 'tip', 'saved_at')
    list_filter = ('saved_at',)
    search_fields = ('user__full_name', 'user__phone_number', 'tip__title')
    readonly_fields = ('saved_at',)
