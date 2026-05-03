import { NotFoundException } from '@nestjs/common';
import { basename, normalize, resolve, relative, sep } from 'path';

/** Single path segment suitable for resolving under {@code public/<folder>/}. */
function assertFlatSafeFileId(decodedInput: string): string {
  if (!decodedInput?.trim()) {
    throw new NotFoundException('file not found');
  }

  const decoded = decodedInput.trim().replace(/\\/g, '/');

  try {
    if (decoded.toLowerCase().includes('%2e')) {
      throw new NotFoundException('file not found');
    }
  } catch {
    /* ignore URIError from includes on odd strings */
  }

  if (decoded.includes('/') || decoded.includes('\\')) {
    throw new NotFoundException('file not found');
  }

  const fileName = basename(normalize(decoded));
  if (!fileName.length || fileName.length > 240) {
    throw new NotFoundException('file not found');
  }

  if (fileName.includes('..') || fileName === '.' || fileName === '..') {
    throw new NotFoundException('file not found');
  }

  return fileName;
}

/**
 * Decodes URI component when valid; rejects mal-encoded input.
 */
function decodeMaybeEncoded(path: string): string {
  let decoded = path.trim().replace(/\\/g, '/');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    throw new NotFoundException('file not found');
  }
  return decoded;
}

/**
 * Ensures resolved path stays under {@code public/<folder>} (no traversal).
 */
export function resolvePublicFileUnderFolder(
  publicRoot: string,
  folder: string,
  rawPath: string,
): string {
  const decoded = decodeMaybeEncoded(rawPath);
  const fileName = assertFlatSafeFileId(decoded);

  const baseDir = resolve(publicRoot, folder);
  const fullPath = resolve(baseDir, fileName);

  const relBase = relative(baseDir, fullPath);
  const relPublic = relative(resolve(publicRoot), fullPath);

  if (
    relBase.startsWith('..') ||
    relBase.includes(`${sep}..`) ||
    relPublic.startsWith('..') ||
    relPublic.includes(`${sep}..`)
  ) {
    throw new NotFoundException('file not found');
  }

  return fullPath;
}

/** For legacy nested public paths resolved as {@code <any>/pronunciations/<filename>}. */
export function resolveLegacyPublicNestedPath(
  publicRoot: string,
  folder: string,
  rawPath: string,
): string {
  const decoded = decodeMaybeEncoded(rawPath);
  const normalized = normalize(decoded.trim().replace(/\\/g, '/'));
  const segments = normalized.split(/[/]+/).filter(Boolean);

  // DB stores url as join(FILE_BASE_URL, folder, filename) — prefix varies with env
  // (e.g. /public/pronunciations/foo.webm or /var/data/pronunciations/foo.webm).
  const folderIndex = segments.lastIndexOf(folder);
  if (folderIndex < 0 || folderIndex !== segments.length - 2) {
    throw new NotFoundException('file not found');
  }

  const fileName = segments[segments.length - 1]!;
  return resolvePublicFileUnderFolder(publicRoot, folder, fileName);
}
