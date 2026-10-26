export interface ImportedRankingRow {
  title: string;
  artist: string;
  originalScore: number;
  integrity: number;
  durability: number;
}

export function parseRankingText(text: string, withScores = true) {
  const items: ImportedRankingRow[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    let line = raw.replace(/[\s\u200b\ufeff]+/g, ' ').trim();
    if (!line) return;
    // An ordinal must have whitespace after its punctuation; 1.5 is a date, not rank 1.
    line = line.replace(/^\d+[.)、]\s+/, '');
    const date = /^(?:\d{2,4}-\d{1,2}-\d{1,2}|\d{1,2}[./]\d{1,2}|\d{1,2}月\d{1,2}日)\s+/.exec(line);
    if (date) {
      const remainder = line.slice(date[0].length);
      // A numeric title such as "1.5 - Artist" is not a date prefix.
      if (remainder.search(/\s+[-–—]\s+/) > 0) line = remainder;
    }
    const separator = /\s+[-–—]\s+/.exec(line);
    if (!separator) { errors.push(`第 ${index + 1} 行：作品名与作者之间需要“ - ”`); return; }
    const title = line.slice(0, separator.index).trim();
    let artist = line.slice(separator.index + separator[0].length).trim();
    let originalScore = 0, integrity = 0, durability = 0;
    // Match the entire expression at the END, preceded by whitespace and a nonempty artist.
    // Lazy artist matching still preserves "16 43": the suffix must consume the whole line.
    const score = withScores ? /^(.+?)\s+(\d+(?:\.\d+)?)(?:\s*\+\s*(?!\+)(\d+(?:\.\d+)?))?(?:\s*\+\+\s*(\d+(?:\.\d+)?))?$/.exec(artist) : null;
    if (score) {
      artist = score[1].trim();
      originalScore = Number(score[2]);
      integrity = Number(score[3] || 0);
      durability = Number(score[4] || 0);
      if (originalScore > 100 || integrity > 2 || durability > 2) {
        errors.push(`第 ${index + 1} 行：原始分数须为 0–100，加分须为 0–2；数字结尾作者请使用不评分格式`);
        return;
      }
    } else if (withScores && /\s+[+-]?\d[\d.\s+\-]*$/.test(artist)) {
      errors.push(`第 ${index + 1} 行：评分格式应为“66.4+2++1”，分数前必须有空格`);
      return;
    }
    if (!title || !artist) { errors.push(`第 ${index + 1} 行：作品名和作者名不能为空`); return; }
    items.push({ title, artist, originalScore, integrity, durability });
  });
  return { items, errors };
}
