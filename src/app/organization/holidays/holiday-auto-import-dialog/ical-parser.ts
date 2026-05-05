/**
 * Tiny iCal/ICS VEVENT parser.
 *
 * The Google Calendar holiday feeds we consume only need DTSTART, DTEND, and SUMMARY,
 * so this avoids pulling in a full iCal dependency. It handles line folding (RFC 5545)
 * and the two date forms we encounter:
 *   - DATE:           DTSTART;VALUE=DATE:20260107
 *   - DATE-TIME UTC:  DTSTART:20260107T000000Z
 */

export interface ParsedICalEvent {
  summary: string;
  start: Date;
  end: Date;
  uid?: string;
}

export function parseICalEvents(ics: string): ParsedICalEvent[] {
  if (!ics) return [];

  // RFC 5545 line unfolding: a CRLF followed by a space or tab is a continuation.
  const unfolded = ics.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: ParsedICalEvent[] = [];
  let current: Partial<ParsedICalEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current && current.summary && current.start && current.end) {
        events.push(current as ParsedICalEvent);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const head = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const [name] = head.split(';');

    if (name === 'SUMMARY') {
      current.summary = unescapeICalText(value);
    } else if (name === 'UID') {
      current.uid = value;
    } else if (name === 'DTSTART') {
      current.start = parseICalDate(value);
    } else if (name === 'DTEND') {
      // iCal DTEND is exclusive for all-day events. Subtract one day so it represents
      // the inclusive last day, matching how Mifos models a holiday's "to" date.
      const end = parseICalDate(value);
      if (head.includes('VALUE=DATE')) {
        end.setDate(end.getDate() - 1);
      }
      current.end = end;
    }
  }

  return events;
}

function parseICalDate(value: string): Date {
  // YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4);
    const m = +value.slice(4, 6) - 1;
    const d = +value.slice(6, 8);
    return new Date(y, m, d);
  }
  // YYYYMMDDTHHmmssZ (UTC)
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  }
  return new Date(value);
}

function unescapeICalText(value: string): string {
  return value.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}
