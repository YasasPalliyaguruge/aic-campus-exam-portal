# 🔐 Firebase Authentication Setup for Production

## Required Setup for Student Login to Work

Students use **Anonymous Authentication** to login. This allows anyone with a valid access code to take exams without needing a Firebase account.

---

## Step 1: Enable Anonymous Authentication

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **Authentication** in the left sidebar
4. Go to the **Sign-in method** tab
5. Find **"Anonymous"** in the list
6. Click on it and **Enable** it
7. Click **Save**

✅ Without this, students will get an error when trying to login!

---

## Step 2: Deploy Firestore Security Rules

The file `firestore.rules` in this project contains the security rules.

### Option A: Deploy via Firebase CLI

```bash
# Install Firebase CLI if not installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize (if not done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

### Option B: Manual Copy in Console

1. Go to Firebase Console → Firestore Database
2. Click the **Rules** tab
3. Copy the contents of `firestore.rules` file
4. Paste and click **Publish**

---

## Step 3: Verify Authorized Domains (For Hosting)

If you're hosting on a domain other than localhost:

1. Go to Firebase Console → Authentication
2. Click **Settings** tab
3. Go to **Authorized domains**
4. Add your hosting domain (e.g., `your-app.web.app`, `your-domain.com`)

---

## Security Rules Explanation

```javascript
// Users, Programs, Exams: 
// - Anyone logged in (including anonymous) can READ
// - Only admin users can WRITE

// Sessions:
// - Anyone logged in can READ and WRITE
// - This allows students to start sessions and submit answers
```

---

## How Student Login Works

1. Student enters email + access code
2. App signs in **anonymously** to Firebase Auth
3. App queries Firestore for the student with that email
4. App checks if the access code matches any published exam
5. If valid, student is logged in and can take the exam

### This means:
- ✅ Students do NOT need a Firebase account
- ✅ Students do NOT need admin access
- ✅ Any device can login as a student
- ✅ No cookies or session data from admin is needed

---

## Testing Student Login

To verify student login works independently:

1. Open an **Incognito/Private browser window**
2. Go to your app URL
3. Click "Student Login"
4. Enter the student email and access code
5. Student should be able to login and take the exam

If you see errors:
- Check Firebase Console → Authentication → Check if Anonymous is enabled
- Check browser console for specific error messages

---

## Common Errors & Fixes

### Error: "auth/operation-not-allowed"
**Fix:** Enable Anonymous Authentication in Firebase Console

### Error: "permission-denied"
**Fix:** Deploy the Firestore security rules

### Error: "Student not found"
**Fix:** Make sure the student email exists in the `users` collection

### Error: "Invalid Access Code"
**Fix:** Check that the exam is PUBLISHED and the access code is correct

---

## Summary Checklist

- [ ] Anonymous Authentication is **enabled** in Firebase Console
- [ ] Firestore Security Rules are **deployed**
- [ ] Hosting domain is in **Authorized domains** (if not localhost)
- [ ] Student exists in **users** collection with role = "STUDENT"
- [ ] Exam is **PUBLISHED** with generated access codes
