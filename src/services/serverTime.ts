import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

let serverBaselineMs = Date.now();
let performanceBaselineMs = typeof performance !== 'undefined' ? performance.now() : 0;
let initialized = false;

const nowFromBaseline = () => {
  if (typeof performance === 'undefined') return Date.now();
  return Math.round(serverBaselineMs + (performance.now() - performanceBaselineMs));
};

export const updateCachedServerTime = (serverTime: number): void => {
  serverBaselineMs = serverTime;
  performanceBaselineMs = typeof performance !== 'undefined' ? performance.now() : 0;
  initialized = true;
};

export const getServerTime = (): number => {
  return initialized ? nowFromBaseline() : Date.now();
};

export const formatServerTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
};

export const fetchServerTimeNow = async (): Promise<number> => {
  const callable = httpsCallable<void, { serverNowMs: number }>(functions, 'getTrustedTime');
  const result = await callable();
  updateCachedServerTime(result.data.serverNowMs);
  return result.data.serverNowMs;
};

export const initServerTimeSync = async (): Promise<void> => {
  try {
    await fetchServerTimeNow();
    console.log('Trusted server time synchronized.');
  } catch (error) {
    console.warn('Trusted server time sync failed; using client time until authenticated function access succeeds.', error);
  }
};

export const resyncServerTime = async (): Promise<void> => {
  await fetchServerTimeNow();
};

export const validateScheduleWithServerTime = async (
  scheduledStart: string | number | undefined,
  scheduledEnd: string | number | undefined,
): Promise<{ valid: boolean; error?: string; serverTime?: number }> => {
  const now = getServerTime();

  if (scheduledStart) {
    const startTime = typeof scheduledStart === 'number' ? scheduledStart : new Date(scheduledStart).getTime();
    if (now < startTime) {
      return {
        valid: false,
        error: `Exam hasn't started yet.\n\nThe exam will be available on:\n${formatServerTime(startTime)}\n\nPlease try again at the scheduled time.`,
        serverTime: now,
      };
    }
  }

  if (scheduledEnd) {
    const endTime = typeof scheduledEnd === 'number' ? scheduledEnd : new Date(scheduledEnd).getTime();
    if (now > endTime) {
      return {
        valid: false,
        error: `Exam has ended.\n\nThis exam closed on:\n${formatServerTime(endTime)}\n\nPlease contact your instructor if you need assistance.`,
        serverTime: now,
      };
    }
  }

  return { valid: true, serverTime: now };
};

export const getServerTimeDiagnostics = () => {
  const currentTime = getServerTime();
  return {
    currentTime,
    currentTimeISO: new Date(currentTime).toISOString(),
    currentTimeLocal: new Date(currentTime).toLocaleString(),
    initialized,
    mode: initialized ? 'trusted-functions-baseline' : 'client-fallback',
  };
};
