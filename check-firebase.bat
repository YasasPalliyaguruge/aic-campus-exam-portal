@echo off
echo ========================================
echo Firebase Configuration Checker
echo ========================================
echo.
echo Checking your .env.local file...
echo.

if exist .env.local (
    echo Found .env.local file
    echo.
    echo Your Firebase Configuration:
    echo.
    findstr "VITE_FIREBASE" .env.local
    echo.
    echo ========================================
    echo IMPORTANT: Check the following:
    echo ========================================
    echo.
    echo 1. Go to: https://console.firebase.google.com/
    echo.
    echo 2. Make sure you're in the project with URL:
    echo    https://console.firebase.google.com/project/aic-campus-exam-portal/
    echo.
    echo 3. Click "Firestore Database" in the left sidebar
    echo.
    echo 4. You should see a database interface (NOT a "Create Database" button)
    echo.
    echo 5. If you see "Create Database" button:
    echo    - You're in the WRONG PROJECT or
    echo    - Firestore is NOT enabled yet
    echo.
    echo ========================================
    echo.
    pause
) else (
    echo ERROR: .env.local file not found!
    echo.
    pause
)
