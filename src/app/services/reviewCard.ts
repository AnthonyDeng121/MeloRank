import { imageToPng } from './rankingExport';

export async function renderReviewCard({ title, artist, image, score, album, year }: { title: string; artist: string; image: string; score: number; album: boolean; year?: string }) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1400; canvas.height = 1320;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器无法生成图片');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1400, 1320);
  ctx.fillStyle = '#202020'; ctx.textAlign = 'center';
  ctx.font = '700 44px Arial, sans-serif'; ctx.fillText(album ? 'ALBUMS' : 'SONGS', 700, 164);
  const centered = (text: string, y: number, size: number, font: string) => {
    ctx.font = font.replace('{size}', String(size));
    while (ctx.measureText(text).width > 1160 && size > 22) { size -= 2; ctx.font = font.replace('{size}', String(size)); }
    ctx.fillText(text, 700, y);
  };
  centered(title, 310, 96, 'italic 700 {size}px Georgia, "Times New Roman", serif');
  centered(artist, 455, 72, '400 {size}px Arial, sans-serif');
  if (year) { ctx.font = '46px Arial, sans-serif'; ctx.fillText(year, 700, 575); }
  // Never silently export a placeholder in place of the selected artwork.
  const bytes = await imageToPng(image, true);
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/png' }));
  ctx.drawImage(bitmap, 200, 685, 520, 520); bitmap.close();
  ctx.lineWidth = 18; ctx.strokeStyle = '#252525'; ctx.beginPath(); ctx.arc(1000, 945, 183, 0, 2 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#252525'; ctx.textBaseline = 'middle'; ctx.font = 'italic 700 120px Arial, sans-serif'; ctx.fillText(score.toFixed(1), 1000, 955);
  return canvas;
}
