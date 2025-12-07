# 🧪 AIC Campus Exam Portal - Testing Guide

## 📊 Current Status: ✅ FULLY FUNCTIONAL

All features are working. Use this guide to test the complete workflow.

---

## 🔑 Authentication

### Admin Login
- **Email**: Your admin email (e.g., `admin@aic.edu`)
- **Password**: Your admin password

### Student Login
- **Email**: Student's registered email
- **Access Code**: 6-character code from exam (e.g., `ABC123`)
- Access codes are **case-insensitive** and **whitespace-tolerant**

---

## 📋 Complete Test Workflow

### 1. Admin Setup

#### Create a Program
1. Login as admin
2. Go to **Academic** → **Add Program**
3. Enter program name (e.g., "Computer Science")
4. Add at least one module

#### Enroll a Student
1. Go to **Students** → **Enroll Student**
2. Fill in:
   - Student ID: `ST001`
   - Name: `Test Student`
   - Email: `student@test.com`
   - Program: Select the program you created
3. Click **Register Student**

#### Create an Exam
1. Go to **Exams** → **Create New Exam**
2. Step 1: Add exam details
   - Title: "Test Exam"
   - Duration: 30 minutes
   - Add questions (at least one)
3. Step 2: Review questions
4. Step 3: Publish
   - Select the student you created
   - Set start time (now or in past for immediate access)
   - Set end time (future)
   - Click **Publish & Generate Keys**
5. **Copy the access code** shown for the student

---

### 2. Student Exam Flow

#### Login
1. Logout from admin
2. On login page, click **"Student Exam"** tab
3. Enter:
   - Email: `student@test.com`
   - Access Code: The code you copied (e.g., `B4NK7P`)
4. Click **"Verify & Enter Lobby"**

#### Take Exam
1. Exam launches in fullscreen mode
2. Allow webcam access when prompted
3. Answer questions
4. Submit when done (or wait for auto-submit)

#### Review & Logout
1. See completion screen with green checkmark
2. Click **"Return to Home"**
3. Review your submission
4. Click **"Secure Logout"**

---

### 3. Proctoring Test

#### While Student is Taking Exam
1. Open another browser/incognito as admin
2. Go to **Live Proctoring**
3. You should see:
   - Student's webcam feed
   - Violation count
   - Status indicator

#### Test Admin Actions
- **Send Warning**: Click student → "Send Warning Message"
- **Extend Time**: Click student → "Extend Time" → Enter minutes
- **Terminate**: Click student → "Terminate Session"

---

### 4. Grading Test

1. Login as admin
2. Go to **Grading Center**
3. Select an exam with submissions
4. Click on a student
5. Score each question
6. Add feedback
7. Click **Save**

---

## 🔧 Debugging

### Database Debugger
1. Login as admin
2. Go to: `http://localhost:3000/dashboard/debug`
3. View all data:
   - Users collection
   - Exams collection
   - Sessions collection
   - Programs collection

---

## ⏱️ Exam Scheduling Tests

### Test Early Login Block
1. Create exam with **future** start time
2. Try to login as student
3. Should see: "Exam hasn't started yet"

### Test Late Login Block
1. Create exam with **past** end time
2. Try to login as student
3. Should see: "Exam has ended"

### Test Late Student Timer
1. Create exam: 4:00 PM - 5:00 PM (60 min duration)
2. Wait until 4:30 PM
3. Login as student
4. Timer should show **30 minutes** (not 60)

### Test Time Extension
1. Student starts exam
2. Admin opens Live Proctoring
3. Admin clicks student → "Extend Time" → enters "10"
4. Student sees: "🎁 You have been granted 10 extra minutes!"
5. Timer increases by 10 minutes

---

## 🔄 Session Persistence Test

1. Login as admin or student
2. Press **F5** or **Ctrl+R** to refresh
3. You should **stay logged in** (not redirected to login)
4. Check console for: "✅ Firebase session is valid, restoring app state"

---

## ❌ Common Errors & Fixes

### "Student not found"
- **Check**: Student email matches exactly
- **Fix**: Verify email in Students page

### "Invalid Access Code"
- **Check**: Code is correct
- **Fix**: Go to Exams → Click Key icon → Copy exact code
- **Note**: Codes are case-insensitive

### "Exam hasn't started yet"
- **Check**: Exam start time is in the past
- **Fix**: Edit exam and set earlier start time

### "Exam has ended"
- **Check**: Exam end time is in the future
- **Fix**: Edit exam and set later end time

### Session not persisting
- **Check**: Browser allows localStorage
- **Fix**: Clear cache and try again

### Webcam not showing
- **Check**: Camera permission granted
- **Check**: Console for webcam errors
- **Fix**: Allow camera access when prompted

---

## ✅ Feature Checklist

### Admin Features
- [x] Login/Logout with session persistence
- [x] Create programs and modules
- [x] Enroll students
- [x] Create exams with multiple question types
- [x] View/copy access codes
- [x] Live proctoring dashboard
- [x] Send warnings to students
- [x] Extend individual student time
- [x] Terminate sessions
- [x] Grade submissions

### Student Features
- [x] Login with email + access code
- [x] Case-insensitive access code
- [x] Fullscreen exam mode
- [x] Webcam streaming to proctor
- [x] Tab switch detection
- [x] Timer with scheduled end awareness
- [x] Real-time time extensions
- [x] Answer saving
- [x] Submission review

### Scheduling Features
- [x] Block early login (before start time)
- [x] Block late login (after end time)
- [x] Timer respects scheduled window
- [x] Auto-submit when window closes
- [x] Individual time extensions

### Security Features
- [x] Fullscreen enforcement
- [x] Tab switch logging
- [x] Session persistence (survives refresh)
- [x] Anonymous auth for students

---

## 📝 Summary

**Status**: ✅ All features working

**Key Points**:
- Students use **email + access code** (not passwords)
- Access codes are **generated when exam is published**
- Timer respects **scheduled end time** (late students get less time)
- Admin can **extend time** for individual students
- Session **survives page refresh**
