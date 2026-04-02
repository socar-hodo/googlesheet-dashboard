import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { TodoPriority } from '@/types/workspace-state';
import { todoPriorities, priorityTone } from './utils/workspace-todo-utils';
import { formatDueDate, formatDateTime } from './utils/workspace-formatters';
import { getTodayDateInputValue } from './utils/workspace-calendar-utils';
import type { WorkspaceTone } from './utils/workspace-storage';

export function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-border/60 bg-background/70 px-4 py-4 shadow-[0_18px_40px_-34px_rgba(20,26,36,0.12)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">{value}</p>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: TodoPriority }) {
  const label = todoPriorities.find((item) => item.value === priority)?.label ?? '중간';
  return (
    <Badge variant="outline" className={cn('rounded-full border-transparent px-2.5 py-1 text-xs font-medium', priorityTone[priority])}>
      {label}
    </Badge>
  );
}

export function TodoDateBadge({ dueDate }: { dueDate?: string }) {
  const isOverdue = Boolean(dueDate) && dueDate! < getTodayDateInputValue();
  const isToday = Boolean(dueDate) && dueDate === getTodayDateInputValue();

  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium',
        !dueDate && 'bg-background text-muted-foreground',
        isOverdue && 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300',
        !isOverdue &&
          isToday &&
          'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300',
        !isOverdue && !isToday && dueDate && 'bg-background text-muted-foreground',
      )}
    >
      {formatDueDate(dueDate)}
    </span>
  );
}

export function WorkspaceSettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export const workspaceToneClassMap: Record<WorkspaceTone, { card: string; badge: string }> = {
  sand: {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.92))] dark:bg-[linear-gradient(180deg,rgba(22,28,38,0.96),rgba(28,24,20,0.92))]',
    badge:
      'border-[#d7c7ad] bg-[#fbf4e8] text-[#765a2c] dark:border-[#5a4b34] dark:bg-[#2e261c] dark:text-[#f1d8aa]',
  },
  sky: {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,246,255,0.94))] dark:bg-[linear-gradient(180deg,rgba(20,27,38,0.96),rgba(18,30,48,0.94))]',
    badge:
      'border-[#b7d0f8] bg-[#edf4ff] text-[#28518d] dark:border-[#314a72] dark:bg-[#17273d] dark:text-[#bdd7ff]',
  },
  mint: {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,251,247,0.94))] dark:bg-[linear-gradient(180deg,rgba(20,27,38,0.96),rgba(18,36,32,0.94))]',
    badge:
      'border-[#b8dccd] bg-[#ebf8f1] text-[#2f6b57] dark:border-[#365a4d] dark:bg-[#152a24] dark:text-[#bfe5d5]',
  },
};
