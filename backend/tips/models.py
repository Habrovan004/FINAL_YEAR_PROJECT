from django.db import models
from django.core.exceptions import ObjectDoesNotExist

class TipCategory(models.Model):
    objects = models.Manager()
    DoesNotExist = ObjectDoesNotExist

    name = models.CharField(max_length=100)
    name_sw = models.CharField(max_length=100, blank=True)
    icon = models.CharField(max_length=50, blank=True)
    color = models.CharField(max_length=20, default='#FFD6D6')

    def __str__(self): return self.name

class Tip(models.Model):
    objects = models.Manager()
    DoesNotExist = ObjectDoesNotExist
    
    TRIMESTER_CHOICES = [('all', 'All'), ('1', '1st'), ('2', '2nd'), ('3', '3rd')]
    TYPE_CHOICES = [('tip', 'Tip'), ('warning', 'Warning'), ('nutrition', 'Nutrition'), ('info', 'Info')]

    category = models.ForeignKey(TipCategory, on_delete=models.CASCADE, related_name='tips')
    title = models.CharField(max_length=200)
    title_sw = models.CharField(max_length=200, blank=True)
    description = models.TextField()
    description_sw = models.TextField(blank=True)
    tip_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='tip')
    trimester = models.CharField(max_length=5, choices=TRIMESTER_CHOICES, default='all')
    is_daily = models.BooleanField(default=False)
    order = models.IntegerField(default=0)
    
    # AI Integration Fields
    is_ai_generated = models.BooleanField(default=False)
    is_reviewed = models.BooleanField(default=False, help_text="Checked by medical professional")

    # Approval gate — patients only see articles where is_approved=True.
    # Managers/admins flip this from the dashboard.
    is_approved = models.BooleanField(default=False, help_text="Approved for mothers to see")

    class Meta:
        ordering = ['order']

    def __str__(self): return self.title

class Bookmark(models.Model):
    objects = models.Manager()
    DoesNotExist = ObjectDoesNotExist

    from django.conf import settings
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookmarks')
    tip = models.ForeignKey(Tip, on_delete=models.CASCADE)
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'tip']
