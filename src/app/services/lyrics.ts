export interface LyricLine { time: number; text: string }

export function parseLrc(value: string): LyricLine[] {
  const result: LyricLine[] = [];
  const offset = Number(/\[offset:([+-]?\d+)\]/i.exec(value)?.[1] || 0) / 1000;
  for (const line of value.split(/\r?\n/)) {
    const expression = /\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g;
    const timestamps = [...line.matchAll(expression)];
    const text = line.replace(expression, '').trim();
    for (const match of timestamps) result.push({ time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || 0}`) + offset, text });
  }
  return result.sort((a, b) => a.time - b.time);
}

export function matchLyric(lines: LyricLine[], time: number): string {
  let closest: LyricLine | undefined;
  for (const line of lines) if (Math.abs(line.time - time) <= 0.3 && (!closest || Math.abs(line.time - time) < Math.abs(closest.time - time))) closest = line;
  const text = closest?.text || '';
  return /^[\s/／]+$/.test(text) ? '' : text;
}

export function lyricCues(lines: LyricLine[], duration: number) {
  return lines.filter(line => line.text && !/^[\s/／]+$/.test(line.text) && line.time >= 0 && line.time < duration)
    .map((line, i, all) => ({ ...line, end: all.slice(i + 1).find(next => next.time > line.time)?.time ?? duration }));
}
