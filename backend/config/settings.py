from pathlib import Path
from datetime import timedelta
from decouple import config
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost').split(',')

# Render (and most PaaS) sit behind a reverse proxy that terminates TLS and
# forwards requests as plain HTTP — without this, Django thinks every
# request is insecure and secure cookies/redirects misbehave.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    # Local apps
    'accounts',
    'patients',
    'tracking',
    'appointments',
    'clinical',
    'tips',
    'hospitals',
    'emergency',
    'chatbot',
    'chat',
    'medication',
    'maintenance',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # MUST be at the top
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Render (and most PaaS providers) inject a single DATABASE_URL. Local dev
# keeps using the individual DB_* vars already in backend/.env.
_database_url = config('DATABASE_URL', default='')
if _database_url:
    DATABASES = {
        'default': dj_database_url.parse(_database_url, conn_max_age=600, ssl_require=True)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DB_NAME'),
            'USER': config('DB_USER'),
            'PASSWORD': config('DB_PASSWORD'),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
        }
    }

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Dar_es_Salaam'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# In development, Vite may fall back to alternate ports (5174, 5175, …) when
# 5173 is taken. Allow any localhost/127.0.0.1 port while DEBUG is on so the
# frontend keeps working regardless of which port it ends up on.
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^http://localhost:\d+$",
        r"^http://127\.0\.0\.1:\d+$",
    ]
# Production frontend origin(s) — e.g. https://your-app.vercel.app — comma
# separated if there's more than one (a preview + a production domain).
_extra_cors_origins = config('CORS_ALLOWED_ORIGINS', default='')
if _extra_cors_origins:
    CORS_ALLOWED_ORIGINS += [o.strip() for o in _extra_cors_origins.split(',') if o.strip()]
CORS_ALLOW_CREDENTIALS = True

# Needed for Django admin (session+CSRF auth) to accept POSTs once the app
# is served from a Render domain instead of localhost.
CSRF_TRUSTED_ORIGINS = [
    o for o in config('CSRF_TRUSTED_ORIGINS', default='').split(',') if o.strip()
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# Email backend — console in dev, SMTP in production via env vars
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='Mimba Yangu <noreply@mimbayangu.tz>')

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# The refresh token is delivered as an httpOnly cookie rather than in the
# response body, so JS (and thus XSS) never has access to it. The access
# token still goes in the JSON body — the frontend keeps it in memory only.
AUTH_COOKIE = 'refresh_token'
# 'Strict' works for local dev (frontend + backend both on localhost, so
# same-site). Render + Vercel are DIFFERENT registrable domains, so the
# cookie must be set to AUTH_COOKIE_SAMESITE=None in that environment or the
# browser will silently refuse to send it on cross-site requests, breaking
# login/refresh entirely. SameSite=None requires Secure, which is already
# forced on by AUTH_COOKIE_SECURE below whenever DEBUG=False.
AUTH_COOKIE_SAMESITE = config('AUTH_COOKIE_SAMESITE', default='Strict')
AUTH_COOKIE_SECURE = config('AUTH_COOKIE_SECURE', default=not DEBUG, cast=bool)

# ── Auth throttling ─────────────────────────────────────────────────────────
# (requests, window_seconds) per scope. DRF's built-in rate strings only
# support second/minute/hour/day windows, so login/password-reset use a
# custom throttle (accounts.throttles.ConfigurableWindowThrottle) that reads
# straight from this dict instead.
AUTH_THROTTLE_RATES = {
    'login': (
        config('LOGIN_THROTTLE_LIMIT', default=5, cast=int),
        config('LOGIN_THROTTLE_WINDOW_SECONDS', default=600, cast=int),
    ),
    'password_reset': (
        config('PASSWORD_RESET_THROTTLE_LIMIT', default=5, cast=int),
        config('PASSWORD_RESET_THROTTLE_WINDOW_SECONDS', default=600, cast=int),
    ),
}

# ── AI (Google Gemini) ─────────────────────────────────────────────────────
# Get a key at https://aistudio.google.com/app/apikey. The chat falls back to
# a friendly "service unavailable" message if the key is missing or invalid.
GEMINI_API_KEY = config('GEMINI_API_KEY', default='')
GEMINI_MODEL = config('GEMINI_MODEL', default='gemini-2.5-flash')

# Conversation history sent to the model (covers ~10 user/assistant turns).
AI_CHAT_HISTORY_LIMIT = config('AI_CHAT_HISTORY_LIMIT', default=20, cast=int)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'chatbot.ai_engine': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'chatbot.views': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'clinical.views': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
    },
}
