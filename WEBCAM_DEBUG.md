# Webcam Streaming Debug Checklist

## Step 1: Check Student Side

### Open a student exam session and check the browser console (F12):

**Expected logs:**
```
✅ Webcam stream started successfully
📸 Frame uploaded successfully  (every 5 seconds)
```

**If you see:**
- `Camera denied:` → Grant webcam permission in browser
- `⚠️ Video not ready yet, skipping frame` → Wait a few seconds for video to load
- `Failed to upload frame:` → Check the error details

### Check browser permissions:
1. Click the lock icon in address bar
2. Ensure Camera is set to "Allow"
3. Refresh the page if you just granted permission

---

## Step 2: Check Firestore Data

### Verify frames are being saved:
1. Open Firebase Console
2. Go to Firestore Database
3. Navigate to `sessions` collection
4. Find a session with status = 'IN_PROGRESS'
5. Check if the `currentFrame` field exists and contains base64 image data
   - Should start with: `data:image/jpeg;base64,/9j/4AAQ...`

**If `currentFrame` is missing:**
- Student's webcam isn't uploading frames
- Check console logs on student side

**If `currentFrame` exists but proctor sees black screen:**
- Issue is with ProctorView rendering
- Continue to Step 3

---

## Step 3: Check Proctor Side

### Open proctor dashboard and check console (F12):

**Look for:**
- Any errors related to sessions
- Check if sessions are being loaded
- Type in console: `console.log(sessions)` to see session data

### Check the session data structure:
The session should have:
```javascript
{
  studentId: "...",
  examId: "...",
  status: "IN_PROGRESS",
  currentFrame: "data:image/jpeg;base64,/9j/4AAQ...",  // This is the webcam frame
  violations: [...],
  warnings: [...]
}
```

---

## Step 4: Common Issues

### Issue: Black screens on proctor view
**Possible causes:**
1. Students haven't granted webcam permission
2. Students aren't in active exam (status !== 'IN_PROGRESS')
3. Video element not loaded before capture starts
4. Base64 data is corrupt or empty

### Issue: "Camera denied" error
**Fix:** Grant camera permission in browser settings

### Issue: Frames not uploading
**Fix:** Check that the student is using a browser that supports `getUserMedia`

---

## Step 5: Real-time Testing

### Test with TWO browser windows:

**Window 1 - Student:**
1. Login as student
2. Start exam
3. Grant webcam permission
4. Watch console for "Frame uploaded successfully"

**Window 2 - Proctor:**
1. Login as admin
2. Go to Live Proctoring
3. Open console
4. You should see the student appear
5. Wait 5-10 seconds for first frame to upload
6. Video should appear

---

## Quick Fix: Force Reload

If nothing works:
1. **Stop the dev server** (Ctrl+C)
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Restart dev server**: `npm run dev`
4. **Hard refresh browser** (Ctrl+Shift+R)
5. **Re-login** as both student and admin

---

## Manual Test: Check if video element works

Open browser console on student exam page and run:
```javascript
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    console.log('✅ Camera access granted:', stream);
  })
  .catch(err => {
    console.error('❌ Camera access denied:', err);
  });
```

If this fails, the browser can't access the camera.
