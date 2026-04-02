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

// Fixed solar holidays that repeat every year (Item #15)
const FIXED_SOLAR_HOLIDAYS: Array<[string, string]> = [
  ['01-01', '신정'],
  ['03-01', '삼일절'],
  ['05-05', '어린이날'],
  ['06-06', '현충일'],
  ['08-15', '광복절'],
  ['10-03', '개천절'],
  ['10-09', '한글날'],
  ['12-25', '성탄절'],
];

// Year-specific lunar/variable holidays and substitute holidays
const VARIABLE_HOLIDAYS_BY_YEAR: Record<number, Array<[string, string]>> = {
  2026: [
    ['2026-02-16', '설날 연휴'],
    ['2026-02-17', '설날'],
    ['2026-02-18', '설날 연휴'],
    ['2026-03-02', '삼일절 대체'],
    ['2026-05-24', '부처님오신날'],
    ['2026-05-25', '석가탄신일 대체'],
    ['2026-06-03', '전국동시지방선거'],
    ['2026-08-17', '광복절 대체'],
    ['2026-09-24', '추석 연휴'],
    ['2026-09-25', '추석'],
    ['2026-09-26', '추석 연휴'],
    ['2026-10-05', '개천절 대체'],
  ],
  2027: [
    ['2027-02-05', '설날 연휴'],
    ['2027-02-06', '설날'],
    ['2027-02-07', '설날 연휴'],
    ['2027-02-08', '설날 대체'],
    ['2027-05-13', '부처님오신날'],
    ['2027-05-06', '어린이날 대체'],
    ['2027-09-14', '추석 연휴'],
    ['2027-09-15', '추석'],
    ['2027-09-16', '추석 연휴'],
    ['2027-10-11', '한글날 대체'],
  ],
  2028: [
    ['2028-01-25', '설날 연휴'],
    ['2028-01-26', '설날'],
    ['2028-01-27', '설날 연휴'],
    ['2028-05-02', '부처님오신날'],
    ['2028-05-05', '어린이날'],
    ['2028-10-02', '추석 연휴'],
    ['2028-10-03', '추석'],
    ['2028-10-04', '추석 연휴'],
  ],
};

export function getKoreanPublicHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();

  // Auto-generate fixed solar holidays for any year (Item #15)
  for (const [monthDay, label] of FIXED_SOLAR_HOLIDAYS) {
    holidays.set(`${year}-${monthDay}`, label);
  }

  // Add year-specific variable holidays
  const variable = VARIABLE_HOLIDAYS_BY_YEAR[year];
  if (variable) {
    for (const [dateKey, label] of variable) {
      holidays.set(dateKey, label);
    }
  }

  return holidays;
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
