import { DateTime } from 'luxon';
import { Exam } from '../types';

export const DEFAULT_EXAM_TIME_ZONE = 'Asia/Colombo';

export const EXAM_TIME_ZONES = [
  'Asia/Colombo',
  'UTC',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];

export const getExamScheduleStartMs = (exam: Pick<Exam, 'scheduledStartMs' | 'scheduledStart'>): number | null => {
  if (typeof exam.scheduledStartMs === 'number') return exam.scheduledStartMs;
  if (!exam.scheduledStart) return null;
  const parsed = new Date(exam.scheduledStart).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export const getExamScheduleEndMs = (exam: Pick<Exam, 'scheduledEndMs' | 'scheduledEnd'>): number | null => {
  if (typeof exam.scheduledEndMs === 'number') return exam.scheduledEndMs;
  if (!exam.scheduledEnd) return null;
  const parsed = new Date(exam.scheduledEnd).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatExamSchedule = (
  exam: Pick<Exam, 'scheduleTimeZone' | 'scheduledStartMs' | 'scheduledEndMs' | 'scheduledStart' | 'scheduledEnd'>,
  which: 'start' | 'end' = 'start',
): string => {
  const zone = exam.scheduleTimeZone || DEFAULT_EXAM_TIME_ZONE;
  const ms = which === 'start' ? getExamScheduleStartMs(exam) : getExamScheduleEndMs(exam);
  if (!ms) return '-';

  return DateTime.fromMillis(ms, { zone }).toFormat('dd LLL yyyy, hh:mm a ZZZZ');
};

export const toScheduleLocalInput = (
  exam: Pick<Exam, 'scheduleTimeZone' | 'scheduledStartLocal' | 'scheduledEndLocal' | 'scheduledStartMs' | 'scheduledEndMs' | 'scheduledStart' | 'scheduledEnd'>,
  which: 'start' | 'end',
): string => {
  const localField = which === 'start' ? exam.scheduledStartLocal : exam.scheduledEndLocal;
  if (localField) return localField;

  const zone = exam.scheduleTimeZone || DEFAULT_EXAM_TIME_ZONE;
  const ms = which === 'start' ? getExamScheduleStartMs(exam) : getExamScheduleEndMs(exam);
  if (!ms) return '';

  return DateTime.fromMillis(ms, { zone }).toFormat("yyyy-MM-dd'T'HH:mm");
};

export const buildScheduleFields = (startLocal: string, endLocal: string, zone: string) => {
  const scheduledStart = DateTime.fromFormat(startLocal, "yyyy-MM-dd'T'HH:mm", { zone });
  const scheduledEnd = DateTime.fromFormat(endLocal, "yyyy-MM-dd'T'HH:mm", { zone });

  if (!scheduledStart.isValid || !scheduledEnd.isValid) {
    throw new Error('Please enter a valid start and end date/time.');
  }

  if (scheduledEnd.toMillis() <= scheduledStart.toMillis()) {
    throw new Error('Exam end time must be after the start time.');
  }

  return {
    scheduleTimeZone: zone,
    scheduledStartLocal: startLocal,
    scheduledEndLocal: endLocal,
    scheduledStartMs: scheduledStart.toMillis(),
    scheduledEndMs: scheduledEnd.toMillis(),
    scheduledStart: scheduledStart.toUTC().toISO() || new Date(scheduledStart.toMillis()).toISOString(),
    scheduledEnd: scheduledEnd.toUTC().toISO() || new Date(scheduledEnd.toMillis()).toISOString(),
  };
};
