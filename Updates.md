# Changelog

## [2026-05-17] - Secure Exam Timing And Paste Prevention

### Security

- Added Firebase callable functions for student access validation, session start, submission, reopen, violation logging, latest submission lookup, and trusted time sync.
- Moved student schedule and session write validation to Cloud Functions using server time.
- Hardened Firestore rules so anonymous students cannot directly read global users, programs, or exams.
- Restricted anonymous student session writes to webcam `currentFrame` updates only.
- Added `authUid` binding to student sessions so anonymous users can read only their own validated session.

### Exam Timing

- Added timezone-explicit scheduling with `scheduleTimeZone`.
- Added canonical UTC schedule fields:
  - `scheduledStartLocal`
  - `scheduledEndLocal`
  - `scheduledStartMs`
  - `scheduledEndMs`
- Kept `scheduledStart` and `scheduledEnd` UTC ISO strings for compatibility.
- Added a trusted client timer baseline that uses server time plus `performance.now()` elapsed time.

### Paste Prevention

- Added paste, beforeinput paste, and text drop blocking to the shared rich text editor.
- Enabled blocking only for student exam answer editors.
- Added `PASTE_ATTEMPT` proctoring violations.
- Staff authoring and grading fields still allow paste.

### Backend

- Added `functions/` Firebase Functions v2 project.
- Functions use the Admin SDK named database API for Firestore database `exam-portal`.

### Verification

- `npm run build`
- `npm --prefix functions run build`
