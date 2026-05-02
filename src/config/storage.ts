import { join, resolve, sep } from 'path';

const DEFAULT_PUBLIC_STORAGE_ROOT =
  process.env.NODE_ENV === 'production'
    ? '/app/public'
    : join(process.cwd(), 'public');

export function getPublicStorageRoot(): string {
  return resolve(
    process.env.PUBLIC_STORAGE_ROOT ?? DEFAULT_PUBLIC_STORAGE_ROOT,
  );
}

export function getPublicStoragePath(...segments: string[]): string {
  return join(getPublicStorageRoot(), ...segments);
}

export function resolvePublicStoragePath(
  path: string,
  folder?: string,
): string {
  const root = getPublicStorageRoot();
  const relative_path = normalizePublicPath(path);
  const has_folder_prefix =
    folder &&
    (relative_path === folder || relative_path.startsWith(`${folder}/`));
  const resolved_path = has_folder_prefix
    ? resolve(root, relative_path)
    : resolve(root, folder ?? '', relative_path);

  if (resolved_path !== root && !resolved_path.startsWith(root + sep)) {
    throw new Error('Path is outside the public storage root');
  }

  return resolved_path;
}

function normalizePublicPath(path: string): string {
  let normalized_path = path;

  try {
    normalized_path = new URL(path).pathname;
  } catch {
    normalized_path = path;
  }

  const configured_base_path = getConfiguredBasePath();

  normalized_path = normalized_path.replace(/^\/+/, '');

  if (
    configured_base_path &&
    (normalized_path === configured_base_path ||
      normalized_path.startsWith(`${configured_base_path}/`))
  ) {
    normalized_path = normalized_path.slice(configured_base_path.length);
  }

  return normalized_path.replace(/^\/+/, '').replace(/^public\/+/, '');
}

function getConfiguredBasePath(): string {
  const base_url = process.env.FILE_BASE_URL ?? '/public';

  try {
    return new URL(base_url).pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    return base_url.replace(/^\/+|\/+$/g, '');
  }
}

export function getPublicUrl(...segments: string[]): string {
  const base_url = (process.env.FILE_BASE_URL ?? '/public').replace(/\/+$/, '');
  const path = segments
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .join('/');

  return path ? `${base_url}/${path}` : base_url || '/';
}
