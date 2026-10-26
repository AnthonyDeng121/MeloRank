import React, { useState, useEffect } from 'react';
import { TopNav } from './components/TopNav';
import { MiniPlayer } from './components/MiniPlayer';
import { PlayQueue } from './components/PlayQueue';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Player } from './pages/Player';
import { YearlyRanking } from './pages/YearlyRanking';
import { EditorRanking } from './pages/EditorRanking';

import { LyricsTool } from './pages/LyricsTool';
import { AudioLab } from './pages/AudioLab';
import { RankingProvider } from './contexts/RankingContext';
import { MusicProvider } from './contexts/MusicContext';
import { SearchProvider } from './contexts/SearchContext';
import { qqMusicService } from './services/qqMusicService';
import '../styles/App.css';

// QQ音乐用户类型定义
interface QQMusicUser {
  nickname: string;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [pageHistory, setPageHistory] = useState<string[]>([]);
  const navigate = (page: string) => {
    if (page === currentPage) return;
    setPageHistory(history => [...history, currentPage]);
    setCurrentPage(page);
  };
  const goBack = () => {
    setCurrentPage(pageHistory[pageHistory.length - 1] || 'home');
    setPageHistory(history => history.slice(0, -1));
  };
  // QQ音乐用户状态管理
  const [qqMusicUser, setQQMusicUser] = useState<QQMusicUser | null>(null);
  // 播放队列可见性状态
  const [isPlayQueueVisible, setIsPlayQueueVisible] = useState(false);

  // 从localStorage恢复登录状态
  useEffect(() => {
    // 检查QQ音乐用户状态
    const qqMusicCookie = localStorage.getItem('qqMusicCookie');
    if (qqMusicCookie) {
      // 如果有QQ音乐cookie，设置默认的QQ音乐用户状态
      setQQMusicUser({ nickname: localStorage.getItem('qqMusicNickname') || 'QQ音乐用户' });
      qqMusicService.getUserInfo().then(result => {
        const nickname = (result.body || result).nickname;
        if (nickname && nickname !== 'QQ Music User') {
          localStorage.setItem('qqMusicNickname', nickname);
          setQQMusicUser({ nickname });
        }
      }).catch(() => {});
    }
  }, []);

  // QQ音乐登录处理函数
  const handleQQMusicLogin = (loggedInQQUser: QQMusicUser) => {
    setQQMusicUser(loggedInQQUser);
    localStorage.setItem('qqMusicNickname', loggedInQQUser.nickname);
    console.log('QQ音乐用户已登录:', loggedInQQUser);
  };

  // 退出登录处理函数
  const handleLogout = () => {
    // 退出QQ音乐用户
    qqMusicService.logout();
    setQQMusicUser(null);
    console.log('QQ音乐用户已退出登录');
    setCurrentPage('home');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={navigate} qqMusicUser={qqMusicUser} onQQMusicLogin={() => document.getElementById('qq-music-login-btn')?.click()} />;
      case 'search':
        return <Search />;
      case 'player':
        return <Player />;
      case 'yearly-ranking':
        return <YearlyRanking pageType="yearly-ranking" />;
      case 'yearly-songs':
        return <EditorRanking key="songs" kind="songs" />;
      case 'yearly-albums':
        return <EditorRanking key="albums" kind="albums" />;
      case 'artist-recommendations':
        return <YearlyRanking pageType="artist-recommendations" />;
      case 'lyrics-tool':
        return <LyricsTool />;
      case 'audio-lab':
        return <AudioLab />;
      default:
        return <Home onNavigate={navigate} qqMusicUser={qqMusicUser} onQQMusicLogin={() => document.getElementById('qq-music-login-btn')?.click()} />;
    }
  };

  return (
    <RankingProvider>
      <MusicProvider>
        <SearchProvider>
          <div className="app">
          <TopNav 
            currentPage={currentPage} 
            onNavigate={navigate}
            qqMusicUser={qqMusicUser} 
            onLogout={handleLogout} 
            onQQMusicLogin={handleQQMusicLogin}
            onTogglePlayQueue={() => setIsPlayQueueVisible(!isPlayQueueVisible)}
          />
          <main className="main-content">
            {['yearly-songs', 'yearly-albums', 'artist-recommendations'].includes(currentPage) && (
              <button className="page-back-button" onClick={goBack} aria-label="返回" title="返回">{'<'}</button>
            )}
            {renderPage()}
          </main>
          <MiniPlayer />
          <PlayQueue 
            isVisible={isPlayQueueVisible} 
            onClose={() => setIsPlayQueueVisible(false)} 
          />
        </div>
        </SearchProvider>
      </MusicProvider>
    </RankingProvider>
  );
}
