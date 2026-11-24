import React, { useState } from 'react';
import { platformNames, usePlatformAccounts } from '../contexts/PlatformAccountsContext';
import { searchCatalog, type CatalogItem } from '../services/catalog';
import { searchPlatform, songCover, type PlatformSong } from '../services/platformSongs';

type Result = { id: string; title: string; artist: string; cover: string };

export function AwardWorkSearch({ album, onSelect }: { album: boolean; onSelect: (result: Result) => void }) {
  const { activeProvider } = usePlatformAccounts();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function search() {
    if (!query.trim() || busy) return;
    setBusy(true);
    setResults([]);
    setStatus('搜索中…');
    try {
      let matches: Result[];
      if (album) {
        const { items } = await searchCatalog(activeProvider, 'albums', query.trim(), 8, 1);
        matches = items.map((item: CatalogItem) => ({ id: item.id, title: item.title, artist: item.artist, cover: item.image }));
      } else {
        const response = await searchPlatform(activeProvider, query.trim(), 8, 1);
        const body = response.response || response;
        const songs: PlatformSong[] = (body.data || body).song?.list ?? [];
        matches = songs.map(song => ({
          id: song.songmid, title: song.songname, artist: song.singer?.map(artist => artist.name).join(' / ') ?? '', cover: songCover(song),
        }));
      }
      setResults(matches);
      setStatus(matches.length ? '' : '没有找到作品，可调整关键词或手动填写。');
    } catch {
      setStatus('搜索失败，请检查音乐平台连接或手动填写。');
    } finally { setBusy(false); }
  }

  return <div className="award-work-search">
    <form className="awards-actions" onSubmit={event => { event.preventDefault(); void search(); }}>
      <label>搜索{album ? '专辑' : '歌曲'} · {platformNames[activeProvider]}
        <input value={query} onChange={event => { setQuery(event.target.value); setResults([]); setStatus(''); }} placeholder="输入作品名或艺人" disabled={busy} />
      </label>
      <button disabled={busy || !query.trim()}>搜索</button>
    </form>
    {status && <p role="status">{status}</p>}
    {results.length > 0 && <ul>{results.map((item, index) => <li key={item.id + ':' + index}>
      <button type="button" onClick={() => { onSelect(item); setResults([]); setStatus(''); }}>
        {item.cover && <img src={item.cover} alt="" />}<span>{item.title} · {item.artist}</span>
      </button>
    </li>)}</ul>}
  </div>;
}
