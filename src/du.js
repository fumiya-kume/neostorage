import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { isDriveRoot, listWindowsDrives } from './drives.js';

function execDu(args) {
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

export async function listDirectChildren(rootPath) {
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
  const entries = [];
  const warnings = [];
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
    warnings.push(`Read dir failed: ${rootPath}: ${error.message}`);
  }
  return { entries, warnings };
}

function parseWarnings(stderr) {
  const warnings = [];
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

export async function getEntrySizeKb(fullPath, isDir) {
  if (!isDir) {
    try {
      const stat = await fs.stat(fullPath);
      const sizeKb = Math.ceil(stat.size / 1024);
      return { sizeKb, warnings: [] };
    } catch (error) {
      return {
        sizeKb: null,
        warnings: [`Stat failed: ${fullPath}: ${error.message}`]
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
