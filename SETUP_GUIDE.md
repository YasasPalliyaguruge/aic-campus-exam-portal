# AIC Campus Exam Portal - Setup Guide

## Prerequisites
- **Node.js**: Ensure you have Node.js installed (version 16 or higher recommended).
- **Firebase Account**: You need a Firebase project for the backend.

## Step 1: Install Dependencies
The "vite not recognized" error usually means the project dependencies haven't been installed yet.

1. Open your terminal (Command Prompt or PowerShell).
2. Navigate to the project folder:
   ```bash
   cd "c:\Users\asus tuf 15\Downloads\aic-campus-exam-portal"
   ```
3. Run the installation command:
   ```bash
   npm install
   ```
   *Wait for this to complete. It may take a few minutes.*

## Step 2: Configure Environment
1. Create a file named `.env.local` in the root directory.
2. Copy the contents from `.env.example` into `.env.local`.
3. Fill in your Firebase configuration keys in `.env.local`.
   *(You can get these from your Firebase Console > Project Settings)*

## Step 3: Run the Application
Once the installation is finished:

1. Start the development server:
   ```bash
   npm run dev
   ```
2. You should see output like:
   ```
   VITE v4.x.x  ready in 500 ms
   ➜  Local:   http://localhost:5173/
   ```
3. Open your browser and visit `http://localhost:5173`.

## Troubleshooting
- **"vite is not recognized"**: This means `npm install` failed or didn't run. Try deleting the `node_modules` folder and `package-lock.json` file, then run `npm install` again.
- **Firebase Errors**: Check your console (F12) for errors. Ensure your `.env.local` keys are correct and you have enabled **Authentication** and **Firestore** in your Firebase Console.
