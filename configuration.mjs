import { calculateSemester, localDateInput } from './core.mjs';
import { currencies } from './preferences.mjs';

export const storageKey = 'tuition-payback.v0.1.session';
export const maximumFileBytes = 1024 * 1024;

export function configurationRecord(semester) {
  // Copy only configuration fields, never editor IDs or derived totals.
  if (!semester || typeof semester.startDate !== 'string' || typeof semester.endDate !== 'string' ||
      !Array.isArray(semester.weeklyCourses) || semester.weeklyCourses.length > 500 ||
      (semester.demo !== undefined && typeof semester.demo !== 'boolean')) throw new Error('学期配置格式无效。');
  const next = {
    tuitionCents: semester.tuitionCents, startDate: semester.startDate, endDate: semester.endDate,
    weeklyCourses: semester.weeklyCourses.map(course => {
      if (!course || typeof course.startTime !== 'string' ||
          (course.startDate !== undefined && typeof course.startDate !== 'string') ||
          (course.endDate !== undefined && typeof course.endDate !== 'string')) throw new Error('课程配置格式无效。');
      if (course.excludedDates !== undefined && !Array.isArray(course.excludedDates)) throw new Error('停课日期格式无效。');
      return { weekday: course.weekday, name: course.name, startTime: course.startTime, durationMs: course.durationMs,
        ...(course.startDate !== undefined ? { startDate: course.startDate } : {}),
        ...(course.endDate !== undefined ? { endDate: course.endDate } : {}),
        ...(course.excludedDates !== undefined ? { excludedDates: [...course.excludedDates] } : {}) };
    }), demo: semester.demo ?? false,
  };
  calculateSemester(next);
  return { version: 4, semester: next };
}

export function decodeConfiguration(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > maximumFileBytes) throw new Error('配置文件过大，最多支持 1 MB。');
  let saved;
  try { saved = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('配置文件损坏，无法解析 JSON。请重新选择导出的备份。'); }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('配置文件格式无效。');
  if (saved.version === 3 || saved.version === 4) {
    if (saved.version === 3 && Array.isArray(saved.semester?.weeklyCourses) && saved.semester.weeklyCourses.some(course => course?.excludedDates !== undefined)) throw new Error('含停课日期的配置须使用版本 4，原文件未修改。');
    const record = configurationRecord(saved.semester);
    const summary = calculateSemester(record.semester);
    const currency = saved.source?.currency ?? 'USD';
    if (!currencies.includes(currency)) throw new Error('备份中的货币单位无效。');
    return { kind: 'configuration', record, semester: record.semester,
      currency, courseCount: record.semester.weeklyCourses.length, ...summary };
  }
  if (saved.version === 1 || saved.version === 2) {
    const old = saved.session;
    if (!old || !Number.isFinite(old.start) || !Number.isFinite(old.end) || old.end <= old.start ||
        !Number.isFinite(new Date(old.start).getTime()) || !Number.isFinite(new Date(old.end).getTime()) ||
        old.end - old.start > 86400000 ||
        (old.name !== undefined && (typeof old.name !== 'string' || old.name.length > 80)) ||
        (saved.version === 2 && (!Number.isSafeInteger(old.tuitionCents) || old.tuitionCents < 1 || old.tuitionCents > 999999999))) {
      throw new Error('旧版课程草稿无效。原文件未修改。');
    }
    const durationMs = Math.round((old.end - old.start) / 36000) * 36000;
    if (durationMs < 36000) throw new Error('旧版课程时长无效。');
    const draft = { tuitionCents: saved.version === 2 ? old.tuitionCents : null,
      weeklyCourses: [{ name: old.name?.trim() || '本节课', weekday: (new Date(old.start).getDay() + 6) % 7,
        startTime: localDateInput(old.start).slice(11, 16), durationMs }] };
    return { kind: 'legacy', version: saved.version, draft, courseCount: 1 };
  }
  throw new Error(`不支持配置版本 ${String(saved.version ?? '（缺失）')}。请使用兼容版本，原文件未修改。`);
}

export function exportConfiguration(semester, source) {
  return JSON.stringify({ ...configurationRecord(semester), exportedAt: new Date().toISOString(), source }, null, 2);
}
