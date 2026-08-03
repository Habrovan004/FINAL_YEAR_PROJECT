from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.db import transaction
from django.db.models import Count
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.urls import path, reverse
from django.utils import timezone

from .models import Assignment, PasswordResetCode, ProviderProfile, User


# Custom forms for UserAdmin to handle phone_number instead of username
class UserAdminCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('phone_number', 'full_name', 'user_type')

    def clean_phone_number(self):
        phone_number = self.cleaned_data['phone_number']
        if User.objects.filter(phone_number=phone_number).exists():
            raise forms.ValidationError('A user with that phone number already exists.')
        return phone_number


class UserAdminChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = '__all__'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserAdminChangeForm
    add_form = UserAdminCreationForm

    list_display = ('phone_number', 'full_name', 'user_type', 'is_verified', 'is_staff', 'is_active')
    list_filter = ('user_type', 'is_verified', 'is_staff', 'is_active')
    search_fields = ('phone_number', 'full_name')
    ordering = ('phone_number',)

    fieldsets = (
        (None, {'fields': ('phone_number', 'password')}),
        ('Personal info', {'fields': ('full_name', 'date_of_birth', 'user_type')}),
        ('Permissions', {'fields': ('is_active', 'is_verified', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'created_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'full_name', 'user_type', 'password', 'password2'),
        }),
    )
    readonly_fields = ('last_login', 'created_at')


# ── ProviderProfile: read-only inline of every mother currently assigned ──
class AssignmentInline(admin.TabularInline):
    """Read-only inline on ProviderProfile so an admin can see the provider's
    live patient load without opening the Assignment list separately."""
    model = Assignment
    fk_name = 'provider'
    extra = 0
    can_delete = False
    show_change_link = True
    verbose_name = 'Assigned mother'
    verbose_name_plural = 'Currently assigned mothers'
    fields = ('mother', 'assigned_at', 'assigned_by', 'is_active')
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ProviderProfile)
class ProviderProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'hospital', 'specialization', 'is_available', 'current_workload', 'max_workload')
    list_filter = ('hospital', 'specialization', 'is_available')
    search_fields = ('user__full_name', 'user__phone_number', 'hospital__name')
    raw_id_fields = ('user', 'hospital')
    inlines = [AssignmentInline]


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ('user', 'code', 'created_at', 'expires_at', 'is_used')
    list_filter = ('is_used',)
    search_fields = ('user__full_name', 'user__phone_number', 'code')
    readonly_fields = ('created_at',)


