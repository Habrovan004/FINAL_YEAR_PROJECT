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

# Install dependencies
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers Pillow

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
