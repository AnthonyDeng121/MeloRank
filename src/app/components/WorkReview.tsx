import React, { useState } from 'react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import { Modal } from './Modal';
import { renderReviewCard } from '../services/reviewCard';
import { type PlatformSong } from '../services/platformSongs';

interface Review { score: string; text: string; tracks: Record<string, string> }
const valid = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 10;
export function WorkReview({ id, title, artist, image, songs = [], year }: { id: string; title: string; artist: string; image: string; songs?: PlatformSong[]; year?: string }) {
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
      const canvas = await renderReviewCard({ title, artist, image, score: Number(review.score), album: songs.length > 0, year });
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
