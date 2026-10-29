const { decryptQrc } = require('qrc-decoder');

function decodeLyric(value) {
  if (typeof value !== 'string' || !value) return '';
  let decoded;
  try {
    decoded = /^[0-9a-f]+$/i.test(value) && value.length % 16 === 0
      ? decryptQrc(value)
      : value.includes('[') ? value : Buffer.from(value, 'base64').toString('utf8');
  } catch { return ''; }
  // Romanization may arrive as QRC XML with millisecond line and word timing.
  const content = /LyricContent="([\s\S]*?)"\s*\/?\s*>/.exec(decoded)?.[1] || decoded;
  return content.replace(/&#10;|&#xA;/gi, '\n').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\[(\d+),(\d+)\]/g, (_, start) => {
      const seconds = Number(start) / 1000;
      return `[${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toFixed(3).padStart(6, '0')}]`;
    }).replace(/\(\d+,\d+(?:,\d+)?\)/g, '');
}

module.exports = { decodeLyric };
