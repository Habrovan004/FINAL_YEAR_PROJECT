
# ✅ TESTING CHECKLIST - UZAZI SAFE LINK

## Pre-Test Verification

- [ ] Python 3.9+ installed:  
  ```bash
  python --version
  ```

- [ ] Node.js 16+ installed:  
  ```bash
  node --version
  ```

- [ ] Dependencies installed:
  ```bash
  cd backend && pip install -r requirements.txt
  cd ../frontend && npm install
  ```

- [ ] .env files configured:
  - [ ] `backend/.env` created with AT_USERNAME and AT_API_KEY
  - [ ] `frontend/.env` has VITE_API_URL pointing to backend

---

## 🔌 Backend Tests (Django)

### **1. Server Startup**
- [ ] Start backend:
  ```bash
  cd backend
  python manage.py runserver
  ```
  
- [ ] Verify output:
  ```
  Starting development server at http://127.0.0.1:8000/
  ```

### **2. Database Migrations**
- [ ] Check DB is ready:
  ```bash
  python manage.py migrate
  ```
  
- [ ] Create superuser (if not exists):
  ```bash
  python manage.py createsuperuser
  ```

### **3. Test Each Auth Endpoint**

#### **A. Register Endpoint** ✅
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "0712345678",
    "full_name": "Test User",
    "password": "testpass123",
    "user_type": "patient",
    "date_of_birth": "1995-05-15"
  }'
```

**Expected Response:**
```
Status: 201 Created
✓ Response includes "user" object
✓ "is_onboarded": false
✓ "is_verified": false
✓ "dev_otp" included (if DEBUG=True)
✓ Console logs OTP code
```

#### **B. Send OTP Endpoint** ✅
```bash
curl -X POST http://localhost:8000/api/auth/send-otp/ \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "0712345678"}'
```

**Expected Response:**
```
Status: 200 OK
✓ Message: "OTP code sent successfully."
✓ New "dev_otp" in response
✓ Console logs new OTP code
```

#### **C. Verify OTP Endpoint** ✅
```bash
# Use the OTP code from console output
curl -X POST http://localhost:8000/api/auth/verify-otp/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "0712345678",
    "code": "123456"
  }'
```

**Expected Response:**
```
Status: 200 OK
✓ "access" token (JWT)
✓ "refresh" token
✓ user.is_verified: true
✓ user.is_onboarded: false
✓ user.user_type: "patient"
```

#### **D. Login Endpoint** ✅
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "0712345678",
    "password": "testpass123"
  }'
```

**Expected Response:**
```
Status: 200 OK
✓ Same token structure as verify-otp
✓ user object includes is_onboarded status
```

#### **E. Me Endpoint (Authenticated)** ✅
```bash
curl -X GET http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```
Status: 200 OK
✓ Current user data
✓ is_onboarded field present
```

### **4. Test Patient Profile Endpoint**

#### **Before Hospital Selection**
```bash
curl -X GET http://localhost:8000/api/patients/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response should show:**
```
✓ "onboarding_completed": false
✓ "is_onboarded": false
✓ "hospital": null
```

#### **After Hospital Selection**
```bash
curl -X PATCH http://localhost:8000/api/patients/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hospital": 1}'
```

**Response should show:**
```
✓ "onboarding_completed": true
✓ "is_onboarded": true
✓ "hospital": 1
✓ "hospital_name": "Hospital Name"
```

---

## 🎨 Frontend Tests (React)

### **1. Server Startup**
- [ ] Start frontend:
  ```bash
  cd frontend
  npm run dev
  ```
  
- [ ] Verify output shows:
  ```
  VITE v5.x.x  ready in XXX ms
  
  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
  ```

### **2. Test Splash Page**
- [ ] Open browser: http://localhost:5173
- [ ] Page loads without errors
- [ ] See "Uzazi Safe Link" title
- [ ] Can navigate to /login and /onboarding

### **3. Test Registration Flow**

#### **Step 1: Go to Signup**
- [ ] Navigate to `/onboarding`
- [ ] Form loads correctly
- [ ] All fields visible: Full Name, Phone, Password, Confirm Password, User Type

#### **Step 2: Fill & Submit**
- [ ] Enter:
  - Full Name: "Jane Test"
  - Phone: "0712345678"
  - Password: "testpass123"
  - User Type: "Patient"
  
- [ ] Click "Sign Up"
- [ ] Form submits to `/api/auth/register/`

#### **Step 3: OTP Page**
- [ ] Redirected to `/onboarding/verify`
- [ ] Shows phone number: "0712345678"
- [ ] OTP input boxes appear (6 boxes)
- [ ] Paste OTP from:
  - Console (if DEBUG=True)
  - Or API response (dev_otp field)

#### **Step 4: Verify**
- [ ] Enter all 6 digits
- [ ] "Confirm & Enter" button enabled
- [ ] Click button
- [ ] Shows "Verified!" screen briefly
- [ ] Redirected to `/onboarding/hospital`

#### **Step 5: Hospital Selection** 🏥
- [ ] Map appears showing hospitals
- [ ] Hospital list visible below map
- [ ] Can search hospitals
- [ ] Can filter by type (Public/Private)
- [ ] Click on hospital to select
- [ ] Selected hospital shows checkmark
- [ ] "Continue" button enabled
- [ ] Click "Continue"

#### **Step 6: Home Page** ✅
- [ ] Redirected to `/home`
- [ ] Displays user's name
- [ ] Shows pregnancy info
- [ ] Navigation menu visible
- [ ] Can access other pages

### **4. Test Login Flow**

#### **Case 1: Onboarded User**
- [ ] Go to `/login`
- [ ] Enter: Phone "0712345678", Password "testpass123"
- [ ] Submit
- [ ] Redirects to `/home` (already onboarded)

