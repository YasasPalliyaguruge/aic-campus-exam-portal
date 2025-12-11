# Changelog

## [2025-12-11] - Server-Side Time Implementation v2 (Security Critical)

### 🔒 Security Fix
- **Server Time Synchronization v2**: Completely rewrote to use Firestore `serverTimestamp()` for TRUE server time:
  - **Problem**: International students couldn't access exams due to timezone issues
  - **Problem**: Students could manipulate device clocks to bypass exam schedules
  - **Solution**: Fetch ACTUAL server time from Firebase servers using `serverTimestamp()`
  - **Result**: Completely immune to client clock manipulation
  
### 🆕 New Files
- `src/services/serverTime.ts` - Server time synchronization using Firestore serverTimestamp()
- `SERVER_TIME_IMPLEMENTATION.md` - Detailed documentation of the security implementation

### ✏️ Modified Files
- **`src/App.tsx`**: Added server time sync initialization on app load
- **`src/services/api.ts`**: Re-syncs server time before EVERY schedule validation
- **`src/components/exam/ActiveExam.tsx`**: Re-syncs server time for timer calculation
- **`src/components/exam/StudentReview.tsx`**: Uses server time for edit availability
- **`src/components/dashboard/ProctorView.tsx`**: Uses server time for elapsed displays
- **`src/components/dashboard/Overview.tsx`**: Uses server time for live feed
- **`firestore.rules`**: Added `_server_time_sync` collection for time sync documents

### 🔧 Technical Details
- Uses Firestore `serverTimestamp()` - assigned by Google's servers, not client
- Re-syncs server time before every critical operation (login, timer init, schedule check)
- Works correctly for students in ANY timezone
- Works correctly even if student changes their device clock
- No dependency on Firebase Realtime Database

---

## [2025-12-10] - Rich Text Editor & UI Enhancements

### ✨ New Features
- **Advanced Rich Text Editor**: Replaced standard text areas with a feature-rich editor for both exam creation and student answers.
  - **Formatting**: Bold, Italic, Underline, Strikethrough.
  - **Tables**: Custom table insertion with row/column selection modal (1-20 rows, 1-10 cols) and high-contrast styling.
  - **Lists**: Bullet and Numbered lists.
  - **Other**: Blockquotes, Horizontal Lines, Links.
- **Custom Modal Dialogs**: Replaced all native browser alerts (`window.alert`, `window.confirm`) with beautiful, animated React modals.
  - **Types**: Info, Success, Warning, Error, Confirm, Delete.
  - **Features**: Backdrop blur, keyboard dismissal, focus management.
- **Improved Styling**: 
  - **Questions**: Optimized font size for readability (`text-base/lg`), medium weight.
  - **Tables**: High-contrast design (Dark Indigo headers, light gray cells, violet borders) for better accessibility.

### 🛠️ Fixes & Improvements
- **Editor UX**: 
  - Fixed single-click focus issue.
  - Added active state highlighting for toolbar buttons (Bold, Italic, etc.).
  - Moved editor modals (Table, Link) to center screen using Portals for better visibility.
- **Proctoring**: Updated violation alerts to use custom modals.
- **PDF Export**: Enhanced to render HTML content properly to avoid displaying raw tags.

### 🗑️ Removed
- **"Clear Formatting" Button**: Removed from editor toolbar to simplify UI.
- **Native Alerts**: Removed usage of system dialogs in favor of custom UI.
