# Secure Exam Time Implementation

## Overview

Exam access and critical student session writes are now validated by Firebase Cloud Functions using trusted server time. The browser no longer decides whether a student can start, reopen, or submit an exam.

## How It Works

1. Staff select a schedule timezone for each exam.
2. The app converts the staff-entered local start/end times into canonical UTC milliseconds.
3. Exams store:
   - `scheduleTimeZone`
   - `scheduledStartLocal`
   - `scheduledEndLocal`
   - `scheduledStartMs`
   - `scheduledEndMs`
   - compatibility ISO fields `scheduledStart` and `scheduledEnd`
4. Student access, start, submit, reopen, and violation writes call Firebase Functions.
5. Functions use `Date.now()` on the Cloud Functions server to compare against the stored UTC milliseconds.
6. The client timer uses the server time returned by Functions plus `performance.now()` elapsed time, so changing the device wall clock after login does not grant extra time.

## Security Properties

- Students cannot directly read all exams, programs, or users.
- Anonymous students can only read their own validated session.
- Student session status, answers, start time, submit time, warnings, grades, and extra time are written by Cloud Functions or staff.
- Webcam frame updates remain client-direct but are limited by rules to `currentFrame` only.
- Paste/drop attempts in student answer editors are blocked and logged as `PASTE_ATTEMPT` violations.

## Functions

- `getTrustedTime`
- `validateStudentAccess`
- `getStudentExamContext`
- `startStudentSession`
- `submitStudentSession`
- `reopenStudentSession`
- `logStudentViolation`
- `getLatestStudentSubmission`

## Deployment

Deploy the backend and rules before testing student flows:

```bash
firebase deploy --only functions,firestore:rules
```

Deploy hosting after building the frontend:

```bash
npm run build
firebase deploy --only hosting
```
