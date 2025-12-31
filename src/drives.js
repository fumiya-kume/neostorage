import fs from 'node:fs/promises';

export const DRIVE_ROOT = '__NEOSTORAGE_DRIVES__';

export function isDriveRoot(targetPath) {
  return targetPath === DRIVE_ROOT;
}

export function getDefaultRootPath() {
  return process.platform === 'win32' ? DRIVE_ROOT : '/';
}

export function formatRootLabel(targetPath) {
  if (isDriveRoot(targetPath)) {
    return 'Drives';
  }
  return targetPath;
}

export async function listWindowsDrives() {
  if (process.platform !== 'win32') {
    return [];
  }
  const drives = [];
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
