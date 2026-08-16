import React, { useState, useEffect } from 'react';
import { TopNav } from './components/TopNav';
import { MiniPlayer } from './components/MiniPlayer';
import { PlayQueue } from './components/PlayQueue';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Player } from './pages/Player';
import { YearlyRanking } from './pages/YearlyRanking';

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
      setQQMusicUser({ nickname: 'QQ Music User' });
    }
  }, []);

  // QQ音乐登录处理函数
  const handleQQMusicLogin = (loggedInQQUser: QQMusicUser) => {
    setQQMusicUser(loggedInQQUser);
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
        return <Home onNavigate={setCurrentPage} qqMusicUser={qqMusicUser} onQQMusicLogin={() => document.getElementById('qq-music-login-btn')?.click()} />;
      case 'search':
        return <Search />;
      case 'player':
        return <Player />;
      case 'yearly-ranking':
        return <YearlyRanking pageType="yearly-ranking" />;
      case 'yearly-songs':
        return <YearlyRanking pageType="yearly-songs" />;
      case 'yearly-albums':
        return <YearlyRanking pageType="yearly-albums" />;
      case 'artist-recommendations':
        return <YearlyRanking pageType="artist-recommendations" />;
      case 'lyrics-tool':
        return <LyricsTool />;
      case 'audio-lab':
        return <AudioLab />;
      default:
        return <Home onNavigate={setCurrentPage} qqMusicUser={qqMusicUser} onQQMusicLogin={() => document.getElementById('qq-music-login-btn')?.click()} />;
    }
  };

  return (
    <RankingProvider>
      <MusicProvider>
        <SearchProvider>
          <div className="app">
          <TopNav 
            currentPage={currentPage} 
            onNavigate={setCurrentPage} 
            qqMusicUser={qqMusicUser} 
            onLogout={handleLogout} 
            onQQMusicLogin={handleQQMusicLogin}
            onTogglePlayQueue={() => setIsPlayQueueVisible(!isPlayQueueVisible)}
          />
          <main className="main-content">
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