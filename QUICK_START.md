# 🚀 QUICK START GUIDE - AFTER FIXES

## Step 1: Backend Setup

```bash
cd backend

# Ensure Python 3.9+ and pip installed
python --version

# Install dependencies
pip install -r requirements.txt

# Create/update .env file with your credentials
cat > .env << EOF
SECRET_KEY=django-insecure-uzazi-safe-link-change-in-production-2026
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
AT_USERNAME=sandbox
AT_API_KEY=your_key_here
EOF

# Run migrations
python manage.py migrate

# Create superuser (admin)
python manage.py createsuperuser

# Load hospital seed data (optional)
python manage.py loaddata hospitals/fixtures/hospitals.json

# Start development server
python manage.py runserver
```

**Expected Output:**
```
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

### Dev tooling: secret scanning (do this once, before your first commit)

This repo runs [ggshield](https://github.com/GitGuardian/ggshield) as a pre-commit
hook to catch accidental secrets before they reach GitHub:

```bash
pip install ggshield
ggshield install -m local
```

`ggshield` is dev-only tooling — it is not a runtime dependency and is not
listed in `requirements.txt`.

---

## Step 2: Frontend Setup

```bash
cd ../frontend

# Install node_modules
npm install

# Create .env for development
echo "VITE_API_URL=http://localhost:8000/api" > .env

# Start Vite dev server
npm run dev
```

**Expected Output:**
```
Local:   http://localhost:5173/
```

---

## Step 3: Test the Complete Flow

### **Option A: New User Registration**

1. **Open browser:** http://localhost:5173
2. **Click "Sign Up"** or navigate to `/onboarding`
3. **Fill registration form:**
   - Full Name: Test User
   - Phone: 0712345678
   - Password: password123
   - User Type: Patient

4. **Submit** → Redirected to OTP verification
5. **Find OTP code:**
   - Check **Django console** output (printed automatically in DEBUG mode)
   - It shows: `VERIFICATION CODE FOR 0712345678: 123456`

6. **Enter OTP** in frontend
7. **Verify** → Should show "Verified!" with redirect
8. **Hospital Selection:**
   - Map shows nearby hospitals
   - Select one (e.g., Mwananyamala Hospital)
   - Click "Continue"

9. **Redirected to `/home`** ✅

### **Option B: Login as Returning User**

1. **Go to `/login`**
2. **Enter credentials from registration**
3. **Login**

**If not onboarded yet:**
- Redirects to `/onboarding/hospital`

**If already onboarded:**
- Redirects to `/home`

---

## Step 4: Test API Endpoints Directly

Using `curl` or Postman:

### **1. Register User**
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "0712345678",
    "full_name": "Jane Doe",
    "password": "securepass123",
    "user_type": "patient"
  }'
```

**Response includes `dev_otp` in DEBUG mode:**
```json
{
  "message": "Account created. Please verify your phone number.",
  "user": {
    "id": 1,
    "is_verified": false,
    "is_onboarded": false,
    ...
  },
  "dev_otp": "123456"
}
```

### **2. Verify OTP**
```bash
curl -X POST http://localhost:8000/api/auth/verify-otp/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "0712345678",
    "code": "123456"
  }'
```

**Response:**
```json
{
  "message": "Verified successfully.",
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "is_verified": true,
    "is_onboarded": false,
    "user_type": "patient"
  }
}
```

### **3. Get Current User (Authenticated)**
```bash
curl -X GET http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response:**
```json
{
  "id": 1,
  "phone_number": "0712345678",
  "full_name": "Jane Doe",
  "is_verified": true,
  "is_onboarded": false,
  "user_type": "patient"
}
```

### **4. Select Hospital (Complete Onboarding)**
```bash
curl -X PATCH http://localhost:8000/api/patients/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hospital": 1
  }'
```

**Response:**
```json
{
  "id": 1,
  "user": 1,
  "hospital": 1,
  "hospital_name": "Mwananyamala Hospital",
  "is_onboarded": true,
  "onboarding_completed": true,
  ...
}
```

**After this, if you call `/api/auth/me/` again:**
```json
{
  "is_onboarded": true,  // ✅ Now true!
  ...
}
```

---

## Step 5: Troubleshooting

### **Issue: "VERIFICATION CODE ... printed to console but OTP fails"**

**Solution:**
- Ensure you're copying the exact 6-digit code
- Wait < 10 minutes from when code was generated
- Code is case-sensitive

### **Issue: "Hospital selection redirects but user still shows `is_onboarded: false`"**

**Solution:**
- Frontend should call `refreshUser()` after PATCH
- If still failing, manually refresh the page
- Check browser DevTools → Application → LocalStorage for tokens

### **Issue: "SMS not sending in production"**

**Solution:**
- Get real API key from [Africa's Talking](https://africastalking.com)
- Update `.env`: `AT_API_KEY=your_real_key_here`
- Set `DEBUG=False` in production

### **Issue: "CORS errors when frontend calls backend"**

**Solution:**
- Ensure `ALLOWED_HOSTS` in `.env` includes your domain
- Check that `VITE_API_URL` in `.env` matches backend address
- For localhost: `http://localhost:8000/api`

---

## 📊 Key Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/auth/register/` | No | Create account |
| POST | `/auth/send-otp/` | No | Resend OTP code |
| POST | `/auth/verify-otp/` | No | Verify OTP & get tokens |
| POST | `/auth/login/` | No | Login (password auth) |
| GET | `/auth/me/` | Yes | Current user info |
| GET | `/patients/profile/` | Yes | Get patient profile |
| PATCH | `/patients/profile/` | Yes | Update profile (hospital) |
| GET | `/patients/pregnancy-info/` | Yes | Week & trimester info |

---

## 🎉 Success Indicators

✅ **Backend:** Django server running on http://localhost:8000  
✅ **Frontend:** Vite dev server running on http://localhost:5173  
✅ **Auth Flow:** Can register → verify OTP → select hospital → access home  
✅ **State Sync:** User state updates correctly after hospital selection  
✅ **Tokens:** JWT tokens stored in localStorage  

**You're ready to go!** 🚀