#### **Case 2: Non-onboarded User** (create new account without hospital)
- [ ] Go to `/login`
- [ ] Enter existing credentials
- [ ] Submit
- [ ] Redirects to `/onboarding/hospital` (not yet onboarded)
- [ ] Complete hospital selection → back to `/home`

### **5. Test Navigation**
From `/home`, verify all pages accessible:
- [ ] `/track` → Track page loads
- [ ] `/timeline` → Timeline page loads
- [ ] `/learn` → Learn page loads
- [ ] `/appointments` → Appointments page loads
- [ ] `/profile` → Profile page loads
- [ ] `/emergency` → Emergency page loads

### **6. Test Persistent Login**
- [ ] Login successfully
- [ ] Refresh page → Still logged in
- [ ] Close browser, reopen → Still logged in (session restored)
- [ ] Logout → Redirected to `/` (splash)
- [ ] Refresh → Still on splash (not logged in)

---

## 🔄 Integration Tests

### **Test 1: Complete New User Journey**
```
1. ✅ Visit website
2. ✅ Click Sign Up
3. ✅ Fill registration form
4. ✅ Verify OTP
5. ✅ Select hospital
6. ✅ Access home page
7. ✅ Navigate to other pages
8. ✅ Logout
```

### **Test 2: Returning User Journey**
```
1. ✅ Visit website
2. ✅ Click Login
3. ✅ Enter credentials
4. ✅ Redirected to home (if onboarded)
5. ✅ Refresh persists login
6. ✅ Logout works
```

### **Test 3: Hospital Selection State Management**
```
1. ✅ Before hospital selection: is_onboarded = false
2. ✅ Select hospital
3. ✅ Frontend calls refreshUser()
4. ✅ After refresh: is_onboarded = true
5. ✅ Redirects to /home
```

### **Test 4: Token Expiry & Refresh**
```
1. ✅ Login successfully
2. ✅ Make authenticated request
3. ✅ [Backend manually expire token]
4. ✅ Make another request
5. ✅ Interceptor catches 401
6. ✅ Uses refresh token to get new access token
7. ✅ Original request retries with new token
```

---

## 🐛 Error Handling Tests

### **Test 1: Invalid OTP**
- [ ] Register → OTP page
- [ ] Enter wrong code
- [ ] Click verify
- [ ] Shows error: "Invalid or expired OTP"
- [ ] Clears input boxes
- [ ] Focus on first box

### **Test 2: Expired OTP**
- [ ] Register → wait > 10 minutes
- [ ] Try to verify old OTP
- [ ] Shows error: "Invalid or expired OTP"
- [ ] "Resend Code" button works

### **Test 3: Wrong Login Credentials**
- [ ] Go to /login
- [ ] Enter wrong password
- [ ] Shows error: "Invalid credentials"
- [ ] Form remains filled (for retry)

### **Test 4: Unverified Account Login**
- [ ] Register but don't verify OTP
- [ ] Try to login
- [ ] Shows error: "Account not verified"

### **Test 5: Network Errors**
- [ ] Stop backend server
- [ ] Try to login
- [ ] Shows generic error message
- [ ] No sensitive info leaked
- [ ] Can retry after backend restarts

---

## 📊 Browser DevTools Checks

### **Application Tab**
- [ ] LocalStorage contains:
  - [ ] `access_token` (JWT)
  - [ ] `refresh_token` (JWT)
  - [ ] Other app data if saved

### **Network Tab**
- [ ] Monitor API calls:
  - [ ] `/api/auth/register/` → 201 Created
  - [ ] `/api/auth/verify-otp/` → 200 OK (tokens in response)
  - [ ] `/api/patients/profile/` → 200 OK
  - [ ] Token includes: `Authorization: Bearer xxx`

### **Console Tab**
- [ ] No 404 errors for static assets
- [ ] No CORS errors
- [ ] No TypeScript errors (in browser console)
- [ ] Django prints OTP code on register/resend

---

## 🚀 Production Readiness

### **Before Deploying:**
- [ ] Set `DEBUG=False` in backend `.env`
- [ ] Update `SECRET_KEY` in `.env` to unique value
- [ ] Set `ALLOWED_HOSTS` to your domain
- [ ] Update `VITE_API_URL` in `.env.production` to real API
- [ ] Set real `AT_API_KEY` from Africa's Talking
- [ ] Run `npm run build` for frontend
- [ ] Verify HTTPS is enabled
- [ ] Test SMS delivery with real phone

---

## ✨ Success Criteria

### **All Tests Pass When:**
- [ ] Backend responds correctly to all endpoints
- [ ] Frontend renders all pages
- [ ] Complete registration flow works
- [ ] Hospital selection updates onboarding status
- [ ] Login redirects based on onboarding status
- [ ] Logout clears tokens
- [ ] No console errors
- [ ] No API errors in production
- [ ] SMS sends successfully (in production)

---

## 📞 Support

**If tests fail:**

1. Check backend is running: `python manage.py runserver`
2. Check frontend is running: `npm run dev`
3. Check `.env` files are configured
4. Check network tab for API errors
5. Check Django console for error messages
6. Review `FIXES_SUMMARY.md` for changes made

**Common Issues:**

| Issue | Solution |
|-------|----------|
| 404 on API calls | Backend not running / wrong URL |
| CORS errors | Check `CORS_ALLOWED_ORIGINS` in settings.py |
| OTP not accepted | Verify code copy-paste, check expiry |
| Stuck on hospital selection | Check network tab, ensure hospital ID is valid |
| localStorage empty | Check if tokens were returned from API |

---

**Happy Testing! 🎉**

