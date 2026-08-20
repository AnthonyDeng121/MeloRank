import React, { useState, useRef } from 'react';
import { qqMusicService } from '../services/qqMusicService';
import '../../styles/TopNav.css';

interface TopNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  qqMusicUser?: { nickname: string } | null;
  onLogout?: () => void;
  onQQMusicLogin?: (user: { nickname: string }) => void;
  onTogglePlayQueue?: () => void;
  siteUser?: { username: string } | null;
  onSiteLogin?: (user: { username: string }) => void;
  onSiteLogout?: () => void;
}

export function TopNav({ currentPage, onNavigate, qqMusicUser, onLogout, onQQMusicLogin, onTogglePlayQueue, siteUser, onSiteLogin, onSiteLogout }: TopNavProps) {
  const navItems = [
    { id: 'home', label: '首页' },
    { id: 'search', label: '搜索' },
    { id: 'player', label: '播放器' },
    { id: 'yearly-ranking', label: '年度榜单' },
    { id: 'audio-lab', label: '音频实验室' },
  ];

  // QQ音乐登录相关状态
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSiteAuth, setShowSiteAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const loginIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 处理QQ音乐登录
  const handleQQMusicLogin = async () => {
    try {
      setShowLoginModal(true);
      
      // 真实API调用流程
      try {
        // 步骤1：获取登录二维码
        const qrResponse = await qqMusicService.getLoginQr();
        console.log('获取二维码响应:', qrResponse);
        
        // 处理API响应 - 检查img字段是否存在
        if (qrResponse.img) {
          // 成功获取二维码
          setQrCodeUrl(qrResponse.img);
          const { ptqrtoken, qrsig } = qrResponse;
          
          // 步骤2：轮询检查登录状态
          const interval = setInterval(async () => {
            try {
              const statusResponse = await qqMusicService.checkLoginStatus({ ptqrtoken, qrsig });
              console.log('检查登录状态响应:', statusResponse);
              
              // 检查API是否直接返回了body
              const statusData = statusResponse.body || statusResponse;
              
              if (statusData.refresh) {
                // 二维码已失效
                clearInterval(interval);
                setShowLoginModal(false);
                alert('登录二维码已失效，请重新登录');
              } else if (statusData.isOk === false) {
                // 等待扫码，继续轮询
                console.log('等待扫码...');
              } else if (statusData.isOk === true) {
                // 登录成功
                clearInterval(interval);
                setShowLoginModal(false);
                
                // 保存返回的cookie
                if (statusData.cookie) {
                  qqMusicService.setCookie(statusData.cookie);
                  console.log('保存的cookie:', statusData.cookie);
                }
                
                // 直接使用登录响应中的nickname（如果有）
                if (statusData.nickname) {
                  console.log('直接从登录响应获取昵称:', statusData.nickname);
                  // 调用回调函数，更新全局状态
                  if (onQQMusicLogin) {
                    onQQMusicLogin({ nickname: statusData.nickname });
                  }
                } else {
                  // 登录成功后获取用户信息
                  try {
                    // 尝试从QQ音乐API获取用户信息
                    const infoResponse = await qqMusicService.getUserInfo();
                    console.log('获取用户信息响应:', infoResponse);
                    
                    // 处理API响应 - 直接使用infoResponse
                    const userInfo = infoResponse.body || infoResponse;
                    console.log('处理后的用户信息:', userInfo);
                    
                    // 调用回调函数，更新全局状态
                    if (onQQMusicLogin && userInfo.nickname) {
                      onQQMusicLogin({ nickname: userInfo.nickname });
                    }
                  } catch (error) {
                    console.error('获取用户信息失败:', error);
                    // 使用默认昵称
                    if (onQQMusicLogin) {
                      onQQMusicLogin({ nickname: 'QQ音乐用户' });
                    }
                  }
                }
              } else {
                // 其他状态，继续轮询
                console.log('继续轮询...');
              }
            } catch (error) {
              console.error('检查登录状态失败:', error);
              clearInterval(interval);
              setShowLoginModal(false);
              alert('检查登录状态失败，请稍后重试');
            }
          }, 2000);
          
          loginIntervalRef.current = interval;
        } else {
          // 获取二维码失败
          console.error('获取二维码失败:', qrResponse);
          setShowLoginModal(false);
          alert('获取二维码失败，请稍后重试');
        }
      } catch (error) {
        console.error('QQ音乐API调用失败:', error);
        // API调用失败，显示错误信息
        setShowLoginModal(false);
        alert('登录失败，请稍后重试');
      }
    } catch (error) {
      console.error('QQ音乐登录失败:', error);
      // 登录失败时，显示错误信息
      setShowLoginModal(false);
      alert('登录失败，请稍后重试');
    }
  };

  const handleSiteAuth = (event: React.FormEvent) => {
    event.preventDefault();
    const name = username.trim();
    if (!name || !password) return;
    const accounts = JSON.parse(localStorage.getItem('meloRankAccounts') || '{}');
    if (authMode === 'register') {
      if (accounts[name]) { alert('账号已存在，请直接登录'); return; }
      accounts[name] = password;
      localStorage.setItem('meloRankAccounts', JSON.stringify(accounts));
    } else if (accounts[name] !== password) {
      alert('账号或密码错误'); return;
    }
    localStorage.setItem('meloRankSiteUser', JSON.stringify({ username: name }));
    onSiteLogin?.({ username: name });
    setShowSiteAuth(false); setPassword('');
  };

  // 清理函数
  React.useEffect(() => {
    return () => {
      if (loginIntervalRef.current) {
        clearInterval(loginIntervalRef.current);
      }
    };
  }, []);

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
              {siteUser && !qqMusicUser && (
                <>
                  <button 
                    id="qq-music-login-btn"
                    className="nav-button login-button"
                    onClick={handleQQMusicLogin}
                  >
                    登录QQ音乐
                  </button>
                </>
              )}
              {!siteUser && <button className="nav-button login-button" onClick={() => setShowSiteAuth(true)}>网站登录 / 注册</button>}
              {siteUser && <button className="nav-button logout-button small" onClick={onSiteLogout}>退出网站</button>}
            </div>
          </div>
        </div>
      </div>

      {/* 登录模态框 */}
      {showLoginModal && (
        <div className="login-modal-overlay">
          <div className="login-modal">
            <div className="modal-header">
              <h3>QQ音乐登录</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowLoginModal(false);
                  if (loginIntervalRef.current) {
                    clearInterval(loginIntervalRef.current);
                  }
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <p>请使用QQ音乐APP扫描二维码登录</p>
              {qrCodeUrl && (
                <div className="qr-code-container">
                  <img src={qrCodeUrl} alt="QQ音乐登录二维码" className="qr-code" />
                </div>
              )}
              <p className="modal-hint">登录后可同步您的QQ音乐数据</p>
            </div>
          </div>
        </div>
      )}
      {showSiteAuth && (
        <div className="site-auth-overlay" role="dialog" aria-modal="true">
          <div className="site-auth-dialog">
            <div className="site-auth-header"><h3>{authMode === 'login' ? '网站登录' : '注册账号'}</h3><button className="site-auth-close" aria-label="关闭" onClick={() => setShowSiteAuth(false)}>×</button></div>
            <form className="site-auth-form" onSubmit={handleSiteAuth}>
              <label>用户名<input value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入用户名或邮箱" autoComplete="username" required /></label>
              <label>密码<input value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required /></label>
              <button className="site-auth-submit" type="submit">{authMode === 'login' ? '登录' : '注册并登录'}</button>
              <button type="button" className="site-auth-switch" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? '没有账号？立即注册' : '已有账号？返回登录'}</button>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
