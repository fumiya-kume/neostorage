import fs from 'node:fs/promises';

export const DRIVE_ROOT = '__NEOSTORAGE_DRIVES__';

export function isDriveRoot(targetPath: string): boolean {
  return targetPath === DRIVE_ROOT;
}

export function getDefaultRootPath(): string {
  if (process.platform === 'win32') {
    return DRIVE_ROOT;
  }
  if (process.platform === 'darwin') {
    return '/Volumes';
  }
  return '/';
}

export function formatRootLabel(targetPath: string): string {
  if (isDriveRoot(targetPath)) {
    return 'Drives';
  }
  return targetPath;
}

export async function listWindowsDrives(): Promise<string[]> {
  if (process.platform !== 'win32') {
    return [];
  }
  const drives: string[] = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const letter of letters) {
    const root = `${letter}:\\`;
    try {
      const stat = await fs.stat(root);
      if (stat.isDirectory()) {
        drives.push(root);
      }
    } catch {
      // Ignore missing or inaccessible drives.
    }
  }
  return drives;
}
