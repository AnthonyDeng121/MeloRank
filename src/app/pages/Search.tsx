import React, { useState, useEffect, useCallback, useRef } from 'react';
import { qqMusicService } from '../services/qqMusicService';
import { useMusic } from '../contexts/MusicContext';
import { useSearch } from '../contexts/SearchContext';
import { useRankingContext } from '../contexts/RankingContext';
import '../../styles/Search.css';

export function Search() {
  const { setCurrentSong, addSongToQueue } = useMusic();
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    activeTab,
    setActiveTab,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalResults,
    setTotalResults,
    loading,
    setLoading
  } = useSearch();
  
  // 使用榜单上下文
  const { rankingList, setRankingList, setRankingMode } = useRankingContext();
  
  // 自动刷新定时器引用
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖函数引用
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // 评论弹窗状态
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  
  // 评论表单状态管理
  const [ratings, setRatings] = useState({
    lyrics: 0,
    composition: 0,
    arrangement: 0,
    singing: 0,
    innovation: 0,
    preference: 0
  });
  const [comment, setComment] = useState('');
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  
  // 计算总分
  const totalScore = ratings.lyrics + ratings.composition + ratings.arrangement + ratings.singing + ratings.innovation + ratings.preference;

  // 执行搜索 - 使用useCallback优化，避免无限循环
  const handleSearch = useCallback(async (page: number = 1) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      console.log('开始搜索:', searchQuery, '页码:', page);
      // 只搜索歌曲类型
      const searchResponse = await qqMusicService.searchWithType(searchQuery, pageSize, 'songs', page);
      console.log('搜索响应:', searchResponse);
      
      // 处理API响应
      const searchResultsData = searchResponse;
      console.log('处理后的搜索结果数据:', searchResultsData);
      
      setSearchResults(searchResultsData);
      setCurrentPage(page);
      
      // 设置总结果数（只处理歌曲）
      const responseData = searchResultsData.response || searchResultsData;
      const actualData = responseData.data || responseData;
      if (actualData.song?.totalnum) {
        setTotalResults(actualData.song.totalnum);
      } else if (actualData.song?.list) {
        setTotalResults(actualData.song.list.length);
      } else {
        setTotalResults(0);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      // 搜索失败时清空结果
      setSearchResults(null);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, pageSize]);

  // 自动刷新搜索结果的逻辑 - 每30秒自动刷新一次
  useEffect(() => {
    // 清除现有定时器
    const clearTimer = () => {
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };

    // 只有在有搜索内容时才自动刷新
    if (searchQuery.trim()) {
      // 设置30秒自动刷新定时器
      const refreshInterval = 30000; // 30秒
      const startAutoRefresh = async () => {
        console.log('自动刷新搜索结果');
        await handleSearch(currentPage);
        // 继续下一次刷新
        autoRefreshTimerRef.current = setTimeout(startAutoRefresh, refreshInterval);
      };
      autoRefreshTimerRef.current = setTimeout(startAutoRefresh, refreshInterval);
    }

    // 组件卸载时清除定时器
    return () => clearTimer();
  }, [searchQuery, currentPage, handleSearch]);

  // 最近搜索时间，用于防止连续请求
  const lastSearchTimeRef = useRef<number>(0);
  const MIN_SEARCH_INTERVAL = 1000; // 最小搜索间隔（毫秒）

  // 带防抖和频率限制的搜索
  const debouncedSearch = useCallback((page: number = 1) => {
    // 清除之前的定时器
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // 设置新的定时器，500ms后执行搜索
    debounceRef.current = setTimeout(() => {
      const now = Date.now();
      if (now - lastSearchTimeRef.current < MIN_SEARCH_INTERVAL) {
        console.log('搜索频率过高，已忽略请求');
        return;
      }
      lastSearchTimeRef.current = now;
      handleSearch(page);
    }, 500);
  }, [searchQuery, pageSize, handleSearch]);

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      debouncedSearch(1); // 从第一页开始搜索
    }
  };

  // 处理分页点击
  const handlePageChange = (page: number) => {
    debouncedSearch(page);
  };

  // 处理标签页切换
  const handleTabChange = (tab: 'songs') => {
    setActiveTab(tab);
    setCurrentPage(1); // 切换标签页时重置到第一页
    if (searchQuery.trim()) {
      debouncedSearch(1); // 如果有搜索内容，重新搜索
    }
  };
  
  // 处理评分变化
  const handleRatingChange = (field: keyof typeof ratings, value: number) => {
    setRatings(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // 计算线性映射十分制分数的函数
  const calculateLinearScores = (items: any[]): any[] => {
    // 计算每个作品的百分制总分，解决浮点数精度问题
    const itemsWithTotalScore = items.map(item => ({
      ...item,
      totalScore: parseFloat((item.originalScore + item.integrity + item.durability).toFixed(2))
    }));
    
    // 根据总分降序排序
    const sortedItems = [...itemsWithTotalScore].sort((a, b) => b.totalScore - a.totalScore);
    
    // 找出最高分和最低分
    const scores = sortedItems.map(item => item.totalScore);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    // 如果所有分数相同，直接返回10.0分（或平均分）并重新分配排名
    if (maxScore === minScore) {
      return sortedItems.map((item, index) => ({
        id: item.id,
        rank: index + 1,
        title: item.title,
        artist: item.artist,
        coverUrl: item.coverUrl,
        review: item.review,
        originalScore: item.originalScore,
        integrity: item.integrity,
        durability: item.durability,
        finalScore: 10.0,
        totalScore: item.totalScore
      }));
    }
    
    // 线性映射到0-10分，并重新分配排名
    return sortedItems.map((item, index) => {
      const normalizedScore = (item.totalScore - minScore) / (maxScore - minScore) * 10;
      return {
        id: item.id,
        rank: index + 1,
        title: item.title,
        artist: item.artist,
        coverUrl: item.coverUrl,
        review: item.review,
        originalScore: item.originalScore,
        integrity: item.integrity,
        durability: item.durability,
        finalScore: parseFloat(normalizedScore.toFixed(1)),
        totalScore: item.totalScore
      };
    });
  };

  // 将评分数据添加到年度单曲榜单的函数
  const addToYearlyRanking = () => {
    if (!selectedSong) return;
    
    // 确保切换到年度单曲榜
    setRankingMode('年度单曲榜');
    
    // 创建新的榜单项目
    const newRankingItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      rank: 1,
      title: selectedSong.songname,
      artist: selectedSong.singer.map((s: any) => s.name).join(', '),
      coverUrl: `https://y.qq.com/music/photo_new/T002R300x300M000${selectedSong.albummid}.jpg`,
      review: comment || '没有评价的义务！',
      originalScore: totalScore,
      integrity: 0,
      durability: 0,
      finalScore: 0
    };
    
    // 检查是否是样例数据（默认的3条数据）
    const isSampleData = rankingList.length === 3 && rankingList.every(item => 
      item.id === '1' || item.id === '2' || item.id === '3'
    );
    
    let updatedList;
    if (isSampleData) {
      // 如果是样例数据，直接替换为新的榜单
      updatedList = [newRankingItem];
    } else {
      // 检查歌曲是否已存在于榜单中
      const existingIndex = rankingList.findIndex(item => 
        item.title === selectedSong.songname && 
        item.artist === selectedSong.singer.map((s: any) => s.name).join(', ')
      );
      
      if (existingIndex >= 0) {
        // 如果歌曲已存在，更新评分和评论
        updatedList = [...rankingList];
        updatedList[existingIndex] = {
          ...updatedList[existingIndex],
          originalScore: totalScore,
          review: comment || '没有评价的义务！'
        };
      } else {
        // 如果歌曲不存在，添加新条目
        updatedList = [...rankingList, newRankingItem];
      }
    }
    
    // 重新计算分数和排名
    const recalculatedList = calculateLinearScores(updatedList);
    
    // 更新榜单
    setRankingList(recalculatedList);
    
    console.log('成功将歌曲添加到年度单曲榜单:', newRankingItem.title);
  };

  // 处理评论提交
  const handleSubmitReview = () => {
    if (!selectedSong) return;
    
    // 创建评论数据（仅用于本地日志）
    const reviewData = {
      songId: selectedSong.songmid,
      songName: selectedSong.songname,
      artist: selectedSong.singer.map((s: any) => s.name).join(', '),
      album: selectedSong.albumname,
      coverUrl: `https://y.qq.com/music/photo_new/T002R300x300M000${selectedSong.albummid}.jpg`,
      ratings,
      totalScore,
      comment,
      createdAt: new Date().toISOString()
    };
    
    console.log('准备提交评论数据:', reviewData);
    
    // 将评分添加到年度单曲榜单
    addToYearlyRanking();
    
    // 显示提交成功提示
    setShowSubmitSuccess(true);
    setTimeout(() => setShowSubmitSuccess(false), 2000);
    
    // 重置表单
    setRatings({
      lyrics: 0,
      composition: 0,
      arrangement: 0,
      singing: 0,
      innovation: 0,
      preference: 0
    });
    setComment('');
    
    console.log('评论和评分已成功添加到本地年度榜单');
    
    // 关闭弹窗
    setShowCommentModal(false);
  };
  
  // 打开评论弹窗
  const openCommentModal = (song: any) => {
    setSelectedSong(song);
    setShowCommentModal(true);
  };

  // 渲染搜索结果
  const renderResults = () => {
    if (loading) {
      return <div className="loading-results">正在搜索...</div>;
    }

    if (!searchQuery.trim()) {
      return <div className="no-results">输入关键词开始搜索</div>;
    }

    if (!searchResults) {
      return <div className="no-results">没有找到相关结果</div>;
    }

    console.log('渲染搜索结果，当前searchResults:', searchResults);

    // 处理qq-music-api返回的搜索结果格式
    let songList: any[] = [];
    
    // 检查多种可能的数据格式
    const responseData = searchResults.response || searchResults;
    const actualData = responseData.data || responseData;
    
    if (actualData.song && actualData.song.list) {
      songList = actualData.song.list;
    } else {
      console.error('未知的搜索结果格式:', searchResults);
      return <div className="no-results">搜索结果格式错误</div>;
    }
    
    console.log('实际歌曲列表:', songList);
    
    if (songList.length > 0) {
      return songList.map((song: any) => {
        // 确保song对象有必要的属性
        if (!song || !song.songmid) {
          return null;
        }
        
        return (
          <div key={song.songmid} className="result-item">
            <div className="result-cover">
              {song.albummid && (
                <img 
                  src={`https://y.qq.com/music/photo_new/T002R300x300M000${song.albummid}.jpg`} 
                  alt={song.songname || '歌曲封面'} 
                  className="result-image" 
                />
              )}
            </div>
            <div className="result-info">
              <div className="result-title">{song.songname || '未知歌曲'}</div>
              <div className="result-subtitle">
                {song.singer?.map((artist: any) => artist.name || '未知歌手').join(', ') || '未知歌手'} · {song.albumname || '未知专辑'}
              </div>
            </div>
            <div className="result-actions">
              <button 
                className="action-btn" 
                onClick={() => {
                  // 处理搜索结果，构建播放队列
                  const responseData = searchResults.response || searchResults;
                  const actualData = responseData.data || responseData;
                  const songList = actualData.song?.list || [];
                  setCurrentSong(song, songList);
                  console.log('播放歌曲:', song);
                }}
              >
                播放
              </button>
              <button 
                className="action-btn" 
                onClick={() => {
                  addSongToQueue(song);
                  console.log('添加到队列:', song);
                }}
              >
                添加到队列
              </button>
              <button 
                className="action-btn" 
                onClick={() => openCommentModal(song)}
              >
                评论
              </button>
            </div>
          </div>
        );
      }).filter(Boolean); // 过滤掉null项
    }

    return <div className="no-results">没有找到相关结果</div>;
  };

  return (
    <div className="search-page">
      <div className="search-header">
        <div className="header-top">
          <h2>搜索音乐</h2>
        </div>
        <div className="search-input-container">
          <input
            type="text"
            className="search-input"
            placeholder="搜索歌曲、专辑或艺术家..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // 用户输入时触发防抖搜索
              debouncedSearch(1);
            }}
            onKeyPress={handleKeyPress}
          />
          <button className="search-button" onClick={() => debouncedSearch(1)}>
            搜索
          </button>
        </div>
      </div>

      <div className="search-tabs">
        <button
          className={`tab ${activeTab === 'songs' ? 'active' : ''}`}
          onClick={() => handleTabChange('songs')}
        >
          歌曲
        </button>
      </div>

      <div className="search-results">
        {renderResults()}

        {totalResults > 0 && searchResults && (
          <div className="pagination">
            {/* 根据当前页实际返回的结果数量动态计算总页数 */}
            {/* 处理qq-music-api返回的搜索结果格式 */}
            {(() => {
              const responseData = searchResults.response || searchResults;
              const actualData = responseData.data || responseData;
              let actualResultsCount = 0;
              
              // 只计算歌曲结果数量
              if (actualData.song?.list) {
                actualResultsCount = actualData.song.list.length;
              }
              
              // 计算总页数
              const totalPagesFromApi = Math.ceil(totalResults / pageSize);
              
              // 如果当前页返回的结果数量少于每页大小，说明这是最后一页
              const isLastPage = actualResultsCount < pageSize;
              const effectiveTotalPages = isLastPage ? currentPage : Math.min(totalPagesFromApi, currentPage + 5); // 只显示当前页后5页
              const finalTotalPages = Math.max(1, effectiveTotalPages);
              
              // 生成显示的页码范围（只显示当前页附近的页码，避免过多空白页码）
              const getPageNumbers = () => {
                const pageNumbers = [];
                const maxVisiblePages = 5; // 最多显示5个页码
                
                // 计算起始页码
                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                // 计算结束页码
                let endPage = Math.min(finalTotalPages, startPage + maxVisiblePages - 1);
                
                // 调整起始页码，确保显示足够的页码
                if (endPage - startPage + 1 < maxVisiblePages) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }
                
                // 添加页码
                for (let i = startPage; i <= endPage; i++) {
                  pageNumbers.push(i);
                }
                
                return pageNumbers;
              };
              
              const pageNumbers = getPageNumbers();
              
              return (
                <>
                  <div className="pagination-info">
                    共 {totalResults} 条结果，第 {currentPage} 页 / 共 {finalTotalPages} 页
                  </div>
                  <div className="pagination-controls">
                    <button
                      className="page-btn"
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      上一页
                    </button>
                    
                    {/* 页码按钮 - 只显示当前页附近的页码 */}
                    {pageNumbers.map((page) => (
                      <button
                        key={page}
                        className={`page-btn ${currentPage === page ? 'active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    ))}
                    
                    {/* 显示省略号表示还有更多页 */}
                    {finalTotalPages > pageNumbers.length && currentPage < finalTotalPages && (
                      <span className="page-ellipsis">...</span>
                    )}
                    
                    <button
                      className="page-btn"
                      disabled={currentPage === finalTotalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      下一页
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
      
      {/* 评论弹窗 */}
      {showCommentModal && selectedSong && (
        <div className="modal-overlay">
          <div className="comment-modal">
            <div className="modal-header">
              <h3>快速评论</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowCommentModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-content">
              <div className="song-info">
                <img 
                  src={`https://y.qq.com/music/photo_new/T002R300x300M000${selectedSong.albummid}.jpg`} 
                  alt={selectedSong.songname} 
                  className="modal-song-image" 
                />
                <div>
                  <h4>{selectedSong.songname || '未知歌曲'}</h4>
                  <p>{selectedSong.singer?.map((artist: any) => artist.name || '未知歌手').join(', ') || '未知歌手'}</p>
                </div>
              </div>
              <div className="search-review-form">
                <div className="search-rating-row">
                  <label>歌词</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="25" 
                    placeholder="0-25" 
                    value={ratings.lyrics === 0 ? '' : ratings.lyrics}
                    onChange={(e) => {
                      let value = e.target.value;
                      // 移除前导零
                      if (value.length > 1 && value.startsWith('0')) {
                        value = value.replace(/^0+/, '');
                      }
                      // 确保是数字
                      const numValue = parseInt(value) || 0;
                      // 确保在范围内
                      const clampedValue = Math.max(0, Math.min(25, numValue));
                      handleRatingChange('lyrics', clampedValue);
                    }}
                    className="search-rating-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
                <div className="search-rating-row">
                  <label>作曲</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="25" 
                    placeholder="0-25" 
                    value={ratings.composition === 0 ? '' : ratings.composition}
                    onChange={(e) => {
                      let value = e.target.value;
                      // 移除前导零
                      if (value.length > 1 && value.startsWith('0')) {
                        value = value.replace(/^0+/, '');
                      }
                      // 确保是数字
                      const numValue = parseInt(value) || 0;
                      // 确保在范围内
                      const clampedValue = Math.max(0, Math.min(25, numValue));
                      handleRatingChange('composition', clampedValue);
                    }}
                    className="search-rating-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
                <div className="search-rating-row">
                  <label>编曲</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="25" 
                    placeholder="0-25" 
                    value={ratings.arrangement === 0 ? '' : ratings.arrangement}
                    onChange={(e) => {
                      let value = e.target.value;
                      // 移除前导零
                      if (value.length > 1 && value.startsWith('0')) {
                        value = value.replace(/^0+/, '');
                      }
                      // 确保是数字
                      const numValue = parseInt(value) || 0;
                      // 确保在范围内
                      const clampedValue = Math.max(0, Math.min(25, numValue));
                      handleRatingChange('arrangement', clampedValue);
                    }}
                    className="search-rating-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
                <div className="search-rating-row">
                  <label>演唱</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="10" 
                    placeholder="0-10" 
                    value={ratings.singing === 0 ? '' : ratings.singing}
                    onChange={(e) => {
                      let value = e.target.value;
                      // 移除前导零
                      if (value.length > 1 && value.startsWith('0')) {
                        value = value.replace(/^0+/, '');
                      }
                      // 确保是数字
                      const numValue = parseInt(value) || 0;
                      // 确保在范围内
                      const clampedValue = Math.max(0, Math.min(10, numValue));
                      handleRatingChange('singing', clampedValue);
                    }}
                    className="search-rating-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
                <div className="search-rating-row">
                  <label>创新性</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="5" 
                    placeholder="0-5" 
                    value={ratings.innovation === 0 ? '' : ratings.innovation}
                    onChange={(e) => {
                      let value = e.target.value;
                      // 移除前导零
                      if (value.length > 1 && value.startsWith('0')) {
                        value = value.replace(/^0+/, '');
                      }
                      // 确保是数字
                      const numValue = parseInt(value) || 0;
                      // 确保在范围内
                      const clampedValue = Math.max(0, Math.min(5, numValue));
                      handleRatingChange('innovation', clampedValue);
                    }}
                    className="search-rating-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
                <div className="search-rating-row">
                  <label>个人喜好</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="10" 
                    placeholder="0-10" 
                    value={ratings.preference === 0 ? '' : ratings.preference}
                    onChange={(e) => {
                      let value = e.target.value;
                      // 移除前导零
                      if (value.length > 1 && value.startsWith('0')) {
                        value = value.replace(/^0+/, '');
                      }
                      // 确保是数字
                      const numValue = parseInt(value) || 0;
                      // 确保在范围内
                      const clampedValue = Math.max(0, Math.min(10, numValue));
                      handleRatingChange('preference', clampedValue);
                    }}
                    className="search-rating-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
                <div className="search-total-score">
                  <span>总分：</span>
                  <span className="search-score-value">{totalScore} / 100</span>
                </div>
                <textarea
                  className="search-review-comment"
                  placeholder="在此写下你的评论..."
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                ></textarea>
                <button 
                  className="search-submit-review-btn"
                  onClick={handleSubmitReview}
                >
                  提交评论
                </button>
                {showSubmitSuccess && (
                  <div className="search-submit-success-toast">
                    评论提交成功！
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
