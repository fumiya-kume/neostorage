export function kbToGb(sizeKb) {
  const bytes = sizeKb * 1024;
  return bytes / 1e9;
}

export function formatSizeGb(sizeGb) {
  if (sizeGb === null || sizeGb === undefined || Number.isNaN(sizeGb)) {
    return '--.- GB';
  }
  return `${sizeGb.toFixed(1)} GB`;
}

export function formatPercent(sizeGb, totalGb) {
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

export function truncateEnd(text, max) {
  if (text.length <= max) {
    return text;
  }
  if (max <= 3) {
    return text.slice(0, max);
  }
  return `${text.slice(0, max - 3)}...`;
}

export function truncateMiddle(text, max) {
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

export function padLeft(text, width) {
  if (text.length >= width) {
    return text;
  }
  return `${' '.repeat(width - text.length)}${text}`;
}

export function padRight(text, width) {
  if (text.length >= width) {
    return text;
  }
  return `${text}${' '.repeat(width - text.length)}`;
}
