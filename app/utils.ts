import { HistoryYear } from './types';
import { TimeMode, Metric, Unit } from './App';

/**
 * Convert a time string (HH:mm or HH:mm:ss) to decimal hours.
 * e.g., "09:30" -> 9.5
 */
export const getDecimalHour = (timeStr: string): number => {
  if (!timeStr) return 9; // Fallback default
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
};

/**
 * Get the start hour for a given year based on the time mode (elite/mass).
 */
export const getStartHourForYear = (
  year: HistoryYear,
  mode: TimeMode,
  offsetMins: number
): number => {
  let timeStr = year.startTimeMass;
  let offsetHours = 0;

  if (mode === 'eliteMen') {
    timeStr = year.startTimeEliteMen || year.startTimeElite || year.startTimeMass;
  } else if (mode === 'eliteWomen') {
    timeStr = year.startTimeEliteWomen || year.startTimeElite || year.startTimeMass;
  } else {
    // Mass start mode
    timeStr = year.startTimeMass;
    offsetHours = offsetMins / 60;
  }

  return getDecimalHour(timeStr) + offsetHours;
};

/**
 * Calculate the display metric value from raw temp/dew data.
 * Handles both temp-only and temp+dew modes, and F/C conversion.
 */
export const calculateMetricValue = (
  temp: number,
  dew: number,
  metric: Metric,
  unit: Unit
): number => {
  let val = metric === 'sum' ? temp + dew : temp;
  if (unit === 'C') {
    // For sum mode, the "base" in Fahrenheit is 64 (32+32), for temp it's 32
    const offset = metric === 'sum' ? 64 : 32;
    val = (val - offset) * (5 / 9);
  }
  return val;
};

/**
 * Linear interpolation between two values.
 */
export const interpolate = (
  val1: number,
  val2: number,
  t1: number,
  t2: number,
  t: number
): number => {
  if (t2 === t1) return val1;
  const fraction = (t - t1) / (t2 - t1);
  return val1 + fraction * (val2 - val1);
};

/**
 * Get interpolated raw temp/dew values at a specific hour for a given year.
 */
export const getRawValuesAtHour = (
  yearData: HistoryYear,
  targetHour: number
): { temp: number; dew: number } => {
  const allPoints = yearData.weather
    .map((p) => ({
      ...p,
      t: getDecimalHour(p.datetime),
    }))
    .sort((a, b) => a.t - b.t);

  const indexAfter = allPoints.findIndex((p) => p.t >= targetHour);

  if (indexAfter === -1) {
    const last = allPoints[allPoints.length - 1];
    return { temp: last ? last.temp : 0, dew: last ? last.dew : 0 };
  }

  if (indexAfter === 0) {
    const first = allPoints[0];
    return { temp: first.temp, dew: first.dew };
  }

  const pAfter = allPoints[indexAfter];
  const pBefore = allPoints[indexAfter - 1];

  return {
    temp: interpolate(pBefore.temp, pAfter.temp, pBefore.t, pAfter.t, targetHour),
    dew: interpolate(pBefore.dew, pAfter.dew, pBefore.t, pAfter.t, targetHour),
  };
};

/**
 * Format decimal hours to display time (e.g., 9.5 -> "9:30am")
 */
export const formatDecimalTime = (decimal: number): string => {
  let hrs = Math.floor(decimal);
  const mins = Math.round((decimal - hrs) * 60);
  const suffix = hrs >= 12 ? 'pm' : 'am';

  if (hrs > 12) hrs -= 12;
  if (hrs === 0) hrs = 12;

  const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
  return `${hrs}:${minsStr}${suffix}`;
};

/**
 * Format duration in hours to HH:MM format (e.g., 3.5 -> "3:30")
 */
export const formatDuration = (hrs: number): string => {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  const mStr = m === 60 ? '00' : m.toString().padStart(2, '0');
  const hFinal = m === 60 ? h + 1 : h;
  return `${hFinal}:${mStr}`;
};
