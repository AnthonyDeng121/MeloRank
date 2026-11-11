import React, { useState } from 'react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import { Modal } from './Modal';
import { imageToPng } from '../services/rankingExport';
import { type PlatformSong } from '../services/platformSongs';

interface Review { score: string; text: string; tracks: Record<string, string> }
const valid = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 10;
export function WorkReview({ id, title, artist, image, songs = [] }: { id: string; title: string; artist: string; image: string; songs?: PlatformSong[] }) {
  const key = `melorank:work-review:v1:${id}`;
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Review>({ score: '', text: '', tracks: {} });
  const begin = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      const tracks = Object.fromEntries(Object.entries(saved?.tracks && typeof saved.tracks === 'object' ? saved.tracks : {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
      setReview({ score: typeof saved?.score === 'string' ? saved.score : '', text: typeof saved?.text === 'string' ? saved.text : '', tracks });
      setOpen(true);
    } catch { toast.error('评分记录无法读取，请检查浏览器本地数据'); }
  };
  const validate = () => {
    if (!valid(review.score) || Object.values(review.tracks).some(value => value !== '' && !valid(value))) { toast.error('请填写 0–10 之间的有效分数'); return false; }
    return true;
  };
  const save = () => {
    if (!validate()) return false;
    try { localStorage.setItem(key, JSON.stringify({ ...review, title, artist, updatedAt: new Date().toISOString() })); toast.success('评分已保存到当前浏览器'); return true; }
    catch { toast.error('本地存储空间不足，评分未保存'); return false; }
  };
  const exportImage = async () => {
    if (!validate() || busy) return;
    setBusy(true);
    try {
      await document.fonts.ready;
      const canvas = document.createElement('canvas'); canvas.width = 1200;
      const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器无法生成图片');
      const wrap = (text: string, width: number, font: string) => {
        context.font = font;
        const lines: string[] = [];
        for (const paragraph of text.split('\n')) {
          let line = '';
          for (const char of paragraph) { if (context.measureText(line + char).width > width && line) { lines.push(line); line = ''; } line += char; }
          lines.push(line);
        }
        return lines;
      };
      const titleLines = wrap(title, 640, 'bold 40px sans-serif');
      const artistLines = wrap(artist, 640, '24px sans-serif');
      const textLines = wrap(review.text, 1080, '26px sans-serif');
      const headerHeight = Math.max(390, 120 + titleLines.length * 48 + artistLines.length * 32 + 120);
      const rows = songs.map(song => ({ song, lines: wrap(song.songname, 840, '28px sans-serif') }));
      const height = headerHeight + textLines.length * 38 + 140 + rows.reduce((sum, row) => sum + Math.max(100, row.lines.length * 34 + 56), 0);
      if (height > 30000) throw new Error('内容过长，请缩短评论后导出');
      canvas.height = height;
      context.fillStyle = '#faf9f6'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#c43140'; context.font = 'bold 22px sans-serif'; context.fillText('MeloRank / PERSONAL REVIEW', 60, 48);
      const png = await imageToPng(image);
      const blob = new Blob([png as BlobPart], { type: 'image/png' }); const bitmap = await createImageBitmap(blob);
      context.drawImage(bitmap, 60, 80, 280, 280); bitmap.close();
      context.fillStyle = '#17171a'; context.font = 'bold 40px sans-serif'; titleLines.forEach((line, i) => context.fillText(line, 380, 120 + i * 48));
      let y = 135 + titleLines.length * 48;
      context.font = '24px sans-serif'; artistLines.forEach(line => { context.fillText(line, 380, y); y += 32; });
      context.strokeStyle = '#c43140'; context.lineWidth = 4; context.beginPath(); context.arc(435, y + 58, 48, 0, Math.PI * 2); context.stroke();
      context.fillStyle = '#c43140'; context.font = 'bold 34px serif'; context.textAlign = 'center'; context.fillText(Number(review.score).toFixed(1), 435, y + 70); context.textAlign = 'left';
      y = headerHeight; context.fillStyle = '#333'; context.font = '26px sans-serif';
      textLines.forEach(line => { context.fillText(line, 60, y); y += 38; }); y += 30;
      for (let index = 0; index < rows.length; index++) {
        const { song, lines } = rows[index]; const height = Math.max(100, lines.length * 34 + 56);
        context.strokeStyle = '#d0ceca'; context.lineWidth = 1; context.beginPath(); context.moveTo(60, y); context.lineTo(1140, y); context.stroke();
        context.fillStyle = '#17171a'; context.font = '24px sans-serif'; context.fillText(String(index + 1).padStart(2, '0'), 65, y + 44);
        context.font = '28px sans-serif'; lines.forEach((line, i) => context.fillText(line, 130, y + 44 + i * 34));
        context.fillStyle = '#777'; context.font = '20px sans-serif'; context.fillText(song.singer.map(s => s.name).join(' / '), 130, y + height - 16, 830);
        const score = review.tracks[song.songmid]; context.strokeStyle = '#888'; context.beginPath(); context.arc(1090, y + height / 2, 34, 0, Math.PI * 2); context.stroke();
        context.textAlign = 'center'; context.font = 'bold 24px serif'; context.fillText(valid(score || '') ? Number(score).toFixed(1) : '—', 1090, y + height / 2 + 8); context.textAlign = 'left'; y += height;
      }
      context.fillStyle = '#777'; context.font = '18px sans-serif'; context.fillText('个人评分 · 不代表平台或媒体评分', 60, canvas.height - 25);
      const output = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片生成失败')), 'image/png'));
      saveAs(output, `${title.replace(/[<>:"/\\|?*]/g, '_')}-个人乐评.png`);
    } catch (error) { toast.error(error instanceof Error ? error.message : '图片导出失败'); }
    finally { setBusy(false); }
  };
  return <><button className="work-review-entry" onClick={begin}>评分 / 导出乐评卡</button>{open && <Modal title={songs.length ? '专辑评分' : '歌曲评分'} onClose={() => { if (!busy) setOpen(false); }}>
    <p className="muted">独立个人评分，保存在当前浏览器，与年度榜单分别管理。</p>
    <div className="review-work-heading">{image && <img src={image} alt="作品封面" />}<div><h3>{title}</h3><p>{artist}</p></div></div>
    <label className="review-score-label">总体评分（0–10）<input aria-label="总体评分" type="number" min="0" max="10" step="0.1" value={review.score} onChange={e => setReview({ ...review, score: e.target.value })} /></label>
    <label className="review-text-label">我的乐评<textarea maxLength={6000} rows={3} value={review.text} onChange={e => setReview({ ...review, text: e.target.value })} placeholder="写下你的感受…" /></label>
    {!!songs.length && <div className="review-track-scores"><h3>逐曲评分</h3>{songs.map((song, index) => <label key={song.songmid}><span>{String(index + 1).padStart(2, '0')} · {song.songname}</span><input aria-label={`${song.songname} 评分`} type="number" min="0" max="10" step="0.1" placeholder="未评分" value={review.tracks[song.songmid] || ''} onChange={e => setReview({ ...review, tracks: { ...review.tracks, [song.songmid]: e.target.value } })} /></label>)}</div>}
    <div className="music-modal-actions"><button disabled={busy} data-disabled-reason="正在生成图片，请稍候" onClick={save}>保存评分</button><button disabled={busy} data-disabled-reason="正在生成图片，请稍候" onClick={exportImage}>{busy ? '生成图片中…' : '导出 PNG 图片'}</button></div>
  </Modal>}</>;
}
