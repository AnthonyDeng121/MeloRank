// Use the main voiced range so isolated detector spikes do not flatten the plot.
export function pitchRange(frequencies: number[]) {
  const pitches: number[] = [];
  for (let index = 0; index < frequencies.length; index++) {
    const window = frequencies.slice(Math.max(0, index - 2), index + 3).filter(hz => hz > 0 && Number.isFinite(hz)).sort((a, b) => a - b);
    if (window.length >= 3) pitches.push(69 + 12 * Math.log2(window[Math.floor(window.length / 2)] / 440));
  }
  pitches.sort((a, b) => a - b);
  if (!pitches.length) return { low: 48, high: 72 };
  let low = Math.floor((pitches[0] - 3) / 3) * 3;
  let high = Math.ceil((pitches[pitches.length - 1] + 3) / 3) * 3;
  if (high - low < 24) {
    const center = Math.round((high + low) / 12) * 6;
    low = center - 12; high = center + 12;
  }
  return { low, high };
}
