# 🚀 NEXT STEP: Enable Firestore Database

## ✅ Good News!
**Firebase Authentication is working!** The app successfully authenticated you.

## ❌ Current Issue
**Firestore Database is not enabled.** This is why you see:
> "Failed to get document because the client is offline"

---

## 📋 What to Do Right Now

### 1️⃣ Go to Firebase Console
**URL**: https://console.firebase.google.com/

### 2️⃣ Select Your Project
Click on: **aic-campus-exam-portal**

### 3️⃣ Enable Firestore
1. Click **"Firestore Database"** in the left sidebar
2. Click **"Create database"** button
3. Select **"Start in production mode"**
4. Click **"Next"**
5. Choose your region:
   - **asia-south1** (Mumbai) - recommended for India
   - **us-central1** (Iowa) - recommended for US
   - **europe-west1** (Belgium) - recommended for Europe
6. Click **"Enable"**
7. Wait 1-2 minutes for it to be created

### 4️⃣ Set Security Rules
1. Click the **"Rules"** tab
2. Paste this code:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
    match /programs/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /exams/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /sessions/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **"Publish"**

### 5️⃣ Test Your App
1. Go back to http://localhost:3000
2. Refresh the page (F5)
3. Login with:
   - Email: `admin@aic.edu`
   - Password: `admin123`
4. **Success!** Your app should now work! 🎉

---

## ⏰ Time Required
- **5 minutes total**
- 2 minutes to enable Firestore
- 1 minute to set rules
- 2 minutes to test

---

## 🎯 What Will Happen

After you enable Firestore, the app will automatically:
- ✅ Create your user profile in Firestore
- ✅ Create collections: `users`, `exams`, `programs`, `sessions`
- ✅ Sync all data in real-time
- ✅ Work perfectly!

---

## 💡 Why This Step is Manual

Firebase requires you to:
1. Choose a **location** for your database (cannot be changed later)
2. Review **pricing** (free tier is generous)
3. Acknowledge **security rule** implications

That's why it can't be automated from code.

---

## 🆘 Need Help?

If you get stuck:
1. Make sure you're in the right Firebase project
2. Look for "Firestore Database" in the sidebar (NOT "Realtime Database")
3. See the visual guide image above
4. Check FIRESTORE_SETUP.md for more details

---

**You're almost there! Just enable Firestore and you're done!** 🚀
