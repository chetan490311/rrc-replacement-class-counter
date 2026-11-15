
import NepaliDate from 'nepali-date-converter';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

// Convert a BS date (YYYY-MM-DD) into an AD date (YYYY-MM-DD).
export function bsToAd(bsDate) {
  try {
    const date = new NepaliDate(bsDate);
    const ad = date.toJsDate();

    if (!(ad instanceof Date) || Number.isNaN(ad.getTime())) {
      throw new Error('Invalid converted date');
    }

    const year = ad.getFullYear();
    const month = String(ad.getMonth() + 1).padStart(2, '0');
    const day = String(ad.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    throw new Error('Invalid Nepali date. Please use YYYY-MM-DD format.');
  }
}

// Convert an AD date (YYYY-MM-DD) into a BS date (YYYY-MM-DD).
export function adToBs(adDate) {
  try {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(adDate);

    if (!match) throw new Error('Invalid date');

    const [, y, m, d] = match;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);

    const check = new Date(year, month - 1, day);

    if (
      check.getFullYear() !== year ||
      check.getMonth() !== month - 1 ||
      check.getDate() !== day
    ) {
      throw new Error('Invalid AD date');
    }

    const nepali = new NepaliDate(check);
    return nepali.format('YYYY-MM-DD');
  } catch {
    throw new Error('Invalid English date. Please use YYYY-MM-DD format.');
  }
}

// Find the weekday for a BS date.
export function getWeekdayFromBS(bsDate) {
  try {
    const adDate = bsToAd(bsDate);
    const [year, month, day] = adDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return WEEKDAYS[date.getDay()];
  } catch {
    throw new Error('Could not determine weekday for this BS date.');
  }
}

// Validate a BS date and return its converted information.
export function validateBSDate(bsDate) {
  try {
    const adDate = bsToAd(bsDate);
    const convertedBack = adToBs(adDate);

    if (convertedBack !== bsDate) return null;

    return {
      bs: bsDate,
      ad: adDate,
      weekday: getWeekdayFromBS(bsDate),
      valid: true
    };
  } catch {
    return null;
  }
}

// Get today's BS date.
export function todayBS() {
  return adToBs(
    `${new Date().getFullYear()}-${String(
      new Date().getMonth() + 1
    ).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
  );
}

export { WEEKDAYS };
