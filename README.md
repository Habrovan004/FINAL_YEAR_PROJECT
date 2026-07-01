# 🤱 UZAZI-SAFE-LINK
### A Web-Based Telemedicine System for Maternal Health and Pre-Natal Care
**Ardhi University — Final Year Dissertation Project**

---

## 🏗️ Project Structure

```
uzazi-safe-link/
├── backend/       # Django REST Framework API
└── frontend/      # React + TypeScript + Vite
```

---

## ⚙️ Backend Setup (Django)

```bash
cd backend

# Install dependencies (pinned in requirements.txt)
pip install -r requirements.txt

# Configure environment — copy the template and fill in real values
cp .env.example .env
#  • GEMINI_API_KEY — get one at https://aistudio.google.com/app/apikey
#  • SECRET_KEY     — any random 50-char string
#  • EMAIL_*        — Gmail app password or another SMTP provider

# Run migrations
python manage.py migrate

# Load hospital seed data
python manage.py loaddata hospitals/fixtures/hospitals.json

# Create admin user
python manage.py createsuperuser

# Start server
python manage.py runserver
```

API runs at: **http://localhost:8000**
Admin panel: **http://localhost:8000/admin**

### Health Assistant (AI chatbot)
The mother-facing chat is powered by Google Gemini (default model
`gemini-2.5-flash`). The integration lives in
`backend/services/gemini_service.py` and is consumed by
`backend/chatbot/ai_engine.py`. When `GEMINI_API_KEY` is empty the engine
returns a clearly-marked "service unavailable" reply instead of a fake answer.
Status probe: `GET /api/chatbot/status/` → `{ai_available, model}`.

### Scheduled background jobs
Appointment SMS reminders, "mark missed" sweeps, and medication-dose SMS
reminders are all packaged as management commands. Run the omnibus command
every 15–30 minutes from Windows Task Scheduler, cron, or Celery Beat:

```bash
python manage.py run_scheduled_tasks
```

Individual commands are also available:
- `send_appointment_reminders [--hours] [--mark-missed]`
- `send_medication_reminders`

All commands are idempotent — re-running won't double-send.

#### Windows Task Scheduler
Action → Start a program  
Program: `python`  
Arguments: `manage.py run_scheduled_tasks`  
Start in: absolute path to `backend/`  
Trigger: every 15 minutes.

#### cron (Linux/macOS)
```cron
*/15 * * * * cd /path/to/backend && /path/to/venv/bin/python manage.py run_scheduled_tasks
```

---

## 🌐 Frontend Setup (React)

```bash
cd frontend
npm install
npm run dev
```

App runs at: **http://localhost:5173**

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Create account |
| POST | `/api/auth/login/` | Login (returns JWT) |
| POST | `/api/auth/send-otp/` | Resend verification code |
| POST | `/api/auth/password-reset/request/` | Request password reset code |
| POST | `/api/auth/password-reset/confirm/` | Confirm password reset |
| GET | `/api/auth/me/` | Current user |
| GET/PATCH | `/api/patients/profile/` | Patient profile |
| GET | `/api/patients/pregnancy-info/` | Week & trimester |
| GET | `/api/hospitals/?lat=&lng=` | Hospital list |
| GET/POST | `/api/tracking/` | Mood + symptom logs |
| GET | `/api/tracking/timeline/` | Last 7 days |
| GET/POST | `/api/appointments/` | Appointments |
| GET | `/api/tips/` | Tips (filter: ?trimester=1) |
| GET | `/api/tips/categories/` | Tip categories |
| POST | `/api/tips/{id}/bookmark/` | Toggle bookmark |
| GET | `/api/tips/saved/` | Saved tips |
| POST | `/api/emergency/log/` | Log emergency action |
| POST | `/api/patients/skip-onboarding/` | Skip hospital selection |
| GET | `/api/patients/baby-growth/` | Baby growth (all weeks, or `?week=N` for closest match) |
| GET/POST | `/api/chat/rooms/` | Direct provider↔patient chat rooms |
| GET/POST | `/api/chat/rooms/<id>/messages/` | Chat messages |
| POST | `/api/chat/rooms/<id>/mark-read/` | Mark messages read |

---

## 📱 Pages

| Page | Route | Description |
|------|-------|-------------|
| Splash | `/` | Landing screen |
| Onboarding | `/onboarding/*` | 8-step signup wizard |
| Login | `/login` | Sign in |
| Password Reset | `/password-reset/request` | Request SMS reset code |
| Password Reset Confirm | `/password-reset/confirm` | Set new password |
| Home | `/home` | Dashboard |
| Track | `/track` | Daily mood + symptoms |
| Timeline | `/timeline` | Health charts & history |
| Learn | `/learn` | Tips & educational content |
| Appointments | `/appointments` | ANC visits |
| Profile | `/profile` | User settings |
| Emergency | `/emergency` | SOS contacts |

---

## 🗄️ Database Models

- **User** — phone-based auth (custom AbstractBaseUser)
- **PatientProfile** — pregnancy data, preferences, hospital
- **Hospital** — name, location, coordinates, services
- **MoodLog** — daily mood (1–5), symptoms array, notes
- **Appointment** — visit type, date/time, hospital, status
- **TipCategory** — learning content categories
- **Tip** — bilingual (EN/SW) health tips with trimester filter
- **Bookmark** — saved tips per user
- **EmergencyLog** — SOS action audit trail

---

## 🌍 Languages
English & Swahili (bilingual model fields included)

## 🕐 Timezone
Africa/Dar_es_Salaam (UTC+3)