# ── Assignment admin ─────────────────────────────────────────────────────
class ReassignForm(forms.Form):
    """Intermediate confirmation form for the 'Reassign selected mothers'
    action. The dropdown is scoped to available providers only."""
    new_provider = forms.ModelChoiceField(
        queryset=ProviderProfile.objects.filter(is_available=True).select_related('user', 'hospital'),
        label='New provider',
        help_text='Only providers marked "available" are shown.',
    )
    notes = forms.CharField(
        label='Note (optional)',
        required=False,
        widget=forms.Textarea(attrs={'rows': 3, 'cols': 60}),
        help_text='Recorded on the Assignment row.',
    )


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = (
        'mother_name', 'mother_phone', 'provider_name', 'provider_facility',
        'assigned_at', 'assigned_by', 'is_active',
    )
    list_filter = ('provider', 'is_active', 'assigned_at')
    search_fields = (
        'mother__user__full_name',
        'mother__user__phone_number',
        'provider__user__full_name',
    )
    readonly_fields = ('assigned_at', 'assigned_by')
    raw_id_fields = ('mother', 'provider')
    actions = ['reassign_selected_mothers']
    change_list_template = 'admin/accounts/assignment/change_list.html'

    # ── Column methods ────────────────────────────────────────────────
    @admin.display(description='Mother', ordering='mother__user__full_name')
    def mother_name(self, obj):
        return obj.mother.user.full_name

    @admin.display(description='Phone', ordering='mother__user__phone_number')
    def mother_phone(self, obj):
        return obj.mother.user.phone_number

    @admin.display(description='Provider', ordering='provider__user__full_name')
    def provider_name(self, obj):
        return obj.provider.user.full_name

    @admin.display(description='Facility', ordering='provider__hospital__name')
    def provider_facility(self, obj):
        return obj.provider.hospital.name if obj.provider.hospital else '—'

    # ── save_model: auto-set assigned_by on any admin edit ────────────
    def save_model(self, request, obj, form, change):
        obj.assigned_by = request.user
        super().save_model(request, obj, form, change)

    # ── Custom "Reassign selected mothers" action ─────────────────────
    @admin.action(description='Reassign selected mothers to a new provider')
    def reassign_selected_mothers(self, request, queryset):
        """Intermediate-page action: shows a provider picker, then applies
        the change to every selected Assignment inside one transaction."""
        selected_ids = list(queryset.values_list('pk', flat=True))

        if request.POST.get('apply'):
            form = ReassignForm(request.POST)
            if form.is_valid():
                new_provider = form.cleaned_data['new_provider']
                notes = form.cleaned_data['notes']
                self._apply_reassignment(request, selected_ids, new_provider, notes)
                return HttpResponseRedirect(request.get_full_path())
        else:
            form = ReassignForm()

        return render(request, 'admin/accounts/assignment/reassign_confirm.html', {
            'assignments': queryset.select_related('mother__user', 'provider__user'),
            'form': form,
            'action_name': 'reassign_selected_mothers',
            # Preserve the admin action-form contract so Django re-runs the
            # action on the same queryset when the user hits "Apply".
            'selected_action': selected_ids,
            'opts': self.model._meta,
            'title': 'Reassign selected mothers',
        })

    def _apply_reassignment(self, request, assignment_ids, new_provider, notes):
        """Do the write for each selected Assignment: update provider,
        record who did it, re-point the mother's active Conversation to the
        new provider (never create a second one), and drop a Swahili system
        message noting the change."""
        # Local imports keep the admin loadable even in setups where the
        # chatbot app is disabled or being migrated.
        from chatbot.models import Conversation, Message as ChatbotMessage

        today = timezone.localdate().isoformat()
        new_provider_name = new_provider.user.full_name
        reassigned = 0
        already_on_target = 0
        conversation_moves = 0

        assignments = (
            Assignment.objects
            .select_related('mother__user', 'provider__user')
            .filter(pk__in=assignment_ids)
        )
        for assignment in assignments:
            if assignment.provider_id == new_provider.pk:
                already_on_target += 1
                continue

            with transaction.atomic():
                assignment.provider = new_provider
                assignment.assigned_by = request.user
                if notes:
                    assignment.notes = notes
                assignment.save(update_fields=['provider', 'assigned_by', 'notes'])

                # Legacy dual-write: the ~7 readers in chat/chatbot/tracking
                # still consult PatientProfile.assigned_provider. Task 5
                # migrates those readers; until then, keep the two stores in
                # sync so an admin reassignment is visible everywhere.
                profile = assignment.mother
                profile.assigned_provider = new_provider
                profile.save(update_fields=['assigned_provider'])

                # Re-point the mother's active Conversation. Never create a
                # new one — that's exactly the duplicate we've been fighting.
                convo = (
                    Conversation.objects
                    .filter(mother=profile.user, is_active=True)
                    .first()
                )
                if convo:
                    convo.provider = new_provider.user
                    convo.save(update_fields=['provider', 'updated_at'])
                    ChatbotMessage.objects.create(
                        conversation=convo,
                        sender=None,
                        sender_type='system',
                        message_type='system',
                        content=(
                            f'Mama huyu amehamishiwa kwa {new_provider_name} '
                            f'tarehe {today}.'
                        ),
                    )
                    conversation_moves += 1

                reassigned += 1

        if reassigned:
            self.message_user(
                request,
                f'Reassigned {reassigned} mother(s) to {new_provider_name}. '
                f'{conversation_moves} conversation(s) re-pointed.',
                messages.SUCCESS,
            )
        if already_on_target:
            self.message_user(
                request,
                f'{already_on_target} row(s) were already assigned to {new_provider_name}; skipped.',
                messages.WARNING,
            )

    # ── Custom URL: /admin/accounts/assignment/workload/ ──────────────
    def get_urls(self):
        return [
            path(
                'workload/',
                self.admin_site.admin_view(self.workload_view),
                name='accounts_assignment_workload',
            ),
        ] + super().get_urls()

    def workload_view(self, request):
        """Dashboard: current assignment count per provider, so an admin
        can see who is overloaded before firing the reassign action."""
        rows = (
            ProviderProfile.objects
            .annotate(active_assignments=Count('assignments', filter=None))
            .select_related('user', 'hospital')
            .order_by('-active_assignments', 'user__full_name')
        )
        rows_data = [{
            'provider_name': p.user.full_name,
            'facility': p.hospital.name if p.hospital else '—',
            'specialization': p.get_specialization_display(),
            'is_available': p.is_available,
            'active_assignments': p.active_assignments,
            'max_workload': p.max_workload,
            'over_capacity': p.active_assignments > p.max_workload,
        } for p in rows]

        context = {
            **self.admin_site.each_context(request),
            'title': 'Provider workload',
            'rows': rows_data,
            'total_assignments': sum(r['active_assignments'] for r in rows_data),
            'total_providers': len(rows_data),
            'opts': self.model._meta,
        }
        return render(request, 'admin/accounts/assignment/workload.html', context)
