from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory

User = get_user_model()

try:
    user_admin = admin.site._registry[User]
    print('list_filter:', user_admin.list_filter)
    print('search_fields:', user_admin.search_fields)
    print('readonly_fields:', user_admin.readonly_fields)
    print('fieldsets exist:', user_admin.fieldsets is not None)
    
    # Jaribu kuunda queryset kama admin anafanya
    from django.contrib.auth.models import AnonymousUser
    factory = RequestFactory()
    request = factory.get('/admin/accounts/user/')
    request.user = User.objects.filter(is_superuser=True).first()
    print('Superuser found:', request.user)
    
    qs = user_admin.get_queryset(request)
    print('Queryset count:', qs.count())
    print('ALL OK')
except Exception as e:
    import traceback
    traceback.print_exc()
