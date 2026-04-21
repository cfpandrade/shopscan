const PRICE_REFRESH_TIMEZONE = 'Europe/Dublin';

function pad(value) {
  return String(value).padStart(2, '0');
}

function shiftCalendarDay(year, month, day, offsetDays) {
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);

  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  };
}

function getZonedParts(date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: PRICE_REFRESH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
}

function parseStoredTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed);
    const normalised = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    const parsed = new Date(hasTimezone ? normalised : `${normalised}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getSlotInfo(date) {
  const parts = getZonedParts(date);

  if (parts.hour >= 17) {
    return {
      slotKey: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}-17`,
    };
  }

  if (parts.hour >= 5) {
    return {
      slotKey: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}-05`,
    };
  }

  const previousDay = shiftCalendarDay(parts.year, parts.month, parts.day, -1);
  return {
    slotKey: `${previousDay.year}-${pad(previousDay.month)}-${pad(previousDay.day)}-17`,
  };
}

function getNextRefreshWindow(date) {
  const parts = getZonedParts(date);

  if (parts.hour < 5) {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} 05:00 ${PRICE_REFRESH_TIMEZONE}`;
  }

  if (parts.hour < 17) {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} 17:00 ${PRICE_REFRESH_TIMEZONE}`;
  }

  const nextDay = shiftCalendarDay(parts.year, parts.month, parts.day, 1);
  return `${nextDay.year}-${pad(nextDay.month)}-${pad(nextDay.day)} 05:00 ${PRICE_REFRESH_TIMEZONE}`;
}

export function getPriceRefreshStatus(lastFetchedAt, now = new Date()) {
  const fetchedDate = parseStoredTimestamp(lastFetchedAt);
  if (!fetchedDate) {
    return {
      canRefresh: true,
      nextRefreshAt: null,
      lastFetchedAt: null,
      refreshWindow: PRICE_REFRESH_TIMEZONE,
    };
  }

  const lastSlot = getSlotInfo(fetchedDate);
  const currentSlot = getSlotInfo(now);

  return {
    canRefresh: lastSlot.slotKey !== currentSlot.slotKey,
    nextRefreshAt: getNextRefreshWindow(fetchedDate),
    lastFetchedAt,
    refreshWindow: PRICE_REFRESH_TIMEZONE,
  };
}
