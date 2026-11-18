import React, { useState } from 'react';
import { toast } from 'sonner';
import { useRankingContext } from '../contexts/RankingContext';
import { songCover, type PlatformSong } from '../services/platformSongs';

const dimensions = [['歌词', 25], ['作曲', 25], ['编曲', 25], ['演唱', 10], ['创新性', 5], ['个人喜好', 10]] as const;
export function SongRating({ song }: { song: PlatformSong }) {
  const { setRankingList, setRankingMode } = useRankingContext();
  const [scores, setScores] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [text, setText] = useState('');
  const total = scores.reduce((sum, score) => sum + score, 0);
  const submit = () => {
    setRankingMode('年度单曲榜');
    setRankingList(previous => {
      const artist = song.singer.map(s => s.name).join(', ');
      const list = previous.length === 3 && previous.every(item => ['1', '2', '3'].includes(item.id)) ? [] : [...previous];
      const index = list.findIndex(item => item.title === song.songname && item.artist === artist);
      const item = { id: `${song.provider || 'qq'}:${song.songmid}`, rank: 1, title: song.songname, artist, coverUrl: songCover(song), review: text || '没有评价的义务！', originalScore: total, integrity: 0, durability: 0, finalScore: 0 };
      if (index < 0) list.push(item); else list[index] = { ...list[index], originalScore: total, review: item.review };
      list.sort((a, b) => (b.originalScore + b.integrity + b.durability) - (a.originalScore + a.integrity + a.durability));
      const values = list.map(item => item.originalScore + item.integrity + item.durability);
      const max = Math.max(...values), min = Math.min(...values);
      return list.map((item, i) => ({ ...item, rank: i + 1, finalScore: max === min ? 10 : Number(((values[i] - min) / (max - min) * 10).toFixed(1)) }));
    });
    toast.success('评分已提交到年度单曲榜');
  };
  return <div className="song-rating-form"><div className="song-rating-fields">{dimensions.map(([label, max], index) => <label key={label}><span>{label}<small> / {max}</small></span><input aria-label={label} type="number" min="0" max={max} step="0.1" value={scores[index]} onChange={event => setScores(values => values.map((value, i) => i === index ? Math.min(max, Math.max(0, Number(event.target.value) || 0)) : value))} /></label>)}</div><div className="song-rating-total">总分 <strong>{Number(total.toFixed(1))} / 100</strong></div><textarea aria-label="歌曲评论" rows={3} value={text} onChange={event => setText(event.target.value)} placeholder="写下你的感受…" /><button onClick={submit}>提交评分到年度单曲榜</button></div>;
}
