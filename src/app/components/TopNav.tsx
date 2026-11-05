import React, { useEffect, useState } from 'react';
import '../../styles/TopNav.css';
import { PlatformLogin } from './PlatformLogin';
import { type MusicProvider } from '../services/musicPlatforms';
import { platformList, platformNames, usePlatformAccounts } from '../contexts/PlatformAccountsContext';

interface TopNavProps {
  currentPage: string; onNavigate: (page: string) => void;
  onTogglePlayQueue?: () => void;
}
export function TopNav({ currentPage, onNavigate, onTogglePlayQueue }: TopNavProps) {
  const { accounts, activeProvider, selectProvider, refresh, disconnect } = usePlatformAccounts();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [platform, setPlatform] = useState<MusicProvider>(activeProvider);
  const account = accounts[activeProvider];
  const navItems = [{ id: 'home', label: '首页' }, { id: 'search', label: '搜索' }, { id: 'player', label: '播放器' }, { id: 'yearly-ranking', label: '年度榜单' }, { id: 'audio-lab', label: '音频实验室' }, { id: 'music-library', label: '我的音乐' }];
  useEffect(() => {
    const open = (event: Event) => { const provider = (event as CustomEvent).detail; setPlatform(platformList.includes(provider) ? provider : activeProvider); setShowLoginModal(true); };
    window.addEventListener('music-login', open); return () => window.removeEventListener('music-login', open);
  }, [activeProvider]);
  useEffect(() => { if (!showLoginModal) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowLoginModal(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [showLoginModal]);
  return <nav className="top-nav"><div className="top-nav-container">
    <h1 className="site-title">MeloRank</h1>
    <div className="nav-content"><ul className="nav-links">{navItems.map(item => <li key={item.id}><button className={`nav-link ${currentPage === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>{item.label}</button></li>)}</ul>
      <div className="auth-buttons"><button className="nav-button playqueue-button" onClick={() => onTogglePlayQueue?.()}>📋 播放队列</button>
        <div className="platform-user-menu">
          {account.connected && <span className="platform-user-name" title={`${platformNames[activeProvider]} · ${account.nickname}`}>{account.nickname}</span>}
          <label className="platform-switch">切换账号平台
            <select aria-label="切换账号平台" value={activeProvider} onChange={event => selectProvider(event.target.value as MusicProvider)}>
              {platformList.map(provider => <option key={provider} value={provider}>{platformNames[provider]}{accounts[provider].connected ? ' · 已登录' : ' · 未登录'}</option>)}
            </select>
          </label>
          <button id="qq-music-login-btn" className="nav-button login-button" onClick={() => { setPlatform(activeProvider); setShowLoginModal(true); }}>登录</button>
          {account.connected && <button className="nav-button logout-button small" onClick={() => void disconnect(activeProvider)}>退出</button>}
        </div>
      </div>
    </div>
  </div>
  {showLoginModal && <div className="login-modal-overlay" onClick={() => setShowLoginModal(false)}><div className="login-modal" role="dialog" aria-modal="true" aria-label="登录" onClick={event => event.stopPropagation()}>
    <div className="modal-header"><h3>登录</h3><button className="close-btn" aria-label="关闭登录" onClick={() => setShowLoginModal(false)}>×</button></div>
    <div className="login-platforms">{platformList.map(provider => <button key={provider} aria-pressed={provider === platform} onClick={() => setPlatform(provider)}>{platformNames[provider]}{accounts[provider].connected && <small>已登录</small>}</button>)}</div>
    <PlatformLogin key={platform} provider={platform} onDone={() => { selectProvider(platform); void refresh(platform); setShowLoginModal(false); }} />
  </div></div>}
  </nav>;
}
