export const getFirstDayOfNextMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};

export const getFirstDayOfLastMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + -1, 1);
};

export const getLastDayOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
};

export const getFirstDayOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

export const getMonthBoundaries = (monthYear: string): { firstDay: Date; lastDay: Date } => {
  const [month, year] = monthYear
    .split('/')
    .map((t) => t.trim())
    .map(Number);

  if (!month || !year || month < 1 || month > 12) {
    throw new Error("Invalid month-year format. Use 'M/YYYY'.");
  }

  return {
    firstDay: new Date(year, month - 1, 1),
    lastDay: new Date(year, month, 0, 23, 59, 59, 999)
  };
};

export const timeAgo = (date: Date, locale = 'en') => {
  const formatter = new Intl.RelativeTimeFormat(locale);
  const ranges = {
    years: 3600 * 24 * 365,
    months: 3600 * 24 * 30,
    weeks: 3600 * 24 * 7,
    days: 3600 * 24,
    hours: 3600,
    minutes: 60,
    seconds: 1
  };
  const secondsElapsed = (date.getTime() - Date.now()) / 1000;
  for (const key in ranges) {
    if (ranges[key] < Math.abs(secondsElapsed)) {
      const delta = secondsElapsed / ranges[key];
      return formatter.format(Math.round(delta), key as Intl.RelativeTimeFormatUnit);
    }
  }
  return 'just now';
};
