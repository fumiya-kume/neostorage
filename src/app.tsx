import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, type Key, useApp, useInput, useStdout } from 'ink';
import { getEntriesSizeKb, listDirectChildren, type Entry } from './du.js';
import { formatRootLabel } from './drives.js';
import {
  formatPercent,
  formatSizeGb,
  kbToGb,
  padLeft,
  padRight,
  truncateEnd,
  truncateMiddle
} from './format.js';

const h = React.createElement;
const HEADER_HEIGHT = 1;
const FOOTER_HEIGHT = 1;
const DETAILS_HEIGHT = 5;
const MIN_LIST_HEIGHT = 4;

type EntryWithSize = Entry & { sizeGb: number | null };

type AppProps = {
  rootPath: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getVisibleRange(
  total: number,
  selected: number,
  height: number
): { start: number; end: number } {
  if (total <= height) {
    return { start: 0, end: total };
  }
  const half = Math.floor(height / 2);
  let start = Math.max(0, selected - half);
  const maxStart = total - height;
  if (start > maxStart) {
    start = maxStart;
  }
  return { start, end: start + height };
}

function sortEntries(entries: EntryWithSize[]): EntryWithSize[] {
  return [...entries].sort((a, b) => {
    const aSize = a.sizeGb ?? -1;
    const bSize = b.sizeGb ?? -1;
    if (bSize !== aSize) {
      return bSize - aSize;
    }
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function getWarningCount(warnings: string[]): number {
  return warnings.filter((line) => /permission denied/i.test(line)).length;
}

export default function App({ rootPath }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [currentPath, setCurrentPath] = useState<string>(rootPath);
  const [entries, setEntries] = useState<EntryWithSize[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const loadIdRef = useRef(0);
  const scanIdRef = useRef(0);
  const selectedPathRef = useRef<string | null>(null);
  const sizeCacheRef = useRef<Map<string, number>>(new Map());

  const updateEntries = useCallback(
    (nextEntries: EntryWithSize[], keepSelectionPath: string | null = null) => {
    const sorted = sortEntries(nextEntries);
    const targetPath = keepSelectionPath ?? selectedPathRef.current;
    let nextIndex = 0;
    if (targetPath) {
      const foundIndex = sorted.findIndex(
        (entry) => entry.fullPath === targetPath
      );
      if (foundIndex >= 0) {
        nextIndex = foundIndex;
      }
    }
    setEntries(sorted);
    setSelectedIndex(nextIndex);
    },
    []
  );

  const applySizes = useCallback((sizeMap: Map<string, number>) => {
    if (!sizeMap || sizeMap.size === 0) {
      return;
    }
    const sizeGbMap = new Map<string, number>();
    for (const [fullPath, sizeKb] of sizeMap.entries()) {
      const sizeGb = kbToGb(sizeKb);
      sizeGbMap.set(fullPath, sizeGb);
      sizeCacheRef.current.set(fullPath, sizeGb);
    }
    setEntries((prev) => {
      let changed = false;
      const updated = prev.map((entry) => {
        const sizeGb = sizeGbMap.get(entry.fullPath);
        if (sizeGb === undefined) {
          return entry;
        }
        if (entry.sizeGb === sizeGb) {
          return entry;
        }
        changed = true;
        return { ...entry, sizeGb };
      });
      if (!changed) {
        return prev;
      }
      const sorted = sortEntries(updated);
      const selectedPath = selectedPathRef.current;
      if (selectedPath) {
        const foundIndex = sorted.findIndex(
          (entry) => entry.fullPath === selectedPath
        );
        if (foundIndex >= 0) {
          setSelectedIndex(foundIndex);
        }
      }
      return sorted;
    });
  }, []);

  const scanSizes = useCallback(
    async (
      targetPath: string,
      targetEntries: EntryWithSize[],
      requestId: number
    ) => {
      if (!targetEntries.length) {
        if (loadIdRef.current === requestId) {
          setIsLoading(false);
        }
        return;
      }
      const scanId = scanIdRef.current + 1;
      scanIdRef.current = scanId;
      setIsLoading(true);
      try {
        const result = await getEntriesSizeKb(targetEntries, targetPath);
        if (
          loadIdRef.current !== requestId ||
          scanIdRef.current !== scanId
        ) {
          return;
        }
        if (result?.warnings?.length) {
          setWarnings((prev) => [...prev, ...result.warnings]);
        }
        applySizes(result?.sizeMap ?? new Map());
      } catch (error) {
        if (
          loadIdRef.current !== requestId ||
          scanIdRef.current !== scanId
        ) {
          return;
        }
        setWarnings((prev) => [...prev, `Size failed: ${getErrorMessage(error)}`]);
      } finally {
        if (
          loadIdRef.current === requestId &&
          scanIdRef.current === scanId
        ) {
          setIsLoading(false);
        }
      }
    },
    [applySizes]
  );

  const refresh = useCallback(
    async (
      targetPath: string,
      keepSelectionPath: string | null = null,
      forceRescan = false
    ) => {
      const requestId = loadIdRef.current + 1;
      loadIdRef.current = requestId;
      setIsLoading(false);
      try {
        const quick = await listDirectChildren(targetPath);
        if (loadIdRef.current !== requestId) {
          return;
        }
        const quickEntries = quick.entries.map((entry) => {
          const cachedSize = forceRescan
            ? null
            : sizeCacheRef.current.get(entry.fullPath);
          return {
            ...entry,
            sizeGb: cachedSize ?? null
          };
        });
        updateEntries(quickEntries, keepSelectionPath);
        setWarnings(quick.warnings);
        const targets = quickEntries.filter(
          (entry) => entry.sizeGb === null || entry.sizeGb === undefined
        );
        scanSizes(targetPath, targets, requestId);
      } catch (error) {
        setEntries([]);
        setWarnings([]);
        setSelectedIndex(0);
        setStatusMessage(`Error: ${getErrorMessage(error)}`);
      } finally {
        if (loadIdRef.current === requestId) {
          setLastRefreshAt(new Date());
        }
      }
    },
    [scanSizes, updateEntries]
  );

  useEffect(() => {
    refresh(currentPath);
  }, [currentPath, refresh]);

  useEffect(() => {
    if (!statusMessage) {
      return undefined;
    }
    const timeout = setTimeout(() => {
      setStatusMessage('');
    }, 2000);
    return () => clearTimeout(timeout);
  }, [statusMessage]);

  useInput((input: string, key: Key) => {
    if (key.upArrow) {
      if (entries.length === 0) {
        return;
      }
      setSelectedIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (key.downArrow) {
      if (entries.length === 0) {
        return;
      }
      setSelectedIndex((index) => Math.min(entries.length - 1, index + 1));
      return;
    }
    if (key.return) {
      if (entries.length === 0) {
        return;
      }
      const selected = entries[selectedIndex];
      if (selected && selected.isDir) {
        setHistory((prev) => [...prev, currentPath]);
        setCurrentPath(selected.fullPath);
      } else {
        setStatusMessage('Not a directory');
      }
      return;
    }
    if (key.backspace || key.leftArrow) {
      if (history.length === 0) {
        setStatusMessage('At root');
        return;
      }
      const nextPath = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      setCurrentPath(nextPath);
      return;
    }
    if (input === 'r') {
      const keepPath = entries[selectedIndex]?.fullPath ?? null;
      refresh(currentPath, keepPath, true);
      return;
    }
    if (input === 'q') {
      exit();
      return;
    }
    if (input === '?') {
      setHelpVisible((prev) => !prev);
    }
  });

  const totalSizeGb = useMemo(() => {
    return entries.reduce((sum, entry) => sum + (entry.sizeGb ?? 0), 0);
  }, [entries]);

  const selectedEntry = entries[selectedIndex];
  const columns = stdout?.columns ?? 80;
  const rows = stdout?.rows ?? 24;
  const listHeight = Math.max(
    MIN_LIST_HEIGHT,
    rows - HEADER_HEIGHT - FOOTER_HEIGHT - DETAILS_HEIGHT
  );

  const listBodyHeight = Math.max(1, listHeight - 1);
  const { start, end } = getVisibleRange(
    entries.length,
    selectedIndex,
    listBodyHeight
  );
  const visibleEntries = entries.slice(start, end);

  const rankWidth = Math.max(3, String(entries.length || 1).length);
  const indicatorWidth = 2;
  const sizeWidth = 9;
  const nameWidth = Math.max(
    10,
    columns - rankWidth - indicatorWidth - sizeWidth - 3
  );

  const headerPath = truncateMiddle(
    `📂 Path: ${formatRootLabel(currentPath)}`,
    columns
  );
  const warningCount = getWarningCount(warnings);
  const timeLabel = lastRefreshAt
    ? lastRefreshAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    : '--:--:--';

  const footerParts = [
    'Keys: Up/Down Enter Backspace r ? q',
    `⟳ ${timeLabel}`,
    `⚠︎ ${warningCount}`
  ];

  if (isLoading) {
    footerParts.push('⏳ Scanning sizes...');
  }

  if (statusMessage) {
    footerParts.push(statusMessage);
  }

  const footerText = truncateEnd(footerParts.join(' | '), columns);

  const detailLines: string[] = [];
  if (helpVisible) {
    detailLines.push('Help');
    detailLines.push('  Up/Down : move selection');
    detailLines.push('  Enter   : drill into directory');
    detailLines.push('  Back    : go up');
    detailLines.push('  r       : refresh | q : quit | ? : toggle');
  } else if (!selectedEntry) {
    detailLines.push(isLoading ? 'Scanning...' : 'No entries');
  } else {
    const typeLabel = selectedEntry.isDir ? '📁 Directory' : '📄 File';
    const warningLine = warnings.length
      ? `⚠︎ ${warnings[warnings.length - 1]}`
      : '✓ No warnings';
    detailLines.push(
      `Selected: ${selectedEntry.isDir ? '📁' : '📄'} ${selectedEntry.name}`
    );
    detailLines.push(
      truncateMiddle(`Path: ${selectedEntry.fullPath}`, columns)
    );
    if (selectedEntry.sizeGb === null || selectedEntry.sizeGb === undefined) {
      detailLines.push('Size: scanning...');
    } else {
      const sizeText = formatSizeGb(selectedEntry.sizeGb);
      const percentText = formatPercent(selectedEntry.sizeGb, totalSizeGb);
      detailLines.push(`Size: ${sizeText} (${percentText})`);
    }
    detailLines.push(`Type: ${typeLabel}`);
    detailLines.push(truncateEnd(warningLine, columns));
  }

  while (detailLines.length < DETAILS_HEIGHT) {
    detailLines.push('');
  }
  const headerLine = [
    padLeft('Rk', rankWidth),
    padRight('Ty', indicatorWidth),
    padRight('Name', nameWidth),
    padLeft('Size', sizeWidth)
  ].join(' ');

  const listLines: React.ReactElement[] = [];
  listLines.push(
    h(Text, { key: 'list-header', dimColor: true }, truncateEnd(headerLine, columns))
  );

  if (visibleEntries.length === 0 && !isLoading) {
    listLines.push(
      h(Text, { key: 'list-empty', dimColor: true }, padRight('No entries', columns))
    );
  } else {
    visibleEntries.forEach((entry, index) => {
      const absoluteIndex = start + index;
      const rank = String(absoluteIndex + 1).padStart(rankWidth, ' ');
      const indicator = entry.isDir ? '📁' : '📄';
      const name = padRight(truncateEnd(entry.name, nameWidth), nameWidth);
      const size = padLeft(formatSizeGb(entry.sizeGb), sizeWidth);
      const rowText = `${rank} ${padRight(indicator, indicatorWidth)} ${name} ${size}`;
      const isSelected = absoluteIndex === selectedIndex;
      listLines.push(
        h(
          Text,
          {
            key: entry.fullPath,
            color: isSelected ? 'cyan' : undefined,
            bold: isSelected
          },
          truncateEnd(rowText, columns)
        )
      );
    });
  }

  const detailElements = detailLines.slice(0, DETAILS_HEIGHT).map((line, index) =>
    h(
      Text,
      {
        key: `detail-${index}`,
        dimColor: helpVisible || line.startsWith('Path:')
      },
      truncateEnd(line, columns)
    )
  );

  useEffect(() => {
    selectedPathRef.current = entries[selectedIndex]?.fullPath ?? null;
  }, [entries, selectedIndex]);

  return h(
    Box,
    { flexDirection: 'column' },
    h(Text, null, headerPath),
    h(Box, { flexDirection: 'column', height: listHeight }, ...listLines),
    h(Box, { flexDirection: 'column', height: DETAILS_HEIGHT }, ...detailElements),
    h(Text, { dimColor: true }, footerText)
  );
}
