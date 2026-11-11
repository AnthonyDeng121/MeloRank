import { DisabledFeedback } from './components/DisabledFeedback';
import type { CatalogItem } from './services/catalog';
import '../styles/MusicExperience.css';
import { PlatformAccountsProvider } from './contexts/PlatformAccountsContext';
import { Toaster } from 'sonner';
import React, { useState } from 'react';
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
import { MusicLibrary } from './pages/MusicLibrary';
import { RankingProvider } from './contexts/RankingContext';
import { MusicProvider } from './contexts/MusicContext';
import { SearchProvider } from './contexts/SearchContext';
import '../styles/App.css';

export default function App() {
  const [currentPage, setCurrentPage] = useState(() => /[?&](code|connectSpotify|error)=/.test(location.search) ? 'music-library' : 'home');
  const [catalogSelection, setCatalogSelection] = useState<CatalogItem | null>(null);
  const openCatalog = (item: CatalogItem) => { setCatalogSelection(item); navigate('player'); };
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
  // 播放队列面板状态
  const [isPlayQueueVisible, setIsPlayQueueVisible] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={navigate} />;
      case 'search':
        return <Search onOpenCatalog={openCatalog} />;
      case 'player':
        return <Player selection={catalogSelection} onSelectionChange={setCatalogSelection} />;
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
      case 'music-library':
        return <MusicLibrary onNavigate={navigate} />;
      default:
        return <Home onNavigate={navigate} />;
    }
  };

  return (
    <PlatformAccountsProvider><RankingProvider>
      <MusicProvider>
        <SearchProvider>
          <div className="app"><Toaster position="top-center" duration={3000} theme="dark" closeButton richColors />
          <TopNav 
            currentPage={currentPage} 
            onNavigate={navigate}
            onTogglePlayQueue={() => setIsPlayQueueVisible(!isPlayQueueVisible)}
          />
          <DisabledFeedback /><main className={`main-content ${currentPage === 'player' ? 'compact-player-content' : ''}`}>
            {['yearly-songs', 'yearly-albums', 'artist-recommendations'].includes(currentPage) && (
              <button className="page-back-button" onClick={goBack} aria-label="返回" title="返回">{'<'}</button>
            )}
            {renderPage()}
          </main>
          {currentPage !== 'player' && <MiniPlayer />}
          <PlayQueue 
            isVisible={isPlayQueueVisible} 
            onClose={() => setIsPlayQueueVisible(false)} 
          />
        </div>
        </SearchProvider>
      </MusicProvider>
    </RankingProvider></PlatformAccountsProvider>
  );
}
