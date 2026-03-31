export function buildWorkspaceOwnerKey(email?: string | null, id?: string | null): string {
  const raw = (email || id || 'guest').trim().toLowerCase();
  return raw.replace(/[^a-z0-9._-]/g, '-');
}
