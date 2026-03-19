export interface WorkspaceResource {
  id: string;
  title: string;
  href?: string;
  subtitle?: string;
  description?: string;
  source: 'sheets-search' | 'sheets-list' | 'history';
  openedAt?: string;
  openedCount?: number;
}
