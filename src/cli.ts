#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import React from 'react';
import { render } from 'ink';
import App from './app.js';
import { formatRootLabel, getDefaultRootPath, isDriveRoot } from './drives.js';

type PackageJson = {
  name?: string;
  version?: string;
};

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as PackageJson;

const args = process.argv.slice(2);

function printHelp() {
  const name = pkg.name || 'neostorage';
  const defaultLabel = formatRootLabel(getDefaultRootPath());
  console.log(`${name} - storage visualizer`);
  console.log('');
  console.log(`Usage: ${name} [--path <path>]`);
  console.log('');
  console.log('Options:');
  console.log(`  --path, -p   Root path (default: ${defaultLabel})`);
  console.log('  --help, -h   Show help');
  console.log('  --version, -v Show version');
}

function exitWithError(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

let targetPath: string | null = null;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  }
  if (arg === '--version' || arg === '-v') {
    console.log(pkg.version || '0.0.0');
    process.exit(0);
  }
  if (arg === '--path' || arg === '-p') {
    if (i + 1 >= args.length) {
      exitWithError('Missing value for --path');
    }
    targetPath = args[i + 1];
    i += 1;
    continue;
  }
  if (arg.startsWith('-')) {
    exitWithError(`Unknown option: ${arg}`);
  }
  if (!targetPath) {
    targetPath = arg;
  } else {
    exitWithError(`Unexpected argument: ${arg}`);
  }
}

if (!targetPath) {
  targetPath = getDefaultRootPath();
}

const resolvedPath = isDriveRoot(targetPath)
  ? targetPath
  : path.resolve(targetPath);
if (!isDriveRoot(resolvedPath)) {
  let stat;
  try {
    stat = fs.statSync(resolvedPath);
  } catch (error) {
    exitWithError(`Path not found: ${resolvedPath}`);
  }

  if (!stat.isDirectory()) {
    exitWithError(`Not a directory: ${resolvedPath}`);
  }
}

render(React.createElement(App, { rootPath: resolvedPath }));
