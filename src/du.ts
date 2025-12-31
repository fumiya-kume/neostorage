import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { isDriveRoot, listWindowsDrives } from './drives.js';

const DU_BATCH_SIZE = 50;
const FILE_BATCH_SIZE = 200;

type DuResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

export type Entry = {
  fullPath: string;
  name: string;
  isDir: boolean;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function execDu(args: string[]): Promise<DuResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('du', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (error) => {
      reject(error);
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

export async function listDirectChildren(
  rootPath: string
): Promise<{ entries: Entry[]; warnings: string[] }> {
  if (isDriveRoot(rootPath)) {
    const drives = await listWindowsDrives();
    return {
      entries: drives.map((drivePath) => ({
        fullPath: drivePath,
        name: drivePath,
        isDir: true
      })),
      warnings: []
    };
  }
  const entries: Entry[] = [];
  const warnings: string[] = [];
  try {
    const dirents = await fs.readdir(rootPath, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = path.join(rootPath, dirent.name);
      entries.push({
        fullPath,
        name: dirent.name,
        isDir: dirent.isDirectory()
      });
    }
  } catch (error) {
    warnings.push(`Read dir failed: ${rootPath}: ${getErrorMessage(error)}`);
  }
  return { entries, warnings };
}

function parseWarnings(stderr: string): string[] {
  const warnings: string[] = [];
  const errLines = stderr.split('\n');
  for (const line of errLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    warnings.push(trimmed);
  }
  return warnings;
}

function parseDuOutput(stdout: string): Map<string, number> {
  const sizeMap = new Map<string, number>();
  const lines = stdout.split('\n');
  for (const line of lines) {
    if (!line) {
      continue;
    }
    const match = line.match(/^(\d+)\s+(.*)$/);
    if (!match) {
      continue;
    }
    sizeMap.set(match[2], Number(match[1]));
  }
  return sizeMap;
}

function chunkEntries<T>(entries: T[], size: number): T[][] {
  if (entries.length <= size) {
    return [entries];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(entries.slice(i, i + size));
  }
  return chunks;
}

export async function getEntrySizeKb(
  fullPath: string,
  isDir: boolean
): Promise<{ sizeKb: number | null; warnings: string[] }> {
  if (!isDir) {
    try {
      const stat = await fs.stat(fullPath);
      const sizeKb = Math.ceil(stat.size / 1024);
      return { sizeKb, warnings: [] };
    } catch (error) {
      return {
        sizeKb: null,
        warnings: [`Stat failed: ${fullPath}: ${getErrorMessage(error)}`]
      };
    }
  }

  const result = await execDu(['-s', '-k', fullPath]);
  const warnings = parseWarnings(result.stderr);
  const firstLine = result.stdout.split('\n')[0]?.trim() ?? '';
  const match = firstLine.match(/^(\d+)\s+/);
  if (!match) {
    return {
      sizeKb: null,
      warnings: warnings.length ? warnings : [`du failed: ${fullPath}`]
    };
  }
  const sizeKb = Number(match[1]);
  return { sizeKb, warnings };
}

export async function getEntriesSizeKb(
  entries: Entry[],
  rootPath: string | null = null
): Promise<{ sizeMap: Map<string, number>; warnings: string[] }> {
  const warnings: string[] = [];
  const sizeMap = new Map<string, number>();
  let pendingEntries = entries;

  if (process.platform === 'darwin' && rootPath) {
    try {
      const result = await execDu(['-k', '-d', '1', '-x', rootPath]);
      warnings.push(...parseWarnings(result.stderr));
      const parsed = parseDuOutput(result.stdout);
      const missing: Entry[] = [];
      for (const entry of entries) {
        const sizeKb = parsed.get(entry.fullPath);
        if (sizeKb === undefined) {
          missing.push(entry);
          continue;
        }
        sizeMap.set(entry.fullPath, sizeKb);
      }
      pendingEntries = missing;
      if (!pendingEntries.length) {
        return { sizeMap, warnings };
      }
    } catch (error) {
      warnings.push(`du failed: ${getErrorMessage(error)}`);
    }
  }

  const fileEntries = pendingEntries.filter((entry) => !entry.isDir);
  const dirEntries = pendingEntries.filter((entry) => entry.isDir);

  if (fileEntries.length) {
    const chunks = chunkEntries(fileEntries, FILE_BATCH_SIZE);
    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (entry) => {
          try {
            const stat = await fs.stat(entry.fullPath);
            return { entry, sizeKb: Math.ceil(stat.size / 1024), warning: null };
          } catch (error) {
            return {
              entry,
              sizeKb: null,
              warning: `Stat failed: ${entry.fullPath}: ${getErrorMessage(error)}`
            };
          }
        })
      );
      for (const result of results) {
        if (result.warning) {
          warnings.push(result.warning);
        }
        if (result.sizeKb !== null && result.sizeKb !== undefined) {
          sizeMap.set(result.entry.fullPath, result.sizeKb);
        }
      }
    }
  }

  if (dirEntries.length) {
    const chunks = chunkEntries(dirEntries, DU_BATCH_SIZE);
    for (const chunk of chunks) {
      let result;
      try {
        result = await execDu(['-s', '-k', ...chunk.map((entry) => entry.fullPath)]);
      } catch (error) {
        warnings.push(`du failed: ${getErrorMessage(error)}`);
        continue;
      }
      warnings.push(...parseWarnings(result.stderr));
      const parsed = parseDuOutput(result.stdout);
      for (const entry of chunk) {
        const sizeKb = parsed.get(entry.fullPath);
        if (sizeKb === undefined) {
          warnings.push(`du missing output: ${entry.fullPath}`);
          continue;
        }
        sizeMap.set(entry.fullPath, sizeKb);
      }
    }
  }

  return { sizeMap, warnings };
}
