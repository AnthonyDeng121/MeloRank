import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { netease, spotify, type MusicProvider } from '../services/musicPlatforms';
import { qqMusicService } from '../services/qqMusicService';

export const platformNames = { qq: 'QQ 音乐', netease: '网易云音乐', spotify: 'Spotify' };
export const platformList: MusicProvider[] = ['qq', 'netease', 'spotify'];
interface Account { connected: boolean; nickname: string }
const empty = (): Record<MusicProvider, Account> => ({ qq: { connected: false, nickname: '' }, netease: { connected: false, nickname: '' }, spotify: { connected: false, nickname: '' } });
const credential = (provider: MusicProvider) => provider === 'qq' ? localStorage.getItem('qqMusicCookie') || '' : provider === 'netease' ? netease.cookie() : sessionStorage.getItem('melorankSpotifyTokens') || '';
const AccountsContext = createContext<{
  accounts: Record<MusicProvider, Account>; activeProvider: MusicProvider;
  selectProvider: (provider: MusicProvider) => void; refresh: (provider?: MusicProvider) => Promise<void>; disconnect: (provider: MusicProvider) => Promise<void>;
} | null>(null);

export function PlatformAccountsProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState(() => {
    const values = empty();
    for (const provider of platformList) if (credential(provider)) values[provider] = { connected: true, nickname: sessionStorage.getItem(`melorankAccount:${provider}`) || (provider === 'qq' ? localStorage.getItem('qqMusicNickname') : '') || `${platformNames[provider]}用户` };
    return values;
  });
  const [activeProvider, setActiveProvider] = useState<MusicProvider>(() => {
    const saved = localStorage.getItem('melorankActiveProvider') as MusicProvider;
    return platformList.includes(saved) ? saved : netease.cookie() ? 'netease' : 'qq';
  });
  const versions = useRef({ qq: 0, netease: 0, spotify: 0 });
  const refresh = useCallback(async (selected?: MusicProvider) => {
    await Promise.all((selected ? [selected] : platformList).map(async provider => {
      const version = ++versions.current[provider], snapshot = credential(provider);
      if (!snapshot) { setAccounts(previous => ({ ...previous, [provider]: { connected: false, nickname: '' } })); return; }
      const cached = sessionStorage.getItem(`melorankAccount:${provider}`) || (provider === 'qq' ? localStorage.getItem('qqMusicNickname') : '') || `${platformNames[provider]}用户`;
      setAccounts(previous => ({ ...previous, [provider]: { connected: true, nickname: cached } }));
      try {
        let nickname;
        if (provider === 'qq') { const result = await qqMusicService.getUserInfo(); nickname = (result.body || result).nickname; }
        else if (provider === 'netease') nickname = (await netease.request('account')).nickname;
        else { const profile = await spotify.request('/me'); nickname = profile.display_name || profile.id; }
        if (version !== versions.current[provider] || !credential(provider)) return;
        if (provider !== 'spotify' && credential(provider) !== snapshot) return;
        nickname = nickname && nickname !== 'QQ Music User' ? nickname : cached;
        sessionStorage.setItem(`melorankAccount:${provider}`, nickname);
        setAccounts(previous => ({ ...previous, [provider]: { connected: true, nickname } }));
      } catch {
        if (version === versions.current[provider] && !credential(provider)) setAccounts(previous => ({ ...previous, [provider]: { connected: false, nickname: '' } }));
      }
    }));
  }, []);
  const selectProvider = useCallback((provider: MusicProvider) => {
    localStorage.setItem('melorankActiveProvider', provider);
    setActiveProvider(provider);
  }, []);
  useEffect(() => {
    void (async () => {
      try { await spotify.finish(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Spotify 授权失败'); }
      await refresh();
    })();
    const changed = () => void refresh();
    window.addEventListener('music-auth-change', changed);
    window.addEventListener('qqmusic-auth-change', changed);
    return () => { window.removeEventListener('music-auth-change', changed); window.removeEventListener('qqmusic-auth-change', changed); };
  }, [refresh, selectProvider]);
  useEffect(() => { window.dispatchEvent(new Event('music-platform-change')); }, [activeProvider]);
  const disconnect = async (provider: MusicProvider) => {
    versions.current[provider]++;
    setAccounts(previous => ({ ...previous, [provider]: { connected: false, nickname: '' } }));
    sessionStorage.removeItem(`melorankAccount:${provider}`);
    if (provider === activeProvider) window.dispatchEvent(new Event('music-platform-change'));
    if (provider === 'qq') qqMusicService.logout();
    else if (provider === 'netease') await netease.logout();
    else spotify.logout();
    window.dispatchEvent(new Event('music-auth-change'));
  };
  return <AccountsContext.Provider value={{ accounts, activeProvider, selectProvider, refresh, disconnect }}>{children}</AccountsContext.Provider>;
}
export function usePlatformAccounts() { const value = useContext(AccountsContext); if (!value) throw new Error('PlatformAccountsProvider is required'); return value; }
