// Deliberately limited to the weekly NYU calendar supplied for this project.
// Unsupported recurrence rules fail rather than silently losing occurrences.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseValue, parseLocalDate, localDateInput, calculateSemester } from '../core.mjs';
import { exportConfiguration } from '../configuration.mjs';
process.env.TZ = 'America/New_York';

export function readNyuCalendar(text, tuition) {
  const unfolded = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '');
  const events = [...unfolded.matchAll(/BEGIN:VEVENT\n([\s\S]*?)\nEND:VEVENT/g)];
  if (!events.length) throw new Error('文件中没有课程事件。');
  const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const dateTime = value => {
    if (!/^\d{8}T\d{6}$/.test(value)) throw new Error('仅支持本地完整日期时间。');
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    return parseLocalDate(`${date}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`);
  };
  const weeklyCourses = events.map(([, body]) => {
    const properties = body.split('\n').map(line => {
      const colon = line.indexOf(':');
      return [line.slice(0, colon), line.slice(colon + 1)];
    });
    const get = name => properties.find(([key]) => key.split(';')[0] === name)?.[1];
    if (get('RDATE') || get('RECURRENCE-ID') || get('STATUS') === 'CANCELLED') throw new Error('此文件含不支持的例外课次。');
    for (const name of ['DTSTART', 'DTEND', 'EXDATE']) {
      for (const [key] of properties.filter(([key]) => key.split(';')[0] === name)) {
        if (key !== `${name};TZID=America/New_York`) throw new Error(`仅支持 America/New_York 的 ${name}。`);
      }
    }
    const rule = Object.fromEntries((get('RRULE') || '').split(';').map(part => part.split('=')));
    if (rule.FREQ !== 'WEEKLY' || !weekdays.includes(rule.BYDAY) || !rule.UNTIL ||
        Object.keys(rule).some(key => !['FREQ', 'BYDAY', 'UNTIL'].includes(key))) throw new Error('仅支持固定星期和结束日期的每周课程。');
    const start = dateTime(get('DTSTART'));
    const end = dateTime(get('DTEND'));
    const until = dateTime(rule.UNTIL);
    const weekday = weekdays.indexOf(rule.BYDAY);
    if (new Date(start).getSeconds() !== 0) throw new Error('上课时间含秒，不能按整分钟导入。');
    if ((new Date(start).getDay() + 6) % 7 !== weekday) throw new Error('事件首日和重复星期不一致。');
    const excludedDates = properties.filter(([key]) => key.split(';')[0] === 'EXDATE').flatMap(([, value]) => value.split(','))
      .map(dateTime).filter(time => time >= start && time <= until &&
        (new Date(time).getDay() + 6) % 7 === weekday && localDateInput(time).slice(11) === localDateInput(start).slice(11))
      .map(time => localDateInput(time).slice(0, 10));
    return { name: get('SUMMARY')?.replace(/\\n/g, ' ').replace(/\\([,;\\])/g, '$1'), weekday,
      startTime: localDateInput(start).slice(11, 16), durationMs: end - start,
      startDate: localDateInput(start).slice(0, 10), endDate: localDateInput(until).slice(0, 10),
      ...(excludedDates.length ? { excludedDates: [...new Set(excludedDates)].sort() } : {}) };
  });
  const semester = { tuitionCents: parseValue(tuition), startDate: weeklyCourses.map(course => course.startDate).sort()[0],
    endDate: weeklyCourses.map(course => course.endDate).sort().at(-1), weeklyCourses, demo: false };
  calculateSemester(semester);
  return semester;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [input, tuition, output] = process.argv.slice(2);
  if (!input || !tuition || !output) throw new Error('Usage: node scripts/convert-nyu-calendar.mjs INPUT.ics TUITION OUTPUT.json');
  const semester = readNyuCalendar(await readFile(input, 'utf8'), tuition);
  await writeFile(output, exportConfiguration(semester, { calendar: input.split(/[\\/]/).at(-1), timeZone: 'America/New_York', exclusions: 'ICS EXDATE applied; make-up class not scheduled yet' }), { flag: 'wx' });
  console.log(JSON.stringify({ courses: semester.weeklyCourses.length, totalHours: calculateSemester(semester).semesterDurationMs / 3600000,
    tuition: semester.tuitionCents / 100, startDate: semester.startDate, endDate: semester.endDate, output }, null, 2));
}
