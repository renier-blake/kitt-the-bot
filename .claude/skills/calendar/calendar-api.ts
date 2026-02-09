#!/usr/bin/env npx tsx
/**
 * Google Calendar API CLI via Nango
 * Usage: npx tsx .claude/skills/calendar/calendar-api.ts <command> [options]
 */

import { config } from 'dotenv';
config();

import { proxyRequest, isConnected } from '../../../src/integrations/nango.js';

const INTEGRATION_ID = 'google-calendar';
const TIMEZONE = 'Europe/Amsterdam';

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
    self?: boolean;
  }>;
  organizer?: { email: string; displayName?: string; self?: boolean };
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ uri: string; entryPointType: string }>;
  };
}

interface CalendarListResponse {
  items?: CalendarEvent[];
  nextPageToken?: string;
}

interface CalendarEntry {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
}

function formatDateTime(isoString: string | undefined, dateOnly?: string): string {
  if (!isoString && !dateOnly) return '';

  const date = new Date(isoString || dateOnly || '');

  if (dateOnly) {
    return date.toLocaleDateString('nl-NL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: TIMEZONE,
    });
  }

  return date.toLocaleString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}

function formatTime(isoString: string | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}

function getEventTime(event: CalendarEvent): { start: string; end: string; allDay: boolean } {
  const allDay = !event.start?.dateTime;
  return {
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    allDay,
  };
}

