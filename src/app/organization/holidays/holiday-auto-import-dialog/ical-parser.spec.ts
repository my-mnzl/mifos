import { parseICalEvents } from './ical-parser';

const MIN_VEVENT = (props: string[]) =>
  `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n${props.join('\n')}\nEND:VEVENT\nEND:VCALENDAR`;

describe('parseICalEvents', () => {
  it('returns an empty array for empty or whitespace input', () => {
    expect(parseICalEvents('')).toEqual([]);
    expect(parseICalEvents('   \n\n')).toEqual([]);
  });

  it('parses a single all-day event with VALUE=DATE form', () => {
    const ics = MIN_VEVENT([
      'UID:1@example',
      'SUMMARY:Coptic Christmas',
      'DTSTART;VALUE=DATE:20260107',
      'DTEND;VALUE=DATE:20260108'
    ]);
    const events = parseICalEvents(ics);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Coptic Christmas');
    expect(events[0].start.getFullYear()).toBe(2026);
    expect(events[0].start.getMonth()).toBe(0);
    expect(events[0].start.getDate()).toBe(7);
    // DTEND for VALUE=DATE is exclusive in iCal — the parser must subtract a
    // day so that a single-day holiday's `end` is the same as `start`.
    expect(events[0].end.getDate()).toBe(7);
  });

  it('keeps DTEND as-is when the property uses date-time form', () => {
    const ics = MIN_VEVENT([
      'UID:dt@example',
      'SUMMARY:Meeting',
      'DTSTART:20260107T090000Z',
      'DTEND:20260107T100000Z'
    ]);
    const [
      e
    ] = parseICalEvents(ics);
    // Date-time DTEND should NOT have a day subtracted.
    expect(e.start.getUTCDate()).toBe(7);
    expect(e.end.getUTCDate()).toBe(7);
    expect(e.end.getUTCHours()).toBe(10);
  });

  it('handles RFC 5545 line folding (CRLF + space continuation)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:fold@example',
      'SUMMARY:This is a very long\r\n  summary that was folded',
      'DTSTART;VALUE=DATE:20260101',
      'DTEND;VALUE=DATE:20260102',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    const [
      e
    ] = parseICalEvents(ics);
    expect(e.summary).toBe('This is a very long summary that was folded');
  });

  it('unescapes commas, semicolons, backslashes, and \\n in SUMMARY', () => {
    const ics = MIN_VEVENT([
      'UID:esc@example',
      'SUMMARY:Day off\\, family event\\; relax\\\\ a bit\\nback Monday',
      'DTSTART;VALUE=DATE:20260301',
      'DTEND;VALUE=DATE:20260302'
    ]);
    const [
      e
    ] = parseICalEvents(ics);
    expect(e.summary).toBe('Day off, family event; relax\\ a bit back Monday');
  });

  it('parses multi-day spans correctly (DTEND inclusive after subtraction)', () => {
    const ics = MIN_VEVENT([
      'UID:multi@example',
      'SUMMARY:Eid al-Fitr',
      'DTSTART;VALUE=DATE:20260320',
      'DTEND;VALUE=DATE:20260323'
    ]);
    const [
      e
    ] = parseICalEvents(ics);
    expect(e.start.getDate()).toBe(20);
    expect(e.end.getDate()).toBe(22);
  });

  it('skips VEVENTs missing required fields', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:incomplete@example',
      'DTSTART;VALUE=DATE:20260101',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:ok@example',
      'SUMMARY:Valid Event',
      'DTSTART;VALUE=DATE:20260201',
      'DTEND;VALUE=DATE:20260202',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');
    const events = parseICalEvents(ics);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Valid Event');
  });

  it('parses multiple events and preserves their UIDs', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:a@example',
      'SUMMARY:First',
      'DTSTART;VALUE=DATE:20260101',
      'DTEND;VALUE=DATE:20260102',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:b@example',
      'SUMMARY:Second',
      'DTSTART;VALUE=DATE:20260214',
      'DTEND;VALUE=DATE:20260215',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');
    const events = parseICalEvents(ics);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.uid)).toEqual([
      'a@example',
      'b@example'
    ]);
  });

  it('ignores properties outside a VEVENT block', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'SUMMARY:Calendar Title — should be ignored',
      'BEGIN:VEVENT',
      'UID:c@example',
      'SUMMARY:Real',
      'DTSTART;VALUE=DATE:20260101',
      'DTEND;VALUE=DATE:20260102',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');
    const events = parseICalEvents(ics);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Real');
  });
});
