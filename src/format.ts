export function kbToGb(sizeKb: number): number {
  const bytes = sizeKb * 1024;
  return bytes / 1e9;
}

export function formatSizeGb(sizeGb: number | null | undefined): string {
  if (sizeGb === null || sizeGb === undefined || Number.isNaN(sizeGb)) {
    return '--.- GB';
  }
  return `${sizeGb.toFixed(1)} GB`;
}

export function formatPercent(
  sizeGb: number | null | undefined,
  totalGb: number
): string {
  if (
    sizeGb === null ||
    sizeGb === undefined ||
    Number.isNaN(sizeGb) ||
    totalGb <= 0
  ) {
    return '--.-%';
  }
  return `${((sizeGb / totalGb) * 100).toFixed(1)}%`;
}

export function truncateEnd(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  if (max <= 3) {
    return text.slice(0, max);
  }
  return `${text.slice(0, max - 3)}...`;
}

export function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  if (max <= 3) {
    return text.slice(0, max);
  }
  const left = Math.ceil((max - 3) * 0.6);
  const right = max - 3 - left;
  return `${text.slice(0, left)}...${text.slice(text.length - right)}`;
}

export function padLeft(text: string, width: number): string {
  if (text.length >= width) {
    return text;
  }
  return `${' '.repeat(width - text.length)}${text}`;
}

export function padRight(text: string, width: number): string {
  if (text.length >= width) {
    return text;
  }
  return `${text}${' '.repeat(width - text.length)}`;
}
