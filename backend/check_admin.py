from django.contrib import admin
from django.contrib.auth import get_user_model

User = get_user_model()

try:
    user_admin = admin.site._registry[User]
    print('list_display:', user_admin.list_display)
    user = User()
    for field in user_admin.list_display:
        has = hasattr(user, field) or hasattr(user_admin, field)
        status = 'OK' if has else 'MISSING'
        print(field + ': ' + status)
except Exception as e:
    import traceback
    traceback.print_exc()
