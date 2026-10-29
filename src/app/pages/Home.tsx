import React from 'react';
import '../../styles/Home.css';

interface HomeProps {
  onNavigate: (page: string) => void;
  qqMusicUser: { nickname: string } | null;
  onQQMusicLogin: () => void;
}

export function Home({ onNavigate, qqMusicUser, onQQMusicLogin }: HomeProps) {
  return (
    <div className="home-page">
      <section className="hero-section">
        <h2>Welcome to MeloRank</h2>
        <p>你想喷BITCHFUCK，黑BITCHFUCK，骂BITCHFUCK都可以，但是MeloRank进来，干嘛要和好网站过不去呢?<br/>你点点看MeloRank的上面的导航栏，看一看，都是很好的功能</p>
      </section>

      <div className="entry-cards">
        <div className="entry-card">
          <div className="card-icon">🔍</div>
          <h3>搜索音乐</h3>
          {qqMusicUser ? (
            <>
              <p>已登录，点击立即搜索好歌</p>
              <button className="card-button" onClick={() => onNavigate('search')}>前往搜索</button>
            </>
          ) : (
            <>
              <p>连接 QQ音乐、网易云或 Spotify</p>
              <button className="card-button" onClick={onQQMusicLogin}>登录</button>
            </>
          )}
        </div>

        <div className="entry-card" onClick={() => onNavigate('yearly-ranking')}>
          <div className="card-icon">🏆</div>
          <h3>年度榜单</h3>
          <p>点击立即创建你的个人年榜</p>
          <button className="card-button">我的榜单</button>
        </div>
      </div>

      <section className="editor-recommendations">
        <h2>BITCHFUCK编者推荐</h2>
        <div className="recommendation-modules">
          <div className="recommendation-module" onClick={() => onNavigate('yearly-songs')}>
            <div className="module-icon">🎵</div>
            <h3>2025年度歌曲</h3>
            <p>点击欣赏BITCHFUCK 2025年度歌曲</p>
          </div>
          <div className="recommendation-module" onClick={() => onNavigate('yearly-albums')}>
            <div className="module-icon">💿</div>
            <h3>2025年度专辑</h3>
            <p>点击查看BITCHFUCK 2025年度专辑排行<br />(本主编只听过这些专辑)</p>
          </div>
          <div className="recommendation-module" onClick={() => onNavigate('artist-recommendations')}>
            <div className="module-icon">🎤</div>
            <h3>艺人推荐</h3>
            <p>尖椒炸猪排</p>
          </div>
        </div>
      </section>
    </div>
  );
}
