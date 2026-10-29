import React, { useState } from 'react';
import '../../styles/TopNav.css';
import { PlatformLogin } from './PlatformLogin';
import { MusicProvider } from '../services/musicPlatforms';

interface TopNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  qqMusicUser?: { nickname: string } | null;
  onLogout?: () => void;
  onQQMusicLogin?: (user: { nickname: string }) => void;
  onTogglePlayQueue?: () => void;
}

export function TopNav({ currentPage, onNavigate, qqMusicUser, onLogout, onQQMusicLogin, onTogglePlayQueue }: TopNavProps) {
  const navItems = [
    { id: 'home', label: '首页' },
    { id: 'search', label: '搜索' },
    { id: 'player', label: '播放器' },
    { id: 'yearly-ranking', label: '年度榜单' },
    { id: 'audio-lab', label: '音频实验室' },
    { id: 'music-library', label: '我的音乐' },
  ];

  // QQ音乐登录相关状态
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [platform, setPlatform] = useState<MusicProvider>('qq');
  React.useEffect(() => { const open = (event: Event) => { setPlatform((event as CustomEvent).detail || 'qq'); setShowLoginModal(true); }; window.addEventListener('music-login', open); return () => window.removeEventListener('music-login', open); }, []);
  React.useEffect(() => { if (!showLoginModal) return; const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowLoginModal(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [showLoginModal]);
  return (
    <nav className="top-nav">
      <div className="top-nav-container">
        <h1 className="site-title">MeloRank</h1>
        <div className="nav-content">
          <ul className="nav-links">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          
          <div className="auth-buttons">
            <button 
              className="nav-button playqueue-button"
              onClick={() => onTogglePlayQueue?.()}
              title="播放队列"
            >
              📋 播放队列
            </button>
            <div className="user-menus">
              {qqMusicUser && (
                <div className="user-menu">
                  <span className="user-greeting">欢迎, {qqMusicUser.nickname}</span>
                  <button 
                    className="nav-button logout-button small"
                    onClick={() => onLogout?.()}
                    title="退出登录"
                  >
                    退出
                  </button>
                </div>
              )}
              {!qqMusicUser && (
                <>
                  <button 
                    id="qq-music-login-btn"
                    className="nav-button login-button"
                    onClick={() => setShowLoginModal(true)}
                  >
                    登录
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 登录模态框 */}
      {showLoginModal && <div className="login-modal-overlay" onClick={() => setShowLoginModal(false)}><div className="login-modal" role="dialog" aria-modal="true" aria-label="登录" onClick={e => e.stopPropagation()}><div className="modal-header"><h3>登录</h3><button className="close-btn" aria-label="Close" onClick={() => setShowLoginModal(false)}>×</button></div><div className="login-platforms">{(['qq', 'netease', 'spotify'] as MusicProvider[]).map(value => <button key={value} aria-pressed={platform === value} onClick={() => setPlatform(value)}>{value === 'qq' ? 'QQ音乐' : value === 'netease' ? '网易云' : 'Spotify'}</button>)}</div><PlatformLogin key={platform} provider={platform} onQQ={onQQMusicLogin} onDone={() => setShowLoginModal(false)} /></div></div>}
    </nav>
  );
}
