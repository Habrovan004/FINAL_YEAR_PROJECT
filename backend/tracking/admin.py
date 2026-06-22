from django.contrib import admin
from . import models

for model in [getattr(models, m) for m in dir(models) if isinstance(getattr(models, m), type)]:
    try:
        admin.site.register(model)
    except:
        pass
