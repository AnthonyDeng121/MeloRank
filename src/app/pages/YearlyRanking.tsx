import React, { useRef, useCallback, useEffect } from "react";
import { qqMusicService } from '../services/qqMusicService';
import "../../styles/YearlyRanking.css";

import { useRankingContext, RankingItem, DEFAULT_RANKING_LIST } from '../contexts/RankingContext';
import { isDefaultRanking, normalizeRanking, parseDetailedRankingText } from '../features/ranking/rankingLogic';
import { removeRankingItem, moveRankingItemUp, moveRankingItemDown } from '../features/ranking/rankingMutations';
import { useRankingState } from '../features/ranking/useRankingState';
import { RankingModeSelector } from '../features/ranking/RankingModeSelector';
import { RankingList } from '../features/ranking/RankingList';
import { RankingDialogs } from '../features/ranking/RankingDialogs';
import { RankingExportPreview } from '../features/ranking/RankingExportPreview';
import { RankingEditor } from '../features/ranking/RankingEditor';
import { exportRankingPdf, exportRankingDocx } from '../features/ranking/rankingExportService';

interface YearlyRankingProps {
  pageType?: 'yearly-ranking' | 'yearly-songs' | 'yearly-albums';
}

export function YearlyRanking({ pageType = 'yearly-ranking' }: YearlyRankingProps) {
  // 使用RankingContext获取和更新榜单状态
  const { rankingMode, setRankingMode, rankingList, setRankingList } = useRankingContext();

  // 根据pageType设置初始榜单类型
  React.useEffect(() => {
    if (pageType === 'yearly-songs') {
      setRankingMode('年度单曲榜');
    } else if (pageType === 'yearly-albums') {
      setRankingMode('年度专辑榜');
    }
  }, [pageType, setRankingMode]);
  
  const currentYear = new Date().getFullYear();
  
  // 添加状态管理来存储上传的图片和预览URL
  
  // 添加编辑状态管理
  const rankingState = useRankingState();
  const { coverUrl, setCoverUrl, coverPreview, setCoverPreview, editMode, setEditMode, scoringMode, setScoringMode, editingItemId, setEditingItemId, showConfirmDialog, setShowConfirmDialog, showHistoryDialog, setShowHistoryDialog, historyRankings, setHistoryRankings, isSaving, setIsSaving, saveSuccess, setSaveSuccess, showImportDialog, setShowImportDialog, importedRankingText, setImportedRankingText, searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching, setIsSearching, showSearchResults, setShowSearchResults, searchError, setSearchError } = rankingState;
  
  // 添加确认对话框状态
  
  // 添加评分模式状态管理
  
  // 评分模式选项
  const scoringModes: Array<{ value: 'scoring' | 'non-scoring'; label: string }> = [
    { value: 'scoring', label: '评分' },
    { value: 'non-scoring', label: '不评分' }
  ];

  // 按当前模式统一整理榜单，避免新增、删除和导入流程各自维护排序规则。
  const normalizeCurrentRanking = (items: RankingItem[]): RankingItem[] =>
    normalizeRanking(items, scoringMode);

  // 添加保存和历史榜单相关状态

  const rankingModes = [
    '年度艺人榜',
    '年度专辑榜',
    '年度单曲榜',
    '年度MV榜'
  ];
  
  // 搜索相关状态管理

  
  // 防抖定时器引用
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  /** ====== 导出专用隐藏 DOM ====== */
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (exportRef.current) await exportRankingPdf(exportRef.current, `MeloRank_${currentYear}年度榜单.pdf`);
  };

  const handleExportDOCX = async () => {
    await exportRankingDocx(rankingList, scoringMode, `MeloRank_${currentYear}年度榜单.docx`);
  };
  
  /** ====== 分数调节 ====== */
  const integrityRef = useRef<HTMLInputElement>(null);
  const durabilityRef = useRef<HTMLInputElement>(null);
  
  /** ====== 文件上传处理 ====== */
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 处理文件上传
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        alert('请上传图片文件');
        return;
      }
      
      // 创建图片预览URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target?.result as string;
        setCoverPreview(previewUrl);
        setCoverUrl(previewUrl); // 直接使用base64作为封面URL
      };
      reader.readAsDataURL(file);
    }
  };
  
  // 触发文件选择
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };
  
  // 获取当前榜单类型对应的名称（例如：年度专辑榜 -> 专辑）
  const getCurrentRankingTypeName = () => {
    if (rankingMode.includes('艺人')) return '艺人';
    if (rankingMode.includes('专辑')) return '专辑';
    if (rankingMode.includes('单曲')) return '单曲';
    if (rankingMode.includes('MV')) return 'MV';
    return '作品';
  };

  // 组件挂载时，使用线性映射计算初始数据的分数
  React.useEffect(() => {
    const updatedList = normalizeCurrentRanking(rankingList);
    setRankingList(updatedList);
  }, []);

  // 当榜单类型或评分模式变化时，更新样例数据的标题
  React.useEffect(() => {
    // 检查是否是样例数据
    const isSampleData = isDefaultRanking(rankingList);
    
    if (isSampleData) {
      let updatedList;
      
      if (scoringMode === 'non-scoring') {
        // 不评分模式下，显示曲目1、曲目2、曲目3
        updatedList = rankingList.map(item => {
          let title = '';
          if (item.rank === 1) title = `曲目1`;
          if (item.rank === 2) title = `曲目2`;
          if (item.rank === 3) title = `曲目3`;
          return {
            ...item,
            title
          };
        });
      } else {
        // 评分模式下，保持原有逻辑
        const typeName = getCurrentRankingTypeName();
        updatedList = rankingList.map(item => {
          let title = '';
          if (item.rank === 1) title = `冠军${typeName}`;
          if (item.rank === 2) title = `亚军${typeName}`;
          if (item.rank === 3) title = `季军${typeName}`;
          return {
            ...item,
            title
          };
        });
      }
      
      setRankingList(updatedList);
    }
  }, [rankingMode, scoringMode]);

  // 恢复默认榜单的函数
  const restoreDefaultRanking = () => {
    setShowConfirmDialog(true);
  };
  
  // 确认恢复默认榜单
  const confirmRestoreDefault = () => {
    let updatedList;
    
    if (scoringMode === 'non-scoring') {
      // 不评分模式下，显示曲目1、曲目2、曲目3
      updatedList = DEFAULT_RANKING_LIST.map(item => {
        let title = '';
        if (item.rank === 1) title = `曲目1`;
        if (item.rank === 2) title = `曲目2`;
        if (item.rank === 3) title = `曲目3`;
        return {
          ...item,
          title
        };
      });
    } else {
      // 评分模式下，保持原有逻辑
      const typeName = getCurrentRankingTypeName();
      updatedList = DEFAULT_RANKING_LIST.map(item => {
        let title = '';
        if (item.rank === 1) title = `冠军${typeName}`;
        if (item.rank === 2) title = `亚军${typeName}`;
        if (item.rank === 3) title = `季军${typeName}`;
        return {
          ...item,
          title
        };
      });
    }
    
    setRankingList(normalizeCurrentRanking(updatedList));
    setShowConfirmDialog(false);
  };
  
  // 取消恢复默认榜单
  const cancelRestoreDefault = () => {
    setShowConfirmDialog(false);
  };


  
  // 处理编辑操作
  const handleEdit = (item: RankingItem) => {
    setEditMode(true);
    setEditingItemId(item.id);
    
    // 填充表单数据
    setCoverUrl(item.coverUrl);
    setCoverPreview(item.coverUrl);
    
    // 填充表单输入框
    const form = document.querySelector('form') as HTMLFormElement;
    if (form) {
      const titleInput = form.elements.namedItem('title') as HTMLInputElement;
      const artistInput = form.elements.namedItem('artist') as HTMLInputElement;
      const scoreInput = form.elements.namedItem('score') as HTMLInputElement;
      const reviewInput = form.elements.namedItem('review') as HTMLTextAreaElement;
      if (titleInput) titleInput.value = item.title;
      if (artistInput) artistInput.value = item.artist;
      if (scoreInput) scoreInput.value = item.originalScore.toString();
      if (reviewInput) reviewInput.value = item.review || '';
      
      // 设置分数调节值
      if (integrityRef.current) integrityRef.current.value = item.integrity.toFixed(1);
      if (durabilityRef.current) durabilityRef.current.value = item.durability.toFixed(1);
    }
  };
  
  // 处理删除操作
  const handleDelete = (id: string) => {
    const updatedList = removeRankingItem(rankingList, id);
    setRankingList(normalizeCurrentRanking(updatedList));
  };

  // 移动歌曲排名的函数
  const moveItemUp = (item: RankingItem) => {
    setRankingList(moveRankingItemUp(rankingList, item.id));
  };

  const moveItemDown = (item: RankingItem) => {
    setRankingList(moveRankingItemDown(rankingList, item.id));
  };
  
  // 添加一个函数来获取代理封面URL
  const getProxyCoverUrl = (originalUrl: string): string => {
    // 如果是base64或默认封面，直接返回
    if (originalUrl.startsWith('data:image/') || originalUrl.includes('svg')) {
      return originalUrl;
    }
    // 使用本地代理服务获取QQ音乐图片
    return `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/proxy/qqmusic/image?url=${encodeURIComponent(originalUrl)}`;
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 获取表单数据
    const form = e.target as HTMLFormElement;
    const title = (form.elements.namedItem('title') as HTMLInputElement)?.value || '';
    const artist = (form.elements.namedItem('artist') as HTMLInputElement)?.value || '';
    
    // 根据评分模式处理评分相关数据
    let originalScore = 0;
    let integrity = 0;
    let durability = 0;
    
    if (scoringMode === 'scoring') {
      // 解决浮点数精度问题：先转换为字符串，去除可能的小数误差，再转换为浮点数
      const rawScore = (form.elements.namedItem('score') as HTMLInputElement)?.value || '0';
      // 先转换为数字，再使用toFixed(2)处理，最后转回数字
      originalScore = parseFloat(parseFloat(rawScore).toFixed(2)) || 0;
      
      // 获取分数调节值，解决浮点数精度问题
      const integrityStr = integrityRef.current?.value || '0';
      const durabilityStr = durabilityRef.current?.value || '0';
      integrity = parseFloat(parseFloat(integrityStr).toFixed(1)) || 0;
      durability = parseFloat(parseFloat(durabilityStr).toFixed(1)) || 0;
    }
    
    const review = (form.elements.namedItem('review') as HTMLTextAreaElement)?.value || '';
    
    // 自动搜索封面图片
    let finalCoverUrl = coverUrl;
    if (title) {
      try {
        // 构建搜索查询
        const searchQuery = artist ? `${title} ${artist}` : title;
        
        // 根据当前榜单类型选择搜索类型
        let searchType: 'songs' | 'albums' | 'artists' = 'songs';
        if (rankingMode.includes('专辑')) {
          searchType = 'albums';
        } else if (rankingMode.includes('艺人')) {
          searchType = 'artists';
        } else if (rankingMode.includes('单曲')) {
          searchType = 'songs';
        } else if (rankingMode.includes('MV')) {
          searchType = 'songs'; // MV搜索API返回格式不同，暂用单曲搜索代替
        }
        
        console.log('开始自动搜索封面:', { searchQuery, searchType, title, artist });
        
        // 调用QQ音乐搜索API
        const result = await qqMusicService.searchWithType(searchQuery, 20, searchType, 1);
        
        console.log('搜索原始结果:', result);
        
        // 处理搜索结果，适配API返回格式
        const searchResult = result.response || result;
        const actualData = searchResult;
        
        console.log('处理后的搜索结果:', actualData);
        
        // 提取第一个结果的封面URL
        let firstResult = null;
        if (searchType === 'albums' && actualData.album?.list?.length > 0) {
          firstResult = actualData.album.list[0];
        } else if (searchType === 'artists' && actualData.singer?.list?.length > 0) {
          firstResult = actualData.singer.list[0];
        } else if (searchType === 'songs' && actualData.song?.list?.length > 0) {
          firstResult = actualData.song.list[0];
        }
        
        console.log('第一个结果:', firstResult);
        
        // 如果有结果，获取封面URL并使用代理
        if (firstResult) {
          let originalUrl = '';
          if (searchType === 'albums') {
            originalUrl = firstResult.albummid ? `https://y.qq.com/music/photo_new/T002R300x300M000${firstResult.albummid}.jpg` : '';
          } else if (searchType === 'artists') {
            originalUrl = firstResult.singermid ? `https://y.qq.com/music/photo_new/T001R300x300M000${firstResult.singermid}.jpg` : '';
          } else if (searchType === 'songs') {
            originalUrl = firstResult.albummid ? `https://y.qq.com/music/photo_new/T002R300x300M000${firstResult.albummid}.jpg` : '';
          }
          
          finalCoverUrl = getProxyCoverUrl(originalUrl);
          console.log('最终封面URL:', finalCoverUrl);
        }
      } catch (error) {
        console.error('自动搜索封面失败:', error);
        // 搜索失败不影响表单提交，继续使用默认封面
      }
    }
    
    let updatedList: RankingItem[];
    
    if (editMode && editingItemId) {
      // 编辑模式：更新现有项
      updatedList = rankingList.map(item => {
        if (item.id === editingItemId) {
          return {
            ...item,
            title,
            artist,
            coverUrl: finalCoverUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E",
            review,
            originalScore,
            integrity,
            durability
          };
        }
        return item;
      });
      
      // 重置编辑状态
      setEditMode(false);
      setEditingItemId(null);
    } else {
      // 添加模式：创建新的榜单项
      const newItem: RankingItem = {
        id: Date.now().toString(),
        rank: 1,
        title,
        artist,
        coverUrl: finalCoverUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E",
        review,
        originalScore,
        integrity,
        durability,
        finalScore: 0 // 初始值，后面会被重新计算
      };
      
      // 检查是否是首次提交（如果rankingList包含样例数据，清空后添加新数据）
      const isSampleData = isDefaultRanking(rankingList);
      
      updatedList = isSampleData ? [newItem] : [...rankingList, newItem];
    }
    
    setRankingList(normalizeCurrentRanking(updatedList));
    
    // 重置表单
    form.reset();
    setCoverUrl('');
    setCoverPreview('');
    
    // 重置分数调节
    if (integrityRef.current) integrityRef.current.value = '0.0';
    if (durabilityRef.current) durabilityRef.current.value = '0.0';
  };
  
  // 导入文本只负责转换为榜单条目，解析和排序规则由纯业务模块处理。
  const handleImportRanking = () => {
    const parsedItems = parseDetailedRankingText(importedRankingText);
    if (parsedItems.length > 0) {
      const importedItems: RankingItem[] = parsedItems.map((item, index) => ({
        ...item,
        id: `${Date.now()}-${index}`,
        coverUrl: DEFAULT_RANKING_LIST[0].coverUrl,
        review: '',
        finalScore: 0
      }));
      const updatedList = isDefaultRanking(rankingList)
        ? importedItems
        : [...rankingList, ...importedItems];
      setRankingList(normalizeCurrentRanking(updatedList));
    }
    setShowImportDialog(false);
    setImportedRankingText('');
  };
  // 调节分数的函数
  const adjustScore = (ref: React.RefObject<HTMLInputElement | null>, isIncrease: boolean) => {
    if (ref.current) {
      const currentValue = parseFloat(ref.current.value) || 0;
      let step = 1;
      let min = 0;
      let max = 100;
      
      // 检查是否是整体性或保值度输入框
      if (ref === integrityRef || ref === durabilityRef) {
        step = 0.5;
        min = 0;
        max = 2;
      }
      
      let newValue = isIncrease ? currentValue + step : currentValue - step;
      newValue = Math.max(min, Math.min(max, newValue));
      
      // 整体性和保值度只显示一位小数，其他分数显示两位小数
      if (ref === integrityRef || ref === durabilityRef) {
        ref.current.value = newValue.toFixed(1);
      } else {
        ref.current.value = newValue.toFixed(2);
      }
    }
  };
  
  // 处理组合按钮点击事件
  const handleAdjustButtonClick = (ref: React.RefObject<HTMLInputElement | null>, e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const halfHeight = rect.height / 2;
    
    adjustScore(ref, clickY < halfHeight);
  };
  
  // 搜索音乐的函数
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    setIsSearching(true);
    setSearchError(null);
    
    try {
      // 根据当前榜单类型选择搜索类型
      let searchType: 'songs' | 'albums' | 'artists' = 'songs';
      if (rankingMode.includes('专辑')) {
        searchType = 'albums';
      } else if (rankingMode.includes('艺人')) {
        searchType = 'artists';
      } else if (rankingMode.includes('单曲')) {
        searchType = 'songs';
      } else if (rankingMode.includes('MV')) {
        searchType = 'songs'; // MV搜索API返回格式不同，暂用单曲搜索代替
      }
      console.log('当前榜单类型:', rankingMode, '搜索类型:', searchType);
      
      // 调用QQ音乐搜索API，增加搜索结果数量到20
      const result = await qqMusicService.searchWithType(query, 20, searchType, 1);
      
      // 处理搜索结果
      let processedResults: any[] = [];
      const responseData = result.response || result;
      const actualData = responseData.data || responseData;
      
      // 只提取与搜索类型匹配的结果
      if (searchType === 'albums' && actualData.album?.list) {
        // 专辑搜索结果
        processedResults = actualData.album.list.map((album: any) => ({
          id: album.albumid,
          type: 'album',
          title: album.albumname,
          artist: album.singer?.name || '未知歌手',
          coverUrl: album.albummid ? getProxyCoverUrl(`https://y.qq.com/music/photo_new/T002R300x300M000${album.albummid}.jpg`) : '',
          albumid: album.albumid
        }));
      } else if (searchType === 'artists' && actualData.singer?.list) {
        // 艺人搜索结果
        processedResults = actualData.singer.list.map((artist: any) => ({
          id: artist.singermid,
          type: 'artist',
          title: artist.singername,
          artist: artist.singername,
          coverUrl: artist.singermid ? getProxyCoverUrl(`https://y.qq.com/music/photo_new/T001R300x300M000${artist.singermid}.jpg`) : '',
          singermid: artist.singermid
        }));
      } else if (searchType === 'songs' && actualData.song?.list) {
        // 歌曲搜索结果
        processedResults = actualData.song.list.map((song: any) => ({
          id: song.songmid,
          type: 'song',
          title: song.songname,
          artist: song.singer?.map((artist: any) => artist.name || '未知歌手').join(', ') || '未知歌手',
          album: song.albumname || '未知专辑',
          coverUrl: song.albummid ? getProxyCoverUrl(`https://y.qq.com/music/photo_new/T002R300x300M000${song.albummid}.jpg`) : '',
          songmid: song.songmid
        }));
      } else {
        // 如果没有匹配的结果类型，尝试提取所有可能的结果
        console.warn('没有匹配的搜索结果类型，尝试提取所有可能的结果', searchType, actualData);
        if (actualData.album?.list) {
          processedResults = actualData.album.list.map((album: any) => ({
            id: album.albumid,
            type: 'album',
            title: album.albumname,
            artist: album.singer?.name || '未知歌手',
            coverUrl: album.albummid ? getProxyCoverUrl(`https://y.qq.com/music/photo_new/T002R300x300M000${album.albummid}.jpg`) : '',
            albumid: album.albumid
          }));
        } else if (actualData.song?.list) {
          processedResults = actualData.song.list.map((song: any) => ({
            id: song.songmid,
            type: 'song',
            title: song.songname,
            artist: song.singer?.map((artist: any) => artist.name || '未知歌手').join(', ') || '未知歌手',
            album: song.albumname || '未知专辑',
            coverUrl: song.albummid ? getProxyCoverUrl(`https://y.qq.com/music/photo_new/T002R300x300M000${song.albummid}.jpg`) : '',
            songmid: song.songmid
          }));
        }
      }
      
      setSearchResults(processedResults);
      setShowSearchResults(processedResults.length > 0);
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchError('搜索失败，请稍后重试');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [rankingMode, getProxyCoverUrl]);
  
  // 防抖搜索函数
  const debouncedSearch = useCallback((query: string) => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    searchDebounceRef.current = setTimeout(() => {
      handleSearch(query);
    }, 300);
  }, [handleSearch]);
  
  // 监听搜索关键词变化
  useEffect(() => {
    debouncedSearch(searchQuery);
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, debouncedSearch]);
  
  // 弹出封面
  const showCoverPreview = async (coverUrl: string) => {
    try {
      // 直接显示封面预览，不再尝试自动复制
      // 降级方案：创建一个临时的图片元素，让用户手动复制
      const tempImg = document.createElement('img');
      tempImg.src = coverUrl;
      tempImg.style.position = 'fixed';
      tempImg.style.top = '50%';
      tempImg.style.left = '50%';
      tempImg.style.transform = 'translate(-50%, -50%)';
      tempImg.style.width = '300px';
      tempImg.style.height = '300px';
      tempImg.style.objectFit = 'cover';
      tempImg.style.zIndex = '9999';
      tempImg.style.border = '4px solid #667eea';
      tempImg.style.borderRadius = '12px';
      tempImg.style.cursor = 'pointer';
      tempImg.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)';
      tempImg.title = '点击复制图片到剪贴板';
      tempImg.onclick = () => {
        // 创建canvas来复制图片
        const canvas = document.createElement('canvas');
        canvas.width = tempImg.naturalWidth;
        canvas.height = tempImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(tempImg, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const item = new ClipboardItem({ 'image/png': blob });
              navigator.clipboard.write([item]).then(() => {
                document.body.removeChild(tempImg);
                document.body.removeChild(closeBtn);
                alert('封面已复制到剪贴板');
              }).catch(() => {
                // 再次降级，使用传统方法
                try {
                  // 移除不支持的select方法
                  document.body.removeChild(tempImg);
                  document.body.removeChild(closeBtn);
                  alert('复制封面失败，请手动保存图片');
                } catch (error) {
                  console.error('复制封面失败:', error);
                  alert('复制封面失败，请手动保存图片');
                }
              });
            }
          });
        }
      };
      
      // 添加关闭按钮
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.style.position = 'fixed';
      closeBtn.style.top = 'calc(50% - 180px)';
      closeBtn.style.left = 'calc(50% + 130px)';
      closeBtn.style.width = '30px';
      closeBtn.style.height = '30px';
      closeBtn.style.border = 'none';
      closeBtn.style.borderRadius = '50%';
      closeBtn.style.backgroundColor = '#ff4d4f';
      closeBtn.style.color = 'white';
      closeBtn.style.fontSize = '20px';
      closeBtn.style.fontWeight = 'bold';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.zIndex = '10000';
      closeBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      closeBtn.onclick = () => {
        document.body.removeChild(tempImg);
        document.body.removeChild(closeBtn);
      };
      
      document.body.appendChild(tempImg);
      document.body.appendChild(closeBtn);
    } catch (error) {
      console.error('弹出封面失败:', error);
      alert('弹出封面失败，请稍后重试');
    }
  };

  // 处理搜索结果点击
  const handleSearchResultClick = (result: any) => {
    // 填充表单数据，使用代理URL
    const proxiedCoverUrl = getProxyCoverUrl(result.coverUrl);
    setCoverUrl(proxiedCoverUrl);
    setCoverPreview(proxiedCoverUrl);
    
    // 填充表单输入框
    const form = document.querySelector('form') as HTMLFormElement;
    if (form) {
      const titleInput = form.elements.namedItem('title') as HTMLInputElement;
      const artistInput = form.elements.namedItem('artist') as HTMLInputElement;
      
      if (titleInput) titleInput.value = result.title;
      if (artistInput) artistInput.value = result.artist;
    }
    
    // 关闭搜索结果
    setShowSearchResults(false);
    setSearchQuery('');
  };
  
  // 关闭搜索结果
  const closeSearchResults = () => {
    setShowSearchResults(false);
  };
  
  // 点击页面其他地方关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer && !searchContainer.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 保存榜单到本地存储
  const saveRanking = () => {
    try {
      setIsSaving(true);
      setSaveSuccess(false);
      
      // 准备要保存的数据
      const rankingData = {
        id: `ranking_${Date.now()}`, // 添加唯一ID
        year: currentYear,
        type: rankingMode,
        scoringMode,
        rankingList,
        createdAt: new Date().toISOString()
      };
      
      // 从本地存储获取现有数据
      const existingRankings = localStorage.getItem('yearlyRankings');
      let rankings = existingRankings ? JSON.parse(existingRankings) : [];
      
      // 添加新的榜单数据
      rankings.push(rankingData);
      
      // 保存回本地存储
      localStorage.setItem('yearlyRankings', JSON.stringify(rankings));
      
      // 显示保存成功提示
      setSaveSuccess(true);
      
      // 3秒后隐藏成功提示
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('保存榜单失败:', error);
      alert('保存榜单失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };
  


  // 获取历史榜单记录
  const fetchHistoryRankings = () => {
    try {
      setIsSaving(true);
      
      // 从本地存储获取历史榜单数据
      const existingRankings = localStorage.getItem('yearlyRankings');
      const yearlyRankings = existingRankings ? JSON.parse(existingRankings) : [];
      console.log('从本地存储获取的历史榜单数据:', yearlyRankings);
      
      // 更新历史榜单状态
      setHistoryRankings(yearlyRankings || []);
      
      // 显示历史榜单对话框
      setShowHistoryDialog(true);
    } catch (error) {
      console.error('获取历史榜单失败:', error);
      alert('获取历史榜单失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 加载历史榜单到当前编辑
  const loadHistoryRanking = (ranking: any) => {
    // 更新当前榜单状态
    setRankingMode(ranking.type);
    setScoringMode(ranking.scoringMode);
    setRankingList(ranking.rankingList);
    
    // 关闭历史榜单对话框
    setShowHistoryDialog(false);
  };

  // 删除历史榜单
  const deleteHistoryRanking = (rankingId: string | number) => {
    try {
      // 从本地存储获取现有数据
      const existingRankings = localStorage.getItem('yearlyRankings');
      let rankings = existingRankings ? JSON.parse(existingRankings) : [];
      
      // 过滤掉要删除的榜单
      if (typeof rankingId === 'string') {
        // 如果有唯一ID，使用ID过滤
        rankings = rankings.filter((item: any) => item.id !== rankingId);
      } else {
        // 否则使用索引过滤（兼容旧数据）
        rankings.splice(rankingId, 1);
      }
      
      // 保存回本地存储
      localStorage.setItem('yearlyRankings', JSON.stringify(rankings));
      
      // 更新状态
      setHistoryRankings(rankings);
      
      console.log('删除历史榜单成功，剩余榜单数量:', rankings.length);
    } catch (error) {
      console.error('删除历史榜单失败:', error);
      alert('删除历史榜单失败，请稍后重试');
    }
  };

  // 关闭历史榜单对话框
  const closeHistoryDialog = () => {
    setShowHistoryDialog(false);
  };
  
  // 格式化分数显示：10.0显示为10，0.0显示为0，其他保持原样
  const formatScore = (score: number): string => {
    if (score === 10.0) return '10';
    if (score === 0.0) return '0';
    return score.toFixed(1);
  };

  return (
    <div className="yearly-ranking-page">
      <h2>MeloRank · {currentYear} 年度榜单</h2>
      <p className="platform-position">音乐评分与榜单平台</p>

      <RankingModeSelector
        rankingMode={rankingMode}
        rankingModes={rankingModes}
        scoringMode={scoringMode}
        scoringModes={scoringModes}
        onRankingModeChange={setRankingMode}
        onScoringModeChange={setScoringMode}
        onImport={() => setShowImportDialog(true)}
      />

      <div className="ranking-container">
        <RankingEditor
          rankingMode={rankingMode}
          scoringMode={scoringMode}
          editMode={editMode}
          coverUrl={coverUrl}
          coverPreview={coverPreview}
          searchQuery={searchQuery}
          searchResults={showSearchResults ? searchResults : []}
          isSearching={isSearching}
          searchError={searchError}
          integrityRef={integrityRef}
          durabilityRef={durabilityRef}
          fileInputRef={fileInputRef}
          onSubmit={handleSubmit}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setShowSearchResults(true);
          }}
          onSearchFocus={() => {
            if (searchResults.length > 0) setShowSearchResults(true);
          }}
          onSearchResultClick={handleSearchResultClick}
          onCoverPreview={showCoverPreview}
          onCoverChange={(value) => {
            setCoverUrl(value);
            setCoverPreview(value);
          }}
          onCoverPaste={(event) => {
            const imageItem = Array.from(event.clipboardData.items).find(item => item.type.startsWith('image/'));
            const file = imageItem?.getAsFile();
            if (!file) return;
            const reader = new FileReader();
            reader.onload = loadEvent => {
              const value = loadEvent.target?.result as string;
              setCoverUrl(value);
              setCoverPreview(value);
            };
            reader.readAsDataURL(file);
            event.preventDefault();
          }}
          onFileUpload={handleFileUpload}
          onSelectFile={triggerFileSelect}
          onAdjustScore={adjustScore}
        />

        <div className="ranking-display">
          <div className="ranking-display-header">
            <div className="ranking-title-with-restore">
              <h3>{currentYear} {rankingMode}</h3>
              <button className="restore-btn" onClick={restoreDefaultRanking}>恢复默认榜单</button>
            </div>
            <div className="export-buttons">
              <button className="export-btn" onClick={saveRanking} disabled={isSaving}>
                {isSaving ? '保存中...' : '保存榜单'}
              </button>
              <button className="export-btn" onClick={fetchHistoryRankings} disabled={isSaving}>历史榜单记录</button>
              <button className="export-btn" onClick={handleExportPDF}>导出 PDF</button>
              <button className="export-btn" onClick={handleExportDOCX}>导出 DOCX</button>
            </div>
          </div>

          <RankingList
            items={rankingList}
            mode={scoringMode}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onMoveUp={moveItemUp}
            onMoveDown={moveItemDown}
          />
        </div>
      </div>

      <RankingExportPreview ref={exportRef} items={rankingList} mode={scoringMode} formatScore={formatScore} />
      <RankingDialogs
        showRestore={showConfirmDialog}
        showHistory={showHistoryDialog}
        showImport={showImportDialog}
        history={historyRankings}
        importText={importedRankingText}
        onRestore={confirmRestoreDefault}
        onCancelRestore={cancelRestoreDefault}
        onCloseHistory={closeHistoryDialog}
        onLoadHistory={loadHistoryRanking}
        onDeleteHistory={deleteHistoryRanking}
        onImportTextChange={setImportedRankingText}
        onImport={handleImportRanking}
        onCloseImport={() => {
          setShowImportDialog(false);
          setImportedRankingText('');
        }}
      />

      {saveSuccess && <div className="save-success-toast">榜单保存成功！</div>}
    </div>
  );
}
