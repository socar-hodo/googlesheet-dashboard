import type { TodoItem } from '@/types/workspace-state';

export function formatDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthStartKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function shiftMonthKey(monthKey: string, offset: number): string {
  const date = new Date(`${monthKey}T00:00:00`);
  date.setMonth(date.getMonth() + offset);
  date.setDate(1);
  return formatDateKey(date);
}

export function getTodayDateInputValue(): string {
  return formatDateKey(new Date());
}

export function isTodayTask(todo: TodoItem): boolean {
  if (!todo.dueDate) return false;
  return todo.dueDate <= getTodayDateInputValue();
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getIsoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getKoreanPublicHolidays(year: number): Map<string, string> {
  const holidaysByYear: Record<number, Array<[string, string]>> = {
    2026: [
      ['2026-01-01', '신정'],
      ['2026-02-16', '설날 연휴'],
      ['2026-02-17', '설날'],
      ['2026-02-18', '설날 연휴'],
      ['2026-03-01', '삼일절'],
      ['2026-03-02', '삼일절 대체'],
      ['2026-05-05', '어린이날'],
      ['2026-05-24', '부처님오신날'],
      ['2026-05-25', '석가탄신일 대체'],
      ['2026-06-03', '전국동시지방선거'],
      ['2026-06-06', '현충일'],
      ['2026-08-15', '광복절'],
      ['2026-08-17', '광복절 대체'],
      ['2026-09-24', '추석 연휴'],
      ['2026-09-25', '추석'],
      ['2026-09-26', '추석 연휴'],
      ['2026-10-03', '개천절'],
      ['2026-10-05', '개천절 대체'],
      ['2026-10-09', '한글날'],
      ['2026-12-25', '성탄절'],
    ],
  };

  return new Map(holidaysByYear[year] ?? []);
}

export interface CalendarDay {
  dateKey: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  dayOfWeek: number;
  isHoliday: boolean;
  holidayLabel?: string;
  total: number;
  active: number;
  completed: number;
}

export interface CalendarWeek {
  weekKey: string;
  isoWeek: number;
  days: CalendarDay[];
}

export function buildCalendarDays(monthKey: string, todos: TodoItem[]): CalendarWeek[] {
  const monthStart = new Date(`${monthKey}T00:00:00`);
  const firstWeekday = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - firstWeekday);
  const holidays = getKoreanPublicHolidays(monthStart.getFullYear());

  const dueDateSummary = new Map<string, { total: number; active: number; completed: number }>();
  for (const todo of todos) {
    if (!todo.dueDate) continue;
    const current = dueDateSummary.get(todo.dueDate) ?? { total: 0, active: 0, completed: 0 };
    current.total += 1;
    if (todo.completed) current.completed += 1;
    else current.active += 1;
    dueDateSummary.set(todo.dueDate, current);
  }

  return Array.from({ length: 6 }, (_, weekIndex) => {
    const weekStart = new Date(gridStart);
    weekStart.setDate(gridStart.getDate() + weekIndex * 7);

    return {
      weekKey: formatDateKey(weekStart),
      isoWeek: getIsoWeekNumber(addDays(weekStart, 1)),
      days: Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDays(weekStart, dayIndex);
        const dateKey = formatDateKey(date);
        const summary = dueDateSummary.get(dateKey) ?? { total: 0, active: 0, completed: 0 };
        const holidayLabel = holidays.get(dateKey);

        return {
          dateKey,
          dayNumber: date.getDate(),
          inMonth: date.getMonth() === monthStart.getMonth(),
          isToday: dateKey === getTodayDateInputValue(),
          dayOfWeek: date.getDay(),
          isHoliday: Boolean(holidayLabel),
          holidayLabel,
          total: summary.total,
          active: summary.active,
          completed: summary.completed,
        };
      }),
    };
  });
}
