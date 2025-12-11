# 🎓 AIC Campus Exam Portal

A comprehensive, web-based assessment solution designed to facilitate secure, remote examinations. Features a modern, high-fidelity frontend with real-time proctoring capabilities.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v16 or higher
- **Firebase Account** with a configured project

### Installation

```bash
# Clone the repository
cd aic-campus-exam-portal

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Firebase config

# Start development server
npm run dev
```

Visit `http://localhost:3000` to access the portal.

---

## 👥 User Roles

| Role | Access | Description |
|------|--------|-------------|
| **Administrator** | Full access | Manages programs, modules, users, exams |
| **Lecturer** | Dashboard access | Creates exams, monitors sessions, grades submissions |
| **Student** | Exam only | Takes assigned exams in secure environment |

---

## ✨ Features

### 📊 Admin Dashboard

- **Academic Management**: Create/edit programs and modules
- **Student Registry**: Enroll students, assign to programs
- **Exam Authoring**: Create exams with multiple question types
  - Multiple Choice (Single/Multi-select)
  - True/False
  - Short Answer
  - Essay
- **Scheduling**: Set exam windows with start/end times
- **Access Code Distribution**: Auto-generated secure codes per student

### 🎥 Live Proctoring

- **Real-time Webcam Feeds**: Grid view of all active students
- **Violation Detection**: Tab switching, fullscreen exit
- **Admin Actions**:
  - Send warnings to students
  - Extend individual time
  - Terminate sessions

### ✍️ Rich Exam Experience

- **Advanced Rich Text Editor**: 
  - Format questions and answers with Bold, Italic, Lists, and Links
  - **Custom Tables**: Create sized tables with high-contrast styling
  - **Multimedia Support**: Questions support formatted text
- **Modern UI**:
  - **Custom Modals**: Beautiful, animated dialogs for all interactions
  - **Dark Mode**: Fully supported across all interfaces

### ⏱️ Exam Scheduling

- **Time Window Enforcement**: Students can only login during scheduled times
- **Late Student Handling**: Timer shows remaining window, not full duration
- **Auto-Submit**: Automatic submission when exam window closes
- **Time Extensions**: Admin can grant extra time to individual students

### 📝 Student Exam Interface

- **Fullscreen Mode**: Enforced secure environment
- **Webcam Streaming**: Live feed to proctors
- **Violation Logging**: Tab switches and fullscreen exits recorded
- **Auto-Save**: Answers saved periodically
- **Review Page**: Students can review their submission after completing

### 📊 Grading Center

- **Submission Review**: View all student answers
- **Manual Grading**: Score essays and short answers
- **Feedback**: Add per-question notes
- **Export**: Generate PDF reports

---

## 🔐 Authentication

### Admin/Lecturer Login
- Email + Password (Firebase Authentication)

### Student Login
- Email + Access Code (Anonymous Authentication)
- Access codes are generated when exam is published
- Case-insensitive, whitespace-tolerant

---

## 📁 Project Structure

```
src/
├── components/
│   ├── auth/           # Login portal
│   ├── dashboard/      # Admin views (Overview, Proctor, Grading)
│   ├── exam/           # Exam components (ActiveExam, StudentReview)
│   ├── academic/       # Academic management
│   ├── layout/         # Dashboard layout
│   └── ui/             # Reusable UI components
├── contexts/           # React contexts (App, Theme)
├── services/           # API and Firebase services
└── types.ts            # TypeScript type definitions
```

---

## 🔧 Configuration

### Environment Variables (.env.local)

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Firebase Setup Required

1. **Enable Authentication Methods**:
   - Email/Password (for admins)
   - Anonymous (for students)

2. **Deploy Firestore Rules**:
   - Copy `firestore.rules` to Firebase Console

3. **Add Authorized Domains**:
   - Add your hosting domain if not localhost

See `FIREBASE_AUTH_SETUP.md` for detailed instructions.

---

## 📱 Key Workflows

### Admin: Create & Publish Exam

1. Go to **Exams** → Click **"Create New Exam"**
2. Add exam details and questions
3. Select students to assign
4. Set scheduled start/end times
5. Click **"Publish & Generate Keys"**
6. Share access codes with students

### Student: Take Exam

1. Navigate to the portal
2. Click **"Student Exam"** tab
3. Enter email and access code
4. Complete exam in fullscreen mode
5. Submit or wait for auto-submit
6. Review submission and logout

### Admin: Monitor & Grade

1. Go to **Live Proctoring** to watch active exams
2. Send warnings or extend time as needed
3. Go to **Grading Center** after exam ends
4. Review and score submissions

---

## 🛡️ Security Features

- ✅ Fullscreen enforcement
- ✅ Tab switch detection
- ✅ Webcam proctoring
- ✅ Session persistence (survives page refresh)
- ✅ Anonymous auth for students (no Firebase account needed)
- ✅ Time-window based access control
- ✅ One-time access codes per exam

---

## 📄 Documentation

- `SETUP_GUIDE.md` - Installation and setup instructions
- `FIREBASE_AUTH_SETUP.md` - Firebase configuration for production
- `TESTING_GUIDE.md` - Testing workflows and troubleshooting

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Icons**: Lucide React
- **State**: React Context API

---

## 📝 License

This project is proprietary software developed for AIC Campus.