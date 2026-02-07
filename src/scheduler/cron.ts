/**
 * KITT Scheduler - Simplified Cron Parser
 *
 * Supports basic cron expressions:
 * - "0 8 * * *"      every day at 08:00
 * - "0 *\/2 * * *"   every 2 hours
 * - "30 9 * * 1-5"   weekdays at 09:30
 * - "0 23 * * *"     every day at 23:00
 */

export interface CronParts {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

/**
 * Parse a single cron field into an array of valid values
 */
function parseField(field: string, min: number, max: number): number[] {
  // Wildcard - all values
  if (field === '*') {
    return range(min, max);
  }

  // Step values: */2, */5, etc.
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return range(min, max).filter((v) => v % step === 0);
  }

  // Range: 1-5, 9-17, etc.
  if (field.includes('-')) {
    const [start, end] = field.split('-').map((n) => parseInt(n, 10));
    return range(start, end);
  }

  // List: 1,3,5
  if (field.includes(',')) {
    return field.split(',').map((n) => parseInt(n, 10));
  }

  // Single value
  return [parseInt(field, 10)];
}

/**
 * Generate a range of numbers (inclusive)
 */
function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}

/**
 * Parse a cron expression into its parts
 */
export function parseCron(expression: string): CronParts {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${expression} (expected 5 parts)`);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  return {
    minute: parseField(minute, 0, 59),
    hour: parseField(hour, 0, 23),
    dayOfMonth: parseField(dayOfMonth, 1, 31),
    month: parseField(month, 1, 12),
    dayOfWeek: parseField(dayOfWeek, 0, 6), // 0 = Sunday
  };
}

/**
 * Get the next occurrence of a cron schedule after a given date
 * @param expression Cron expression
 * @param after Start date (defaults to now)
 * @param timezone Timezone string (e.g., "Europe/Amsterdam")
 */
export function getNextRun(
  expression: string,
  after: Date = new Date(),
  timezone = 'Europe/Amsterdam'
): Date {
  const cron = parseCron(expression);

  // Start from the next minute
  const candidate = new Date(after);
  candidate.setSeconds(0);
  candidate.setMilliseconds(0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  // Search for the next valid time (max 1 year)
  const maxIterations = 366 * 24 * 60; // 1 year in minutes

  for (let i = 0; i < maxIterations; i++) {
    const inTz = toTimezone(candidate, timezone);

    const minute = inTz.getMinutes();
    const hour = inTz.getHours();
    const dayOfMonth = inTz.getDate();
    const month = inTz.getMonth() + 1; // JS months are 0-indexed
    const dayOfWeek = inTz.getDay();

    if (
      cron.minute.includes(minute) &&
      cron.hour.includes(hour) &&
      cron.dayOfMonth.includes(dayOfMonth) &&
      cron.month.includes(month) &&
      cron.dayOfWeek.includes(dayOfWeek)
    ) {
      return candidate;
    }

    // Move to next minute
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error(`Could not find next run for: ${expression}`);
}

/**
 * Get time in a specific timezone
 * Note: This is a simplified version - for production, use a proper timezone library
 */
function toTimezone(date: Date, timezone: string): Date {
  // Use Intl to get the time in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );
}

/**
 * Format a cron expression as human-readable text
 */
export function describeCron(expression: string): string {
  const cron = parseCron(expression);

  const minute = cron.minute.length === 60 ? '*' : cron.minute.join(',');
  const hour = cron.hour.length === 24 ? 'elk uur' : `om ${cron.hour.join(',')}:${minute.padStart(2, '0')}`;

  if (cron.dayOfWeek.length === 7 && cron.dayOfMonth.length === 31) {
    return `Dagelijks ${hour}`;
  }

  if (cron.dayOfWeek.length < 7) {
    const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
    const dayNames = cron.dayOfWeek.map((d) => days[d]).join(', ');
    return `${dayNames} ${hour}`;
  }

  return `${hour}`;
}
