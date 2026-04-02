import { ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkspaceResource } from '@/types/workspace-resource';
import { formatDateTime } from './utils/workspace-formatters';
import type { LucideIcon } from 'lucide-react';

export interface ResourcePanelProps {
  icon: LucideIcon;
  title: string;
  emptyText: string;
  emptyContent?: React.ReactNode;
  resources: WorkspaceResource[];
  onRemove?: (resourceId: string) => void;
  removeLabel?: string;
}

export function ResourcePanel({
  icon: Icon,
  title,
  emptyText,
  emptyContent,
  resources,
  onRemove,
  removeLabel,
}: ResourcePanelProps) {
  return (
    <Card className="border-border/60 bg-card/98 shadow-[0_20px_50px_-40px_rgba(20,26,36,0.16)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {resources.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/65 px-4 py-6 text-sm text-muted-foreground">
            {emptyContent ?? emptyText}
          </div>
        )}
        {resources.map((resource) => (
          <div key={resource.id} className="rounded-2xl border border-border/60 bg-background/65 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{resource.title}</p>
                {resource.subtitle && (
                  <p className="mt-1 text-xs text-muted-foreground">{resource.subtitle}</p>
                )}
                {resource.description && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {resource.description}
                  </p>
                )}
              </div>
              {resource.href && (
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <a
                    href={resource.href}
                    target={resource.href.startsWith('#') ? undefined : '_blank'}
                    rel={resource.href.startsWith('#') ? undefined : 'noreferrer'}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
            {(resource.openedAt || onRemove) && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {resource.openedAt
                    ? `최근 열람 ${formatDateTime(resource.openedAt)}`
                    : '저장된 항목'}
                </span>
                {onRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => onRemove(resource.id)}
                    aria-label={removeLabel ?? `${resource.title} 제거`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
