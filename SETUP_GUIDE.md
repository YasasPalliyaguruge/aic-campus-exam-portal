# 🚀 AIC Campus Exam Portal - Setup Guide

## Prerequisites

- **Node.js**: Version 16 or higher ([Download](https://nodejs.org/))
- **Firebase Account**: [Create one](https://console.firebase.google.com)

---

## Step 1: Install Dependencies

```bash
# Navigate to project folder
cd aic-campus-exam-portal

# Install all dependencies
npm install
```

This may take a few minutes. Wait for it to complete.

---

## Step 2: Configure Firebase

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a project"**
3. Name it (e.g., `aic-campus-exam-portal`)
4. Disable Google Analytics (optional)
5. Click **Create project**

### 2.2 Setup Authentication

1. In Firebase Console, go to **Authentication**
2. Click **"Get started"**
3. Enable **Email/Password** provider
4. Enable **Anonymous** provider (for students)

### 2.3 Setup Firestore Database

1. Go to **Firestore Database**
2. Click **"Create database"**
3. Choose **Production mode**
4. Select a location close to your users
5. Click **Enable**

### 2.4 Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll to **"Your apps"** section
3. Click **Web icon** (</>)
4. Register app with any name
5. Copy the config object

---

## Step 3: Configure Environment

1. Create a file named `.env.local` in the project root
2. Add your Firebase config:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
```

---

## Step 4: Setup Firestore Rules

Copy the contents of `firestore.rules` to Firebase:

1. Go to Firebase Console → **Firestore Database**
2. Click the **Rules** tab
3. Replace the content with the rules from `firestore.rules`
4. Click **Publish**

---

## Step 5: Create Admin User

1. Go to Firebase Console → **Authentication**
2. Click **"Add user"**
3. Enter admin credentials:
   - Email: `admin@aic.edu` (or your preference)
   - Password: A secure password
4. Click **Add user**

---

## Step 6: Run the Application

```bash
npm run dev
```

You should see:
```
VITE v4.x.x  ready in 500 ms
➜  Local:   http://localhost:3000/
```

Open `http://localhost:3000` in your browser.

---

## Step 7: Initial Setup in App

1. Login as admin with the credentials you created
2. Go to **Academic** → Create a program
3. Go to **Students** → Enroll students
4. Go to **Exams** → Create and publish exams

---

## 🔧 Troubleshooting

### "vite is not recognized"
```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Firebase Errors
- Check `.env.local` has correct values
- Ensure Authentication providers are enabled
- Verify Firestore rules are deployed

### "Permission denied"
- Check Firebase Console → Firestore → Rules
- Make sure rules from `firestore.rules` are published

### Student can't login
- Ensure **Anonymous** authentication is enabled
- Check that exam is PUBLISHED
- Verify access code is correct

---

## 📁 Project Files

```
aic-campus-exam-portal/
├── .env.local           # Your Firebase config (create this)
├── .env.example         # Template for .env.local
├── firestore.rules      # Security rules for Firestore
├── package.json         # Project dependencies
├── src/                 # Source code
│   ├── components/      # React components
│   ├── services/        # API services
│   └── firebase.ts      # Firebase initialization
└── README.md            # Project documentation
```

---

## 🚀 Production Deployment

### Build for Production

```bash
npm run build
```

This creates a `dist` folder with optimized files.

### Deploy to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize hosting
firebase init hosting
# Select your project
# Set public directory to: dist
# Configure as SPA: Yes

# Deploy
firebase deploy
```

### Post-Deployment

1. Add your domain to **Authorized domains** in Firebase Auth settings
2. Update any environment-specific configurations

---

## 📞 Support

For issues or questions, check:
- `TESTING_GUIDE.md` - Common workflows and testing
- `FIREBASE_AUTH_SETUP.md` - Authentication setup details
