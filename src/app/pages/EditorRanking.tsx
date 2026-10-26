import { useEffect, useState } from 'react';
import { useMusic } from '../contexts/MusicContext';
import { qqMusicService } from '../services/qqMusicService';
import '../../styles/YearlyRanking.css';

interface EditorItem {
  id: string;
  rank: number;
  title: string;
  artist: string;
  coverUrl: string;
  review: string;
  type?: 'album' | 'ep';
}

export function EditorRanking({ kind }: { kind: 'songs' | 'albums' }) {
  const [items, setItems] = useState<EditorItem[]>([]);
  const [albumType, setAlbumType] = useState<'album' | 'ep'>('album');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { setCurrentSong, currentSong, isPlaying, togglePlay } = useMusic();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/chart/editor-${kind}.json`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('榜单加载失败，请刷新重试');
        return response.json();
      })
      .then(setItems)
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind]);

  const isCurrent = (item: EditorItem) => currentSong?.songname === item.title
    && currentSong.singer.some(singer => singer.name === item.artist.split('/')[0]);

  const play = async (item: EditorItem) => {
    if (isCurrent(item)) {
      togglePlay();
      return;
    }
    try {
      const result = await qqMusicService.search(`${item.title} ${item.artist}`, 1, 1);
      const response = result.response || result;
      const data = response.data || response;
      const song = data.song?.list?.[0];
      if (song) setCurrentSong(song, [song]);
      else alert('未搜索到歌曲，请稍后重试');
    } catch {
      alert('播放失败，请检查浏览器设置或网络连接');
    }
  };

  const visibleItems = kind === 'albums' ? items.filter(item => item.type === albumType) : items;

  return (
    <div className="yearly-ranking-page editor-ranking-page">
      <h1>{kind === 'songs' ? '2025年度单曲榜' : '2025专辑年榜-EP'}</h1>
      {kind === 'albums' && (
        <div className="album-type-tabs">
          <button className={`type-tab ${albumType === 'album' ? 'active' : ''}`} onClick={() => setAlbumType('album')}>Album</button>
          <button className={`type-tab ${albumType === 'ep' ? 'active' : ''}`} onClick={() => setAlbumType('ep')}>EP</button>
        </div>
      )}
      {loading && <p role="status">正在加载榜单…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="user-ranking-list">
        {visibleItems.map(item => (
          <div className="user-rank-item" key={item.id}>
            <div className="user-rank-number">{item.rank}</div>
            <div className="user-rank-cover"><img src={item.coverUrl} alt={`${item.title} - ${item.artist}`} /></div>
            <div className="user-rank-content">
              <div className="user-rank-title">{item.title}</div>
              <div className="user-rank-artist">{item.artist}</div>
              {item.review && <div className="user-rank-review">{item.review}</div>}
            </div>
            <button className="play-btn" aria-label={`${isCurrent(item) && isPlaying ? '暂停' : '播放'} ${item.title}`} onClick={() => play(item)}>
              {isCurrent(item) && isPlaying ? '⏸️' : '▶️'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
