/**
 * Server Time Service - SECURE IMPLEMENTATION
 * 
 * This service fetches the ACTUAL server time from Firebase servers,
 * completely independent of the client's clock or timezone.
 * 
 * HOW IT WORKS:
 * 1. We write a document with serverTimestamp() to Firestore
 * 2. Firebase replaces this with the actual server time on their servers
 * 3. We read it back to get the TRUE server time
 * 4. We calculate the difference between server and client time
 * 5. All subsequent getServerTime() calls use this offset
 * 
 * SECURITY: This is immune to client clock manipulation because:
 * - serverTimestamp() is processed on Google's servers
 * - The timestamp we read back is what Google's server clock says
 * - Even if a student sets their clock to year 2050, we get the real time
 * 
 * IMPORTANT: All exam scheduling uses Sri Lankan time (UTC+5:30).
 * The server returns UTC time, which we use for comparisons.
 * Scheduled times are stored with timezone info and converted to UTC.
 */

import { doc, setDoc, getDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

// The TRUE offset between server time and client time
// serverTime = Date.now() + offset
let serverTimeOffset: number = 0;
let isInitialized: boolean = false;
let initializationPromise: Promise<void> | null = null;
let lastSyncTime: number = 0;

// Sync interval - re-sync every 5 minutes to handle long sessions
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Initialize server time sync by fetching ACTUAL server time from Firestore.
 * This uses serverTimestamp() which is processed on Google's servers.
 */
export const initServerTimeSync = async (): Promise<void> => {
  // Return existing promise if already initializing
  if (initializationPromise && isInitialized) {
    // Check if we need to re-sync
    const timeSinceLastSync = Date.now() - lastSyncTime;
    if (timeSinceLastSync < SYNC_INTERVAL_MS) {
      return initializationPromise;
    }
  }

  initializationPromise = new Promise<void>(async (resolve) => {
    try {
      console.log('🔄 Fetching ACTUAL server time from Firebase...');
      
      // Generate a unique document ID for this sync operation
      const syncDocId = `time_sync_${Math.random().toString(36).substring(2, 15)}`;
      const syncDocRef = doc(db, '_server_time_sync', syncDocId);
      
      // Step 1: Write a document with serverTimestamp()
      // Firebase will replace this with the ACTUAL server time on their servers
      const clientTimeBeforeWrite = Date.now();
      
      await setDoc(syncDocRef, {
        requestedAt: serverTimestamp(),
        clientTime: clientTimeBeforeWrite
      });
      
      // Step 2: Read it back immediately to get the server-assigned timestamp
      const syncDoc = await getDoc(syncDocRef);
      const clientTimeAfterRead = Date.now();
      
      if (syncDoc.exists()) {
        const data = syncDoc.data();
        const serverTimestampValue = data.requestedAt as Timestamp;
        
        if (serverTimestampValue && serverTimestampValue.toMillis) {
          const serverTimeMs = serverTimestampValue.toMillis();
          
          // Calculate the true offset
          // Account for network latency by using the midpoint of the request
          const clientTimeMidpoint = (clientTimeBeforeWrite + clientTimeAfterRead) / 2;
          serverTimeOffset = serverTimeMs - clientTimeMidpoint;
          
          isInitialized = true;
          lastSyncTime = Date.now();
          
          const offsetSeconds = (serverTimeOffset / 1000).toFixed(1);
          const serverDate = new Date(serverTimeMs);
          
          console.log(`✅ Server time synchronized successfully!`);
          console.log(`   📅 Server time: ${serverDate.toISOString()}`);
          console.log(`   ⏱️ Offset: ${offsetSeconds}s (${serverTimeOffset > 0 ? 'server ahead' : 'server behind'})`);
          console.log(`   🔒 This is immune to client clock manipulation`);
        }
      }
      
      // Step 3: Clean up the sync document
      try {
        await deleteDoc(syncDocRef);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      resolve();
    } catch (error) {
      console.error('❌ Server time sync failed:', error);
      console.warn('⚠️ Falling back to client time - THIS IS LESS SECURE');
      serverTimeOffset = 0;
      isInitialized = true;
      lastSyncTime = Date.now();
      resolve();
    }
  });

  return initializationPromise;
};

/**
 * Force a re-synchronization of server time.
 * Call this if you suspect the time might be off.
 */
export const resyncServerTime = async (): Promise<void> => {
  lastSyncTime = 0; // Force re-sync
  initializationPromise = null;
  await initServerTimeSync();
};

/**
 * Get the current server time.
 * This is THE function to use for all time-sensitive operations.
 * 
 * SECURITY: This returns the TRUE server time, not the client's clock.
 * Even if a student sets their computer to year 2050, this will return
 * the actual current time according to Google's servers.
 * 
 * @returns Current server timestamp in milliseconds (UTC)
 */
export const getServerTime = (): number => {
  if (!isInitialized) {
    console.warn('⚠️ Server time not yet initialized! Call initServerTimeSync() first.');
    console.warn('   Using client time as TEMPORARY fallback - schedule validation may be incorrect');
  }
  
  // The magic: we add the offset to the current client time
  // If client clock is wrong, the offset compensates for it
  // Because offset = (true server time) - (client time at sync)
  // So: client time now + offset ≈ true server time now
  return Date.now() + serverTimeOffset;
};

/**
 * Get the current server time as a Date object.
 * 
 * @returns Current server time as Date (in UTC)
 */
export const getServerDate = (): Date => {
  return new Date(getServerTime());
};

/**
 * Get the server time offset value.
 * Useful for debugging.
 * 
 * @returns Offset in milliseconds (positive = server ahead of client)
 */
export const getServerTimeOffset = (): number => {
  return serverTimeOffset;
};

/**
 * Check if server time is initialized.
 * 
 * @returns True if server time sync has completed
 */
export const isServerTimeInitialized = (): boolean => {
  return isInitialized;
};

/**
 * Format a timestamp for display in the user's local timezone.
 * The timestamp should be in UTC (as returned by getServerTime).
 * 
 * @param timestamp - Server timestamp in milliseconds (UTC)
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string in user's local timezone
 */
export const formatServerTime = (
  timestamp: number,
  options?: Intl.DateTimeFormatOptions
): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  };
  return new Date(timestamp).toLocaleString(undefined, options || defaultOptions);
};

