// Firebase Setup Verification Script
// Run this in the browser console to check your Firebase configuration

console.log('🔍 Checking Firebase Setup...\n');

// 1. Check Environment Variables
console.log('1️⃣ Environment Variables:');
console.log('   API Key:', import.meta.env.VITE_FIREBASE_API_KEY ? '✅ Present' : '❌ Missing');
console.log('   Auth Domain:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✅ Present' : '❌ Missing');
console.log('   Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✅ Present' : '❌ Missing');

// 2. Check Firebase Initialization
import { auth, db } from './firebase';

console.log('\n2️⃣ Firebase Services:');
console.log('   Auth:', auth ? '✅ Initialized' : '❌ Not initialized');
console.log('   Firestore:', db ? '✅ Initialized' : '❌ Not initialized');

// 3. Test Firestore Connection
console.log('\n3️⃣ Testing Firestore Connection...');
import { collection, getDocs } from 'firebase/firestore';

try {
  const testCollection = await getDocs(collection(db, 'users'));
  console.log('   ✅ Firestore is accessible!');
  console.log('   📊 Users collection has', testCollection.size, 'documents');
} catch (error) {
  console.error('   ❌ Firestore Error:', error.message);
  if (error.code === 'unavailable' || error.message.includes('offline')) {
    console.error('\n   ⚠️  FIRESTORE IS NOT ENABLED!');
    console.error('   Please enable Firestore in Firebase Console:');
    console.error('   1. Go to https://console.firebase.google.com/');
    console.error('   2. Select your project');
    console.error('   3. Click "Firestore Database" in sidebar');
    console.error('   4. Click "Create Database"');
    console.error('   5. Choose "Production mode" and a location');
  } else if (error.code === 'permission-denied') {
    console.error('\n   ⚠️  PERMISSION DENIED!');
    console.error('   Please update Firestore Security Rules');
  }
}

console.log('\n✅ Verification Complete!');
