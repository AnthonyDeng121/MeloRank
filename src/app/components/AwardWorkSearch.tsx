import React, { useEffect, useRef, useState } from 'react';
import { platformNames, usePlatformAccounts } from '../contexts/PlatformAccountsContext';
import { searchCatalog, type CatalogItem } from '../services/catalog';
import { searchPlatform, songCover, type PlatformSong } from '../services/platformSongs';

import { qqMusicService } from '../services/qqMusicService';

type Credits = Partial<Record<'lyrics' | 'melody' | 'production', string>>;
type Result = { id: string; title: string; artist: string; cover: string; credits?: Credits };

export function AwardWorkSearch({ album, onSelect }: { album: boolean; onSelect: (result: Result) => void }) {
  const { activeProvider } = usePlatformAccounts();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ provider: typeof activeProvider; keyword: string; items: Result[] }>();
  const results = found && found.provider === activeProvider && found.keyword === query.trim() ? found.items : [];
  const [status, setStatus] = useState('');
  const [selecting, setSelecting] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const keyword = query.trim();
    if (!keyword) return;
    let current = true;
    const timer = window.setTimeout(async () => {
      setStatus('搜索中…');
      try {
        let matches: Result[];
        if (album) {
          const { items } = await searchCatalog(activeProvider, 'albums', keyword, 8, 1);
          matches = items.map((item: CatalogItem) => ({ id: item.id, title: item.title, artist: item.artist, cover: item.image }));
        } else {
          const response = await searchPlatform(activeProvider, keyword, 8, 1);
          const body = response.response || response;
          const songs: PlatformSong[] = (body.data || body).song?.list ?? [];
          matches = songs.map(song => ({
            id: song.songmid, title: song.songname, artist: song.singer?.map(artist => artist.name).join(' / ') ?? '', cover: songCover(song),
          }));
        }
        if (!current) return;
        setFound({ provider: activeProvider, keyword, items: matches });
        setStatus(matches.length ? '' : '没有找到作品，可调整关键词或手动填写。');
      } catch {
        if (current) setStatus('搜索失败，请检查音乐平台连接或手动填写。');
      }
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [query, album, activeProvider]);

  async function select(item: Result) {
    setQuery('');
    setFound(undefined);
    setStatus('');
    if (album || activeProvider !== 'qq') {
      onSelect(item);
      return;
    }
    setSelecting(true);
    setStatus('正在读取 QQ 音乐署名…');
    try {
      const response = await qqMusicService.getLyric(item.id);
      const lyric = (response.response ?? response).lyric;
      const credits: Credits = {};
      if (typeof lyric === 'string') {
        const rules = {
          lyrics: /^(?:词|作词|填词)\s*[:：]\s*(.+)$/i,
          melody: /^(?:曲|作曲|谱曲)\s*[:：]\s*(.+)$/i,
          production: /^(?:制作人|音乐制作人|Produced by|Producer)\s*[:：]\s*(.+)$/i,
        };
        for (const line of lyric.split(/\r?\n/).slice(0, 45)) {
          const content = line.replace(/^(?:\[\d+:\d+(?:[.:]\d+)?\])+/, '').trim();
          for (const key of Object.keys(rules) as Array<keyof Credits>) {
            const name = content.match(rules[key])?.[1]?.trim();
            if (name) credits[key] = credits[key] ? credits[key] + ' / ' + name : name;
          }
        }
      }
      if (mounted.current) onSelect({ ...item, credits });
    } catch {
      if (mounted.current) onSelect(item);
    } finally {
      if (mounted.current) {
        setSelecting(false);
        setStatus('');
      }
    }
  }

  return <div className="award-work-search" key={activeProvider}>
    <label>搜索{album ? '专辑' : '歌曲'} · {platformNames[activeProvider]}
      <input type="search" value={query} onChange={event => { setQuery(event.target.value); setFound(undefined); setStatus(''); }} placeholder="输入作品名或艺人" disabled={selecting} />
    </label>
    {status && <p role="status">{status}</p>}
    {results.length > 0 && <ul>{results.map((item, index) => <li key={item.id + ':' + index}>
      <button type="button" onClick={() => void select(item)}>
        {item.cover && <img src={item.cover} alt="" />}<span>{item.title} · {item.artist}</span>
      </button>
    </li>)}</ul>}
  </div>;
}