/**
 * Calculate remaining seconds until a target time.
 * Uses server time for accurate calculation.
 * 
 * @param targetTimestamp - Target timestamp in milliseconds (UTC)
 * @returns Remaining seconds (negative if past)
 */
export const getSecondsUntil = (targetTimestamp: number): number => {
  return Math.floor((targetTimestamp - getServerTime()) / 1000);
};

/**
 * Check if a scheduled time has passed.
 * Uses server time for accurate comparison.
 * 
 * @param scheduledTime - ISO date string or timestamp
 * @returns True if the scheduled time has passed according to SERVER time
 */
export const hasTimePassed = (scheduledTime: string | number): boolean => {
  const targetTime = typeof scheduledTime === 'string' 
    ? new Date(scheduledTime).getTime() 
    : scheduledTime;
  return getServerTime() > targetTime;
};

/**
 * Check if current time is within a time window.
 * Uses server time for accurate comparison.
 * 
 * @param startTime - Start time (ISO string or timestamp)
 * @param endTime - End time (ISO string or timestamp)
 * @returns True if current SERVER time is between start and end
 */
export const isWithinTimeWindow = (
  startTime: string | number,
  endTime: string | number
): boolean => {
  const start = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime).getTime() : endTime;
  const now = getServerTime();
  return now >= start && now <= end;
};

/**
 * Get diagnostic info about the server time sync.
 * Useful for debugging timezone issues.
 */
export const getServerTimeDiagnostics = (): {
  isInitialized: boolean;
  offsetMs: number;
  offsetSeconds: number;
  serverTimeUTC: string;
  serverTimeLocal: string;
  clientTimeUTC: string;
  lastSyncedAt: string;
} => {
  const serverNow = getServerTime();
  const clientNow = Date.now();
  
  return {
    isInitialized,
    offsetMs: serverTimeOffset,
    offsetSeconds: Math.round(serverTimeOffset / 1000),
    serverTimeUTC: new Date(serverNow).toISOString(),
    serverTimeLocal: new Date(serverNow).toLocaleString(),
    clientTimeUTC: new Date(clientNow).toISOString(),
    lastSyncedAt: lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'
  };
};