function getDateRange(type: 'today' | 'tomorrow' | 'week'): { timeMin: string; timeMax: string } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  // Reset to start of day
  start.setHours(0, 0, 0, 0);

  switch (type) {
    case 'today':
      end.setHours(23, 59, 59, 999);
      break;
    case 'tomorrow':
      start.setDate(start.getDate() + 1);
      end.setDate(end.getDate() + 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      end.setDate(end.getDate() + 7);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

async function checkConnection(): Promise<boolean> {
  const connected = await isConnected(INTEGRATION_ID);
  if (!connected) {
    console.error('❌ Google Calendar niet verbonden.');
    console.error('   Ga naar KITT Portal → Integrations → Google Calendar → Connect');
    process.exit(1);
  }
  return true;
}

async function listCalendars(): Promise<void> {
  await checkConnection();

  const result = await proxyRequest<{ items: CalendarEntry[] }>(INTEGRATION_ID, {
    endpoint: '/calendar/v3/users/me/calendarList',
  });

  console.log(`📅 Calendars (${result.items?.length || 0}):\n`);

  for (const cal of result.items || []) {
    const primary = cal.primary ? ' (primary)' : '';
    const role = cal.accessRole ? ` [${cal.accessRole}]` : '';
    console.log(`  - ${cal.summary}${primary}${role}`);
    console.log(`    ID: ${cal.id}`);
  }
}

async function listEvents(
  timeMin: string,
  timeMax: string,
  maxResults: number = 10,
  query?: string
): Promise<void> {
  await checkConnection();

  const params: Record<string, string> = {
    timeMin,
    timeMax,
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: TIMEZONE,
  };

  if (query) params.q = query;

  const result = await proxyRequest<CalendarListResponse>(INTEGRATION_ID, {
    endpoint: '/calendar/v3/calendars/primary/events',
    params,
  });

  if (!result.items || result.items.length === 0) {
    console.log('📭 Geen events gevonden.');
    return;
  }

  console.log(`📅 ${result.items.length} events:\n`);

  for (const event of result.items) {
    const { start, end, allDay } = getEventTime(event);
    const title = event.summary || '(geen titel)';

    if (allDay) {
      console.log(`📆 ${formatDateTime(undefined, start)} | ${title} (hele dag)`);
    } else {
      const datePrefix = formatDateTime(start).split(' ').slice(0, 3).join(' ');
      console.log(`${datePrefix} ${formatTime(start)} - ${formatTime(end)} | ${title}`);
    }

    if (event.location) {
      console.log(`  📍 ${event.location}`);
    }

    if (event.hangoutLink) {
      console.log(`  🔗 Google Meet`);
    }

    if (event.attendees && event.attendees.length > 0) {
      const others = event.attendees.filter(a => !a.self);
      if (others.length > 0) {
        const names = others.map(a => a.displayName || a.email).slice(0, 3);
        const more = others.length > 3 ? ` +${others.length - 3}` : '';
        console.log(`  👥 ${names.join(', ')}${more}`);
      }
    }

    console.log('');
  }
}

async function getEvent(eventId: string): Promise<void> {
  await checkConnection();

  const event = await proxyRequest<CalendarEvent>(INTEGRATION_ID, {
    endpoint: `/calendar/v3/calendars/primary/events/${eventId}`,
  });

  const { start, end, allDay } = getEventTime(event);

  console.log(`📅 Event Details:`);
  console.log(`Titel: ${event.summary || '(geen titel)'}`);

  if (allDay) {
    console.log(`Datum: ${formatDateTime(undefined, start)} (hele dag)`);
  } else {
    console.log(`Start: ${formatDateTime(start)}`);
    console.log(`Einde: ${formatDateTime(end)}`);
  }

  if (event.location) {
    console.log(`Locatie: ${event.location}`);
  }

  if (event.status) {
    console.log(`Status: ${event.status}`);
  }

  if (event.hangoutLink) {
    console.log(`\nGoogle Meet: ${event.hangoutLink}`);
  }

  if (event.description) {
    console.log(`\nBeschrijving:\n${event.description}`);
  }

  if (event.attendees && event.attendees.length > 0) {
    console.log(`\nDeelnemers:`);
    for (const attendee of event.attendees) {
      const name = attendee.displayName || attendee.email;
      const status = attendee.responseStatus || 'unknown';
      const role = attendee.organizer ? ' (organizer)' : attendee.self ? ' (you)' : '';
      console.log(`  - ${name} (${status})${role}`);
    }
  }

  if (event.htmlLink) {
    console.log(`\nLink: ${event.htmlLink}`);
  }
}

async function createEvent(
  title: string,
  startTime: string,
  endTime: string,
  description?: string,
  location?: string
): Promise<void> {
  await checkConnection();

  const eventData = {
    summary: title,
    description,
    location,
    start: {
      dateTime: new Date(startTime).toISOString(),
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: new Date(endTime).toISOString(),
      timeZone: TIMEZONE,
    },
  };

  const event = await proxyRequest<CalendarEvent>(INTEGRATION_ID, {
    endpoint: '/calendar/v3/calendars/primary/events',
    method: 'POST',
    data: eventData,
  });

  console.log(`✅ Event aangemaakt!`);
  console.log(`Titel: ${event.summary}`);
  console.log(`ID: ${event.id}`);
  if (event.htmlLink) {
    console.log(`Link: ${event.htmlLink}`);
  }
}

async function findFreeSlots(date: string): Promise<void> {
  await checkConnection();

  const dayStart = new Date(date);
  dayStart.setHours(8, 0, 0, 0); // Start at 8:00

  const dayEnd = new Date(date);
  dayEnd.setHours(18, 0, 0, 0); // End at 18:00

  // Get events for the day
  const result = await proxyRequest<CalendarListResponse>(INTEGRATION_ID, {
    endpoint: '/calendar/v3/calendars/primary/events',
    params: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: TIMEZONE,
    },
  });

  const events = result.items || [];

  // Find free slots
  const slots: Array<{ start: Date; end: Date }> = [];
  let currentTime = dayStart;

  for (const event of events) {
    const eventStart = new Date(event.start?.dateTime || event.start?.date || '');
    const eventEnd = new Date(event.end?.dateTime || event.end?.date || '');

    if (currentTime < eventStart) {
      slots.push({ start: new Date(currentTime), end: eventStart });
    }

    if (eventEnd > currentTime) {
      currentTime = eventEnd;
    }
  }

  // Add remaining time until end of day
  if (currentTime < dayEnd) {
    slots.push({ start: new Date(currentTime), end: dayEnd });
  }

  const dateStr = dayStart.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
  });

  console.log(`🕐 Vrije slots op ${dateStr}:\n`);

  if (slots.length === 0) {
    console.log('Geen vrije slots gevonden (volledig bezet 8:00-18:00)');
    return;
  }

  for (const slot of slots) {
    const startStr = formatTime(slot.start.toISOString());
    const endStr = formatTime(slot.end.toISOString());
    const durationMs = slot.end.getTime() - slot.start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const durationStr = durationHours >= 1
      ? `${durationHours} uur`
      : `${Math.round(durationHours * 60)} min`;

    console.log(`${startStr} - ${endStr} (${durationStr})`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`Usage: npx tsx calendar-api.ts <command> [options]

Commands:
  today              Events van vandaag
  tomorrow           Events van morgen
  week               Events van deze week
  upcoming [n]       Volgende n events (default: 10)
  event <eventId>    Details van specifiek event
  search <query> [n] Zoek events (default: 10)
  calendars          Lijst alle calendars
  create             Maak nieuw event
  free <date>        Vrije slots op datum (YYYY-MM-DD)

Create options:
  --title <title>
  --start <ISO datetime>
  --end <ISO datetime>
  --description <desc>
  --location <loc>`);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'calendars':
        await listCalendars();
        break;

      case 'today': {
        const { timeMin, timeMax } = getDateRange('today');
        await listEvents(timeMin, timeMax);
        break;
      }

      case 'tomorrow': {
        const { timeMin, timeMax } = getDateRange('tomorrow');
        await listEvents(timeMin, timeMax);
        break;
      }

      case 'week': {
        const { timeMin, timeMax } = getDateRange('week');
        await listEvents(timeMin, timeMax, 25);
        break;
      }

      case 'upcoming': {
        const n = parseInt(args[1]) || 10;
        const now = new Date();
        const future = new Date();
        future.setMonth(future.getMonth() + 3); // 3 months ahead
        await listEvents(now.toISOString(), future.toISOString(), n);
        break;
      }

      case 'event': {
        const eventId = args[1];
        if (!eventId) {
          console.error('❌ Event ID required');
          process.exit(1);
        }
        await getEvent(eventId);
        break;
      }

      case 'search': {
        const query = args[1];
        const n = parseInt(args[2]) || 10;
        if (!query) {
          console.error('❌ Search query required');
          process.exit(1);
        }
        const now = new Date();
        const future = new Date();
        future.setMonth(future.getMonth() + 6);
        await listEvents(now.toISOString(), future.toISOString(), n, query);
        break;
      }

      case 'create': {
        // Parse --flag value pairs
        const flags: Record<string, string> = {};
        for (let i = 1; i < args.length; i += 2) {
          if (args[i].startsWith('--')) {
            flags[args[i].slice(2)] = args[i + 1];
          }
        }

        if (!flags.title || !flags.start || !flags.end) {
          console.error('❌ Required: --title, --start, --end');
          console.error('Example: create --title "Meeting" --start "2026-02-10T14:00:00" --end "2026-02-10T15:00:00"');
          process.exit(1);
        }

        await createEvent(flags.title, flags.start, flags.end, flags.description, flags.location);
        break;
      }

      case 'free': {
        const date = args[1];
        if (!date) {
          console.error('❌ Date required (YYYY-MM-DD)');
          process.exit(1);
        }
        await findFreeSlots(date);
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
