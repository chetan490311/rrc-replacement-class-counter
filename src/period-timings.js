
import { PERIOD_COUNT } from './routine.js';

export function createDefaultPeriodTimings() {
  return {
    effectiveFrom: '0000-00-00',
    periods: Array.from({ length: PERIOD_COUNT }, (_, index) => ({
      period: index + 1,
      start: '',
      end: ''
    }))
  };
}

export function createTimingHistory() {
  return [createDefaultPeriodTimings()];
}

export function addTimingChange(history, effectiveFrom, periods) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    throw new Error(
      'Enter the effective date in BS YYYY-MM-DD format.'
    );
  }

  if (!Array.isArray(periods) || periods.length !== PERIOD_COUNT) {
    throw new Error(
      `Enter timings for all ${PERIOD_COUNT} periods.`
    );
  }

  const checkedPeriods = periods.map((item, index) => {
    if (!item.start || !item.end) {
      throw new Error(
        `Enter start and end times for Period ${index + 1}.`
      );
    }

    if (item.start >= item.end) {
      throw new Error(
        `Period ${index + 1}: end time must be after start time.`
      );
    }

    return {
      period: index + 1,
      start: item.start,
      end: item.end
    };
  });

  const existing = history.find(
    item => item.effectiveFrom === effectiveFrom
  );

  const newEntry = {
    effectiveFrom,
    periods: checkedPeriods,
    createdAt: new Date().toISOString()
  };

  if (existing) {
    Object.assign(existing, newEntry);
  } else {
    history.push(newEntry);
  }

  history.sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom)
  );

  return history;
}

export function getTimingsForDate(history, bsDate) {
  const applicable = (history || [])
    .filter(item => item.effectiveFrom <= bsDate)
    .sort((a, b) =>
      b.effectiveFrom.localeCompare(a.effectiveFrom)
    );

  return applicable[0] || null;
}
