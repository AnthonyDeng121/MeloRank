import React, { useRef, useCallback, useEffect } from "react";
import { qqMusicService } from '../services/qqMusicService';
import "../../styles/YearlyRanking.css";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, ImageRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, TextRun, WidthType } from "docx";
import { saveAs } from "file-saver";

import { useRankingContext, RankingItem, DEFAULT_RANKING_LIST } from '../contexts/RankingContext';
import { calculateLinearScores as calculateRankingScores, sortRankingTitles, isDefaultRanking, normalizeRanking, parseDetailedRankingText } from '../features/ranking/rankingLogic';
import { removeRankingItem, moveRankingItemUp, moveRankingItemDown } from '../features/ranking/rankingMutations';
import { useRankingState } from '../features/ranking/useRankingState';
import { RankingModeSelector } from '../features/ranking/RankingModeSelector';
import { RankingList } from '../features/ranking/RankingList';
import { RankingDialogs } from '../features/ranking/RankingDialogs';
import { RankingExportPreview } from '../features/ranking/RankingExportPreview';
import { RankingEditor } from '../features/ranking/RankingEditor';

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
  const { coverUrl, setCoverUrl, coverPreview, setCoverPreview, editMode, setEditMode, scoringMode, setScoringMode, editingItemId, setEditingItemId, editingItem, setEditingItem, showConfirmDialog, setShowConfirmDialog, showHistoryDialog, setShowHistoryDialog, historyRankings, setHistoryRankings, isSaving, setIsSaving, saveSuccess, setSaveSuccess, showImportDialog, setShowImportDialog, importedRankingText, setImportedRankingText, searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching, setIsSearching, showSearchResults, setShowSearchResults, searchError, setSearchError } = rankingState;
  
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
    const updatedList = calculateRankingScores(rankingList);
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
  
  // 自定义排序函数：实现中英文混排，按首字母ASCII顺序，相同时短的靠前
  const customSort = (a: string, b: string): number => sortRankingTitles(a, b);
  /*
    // 转换为小写进行比较，确保大小写不影响排序
    const strA = a.toLowerCase();
    const strB = b.toLowerCase();
    
    // 检查是否为英文（只包含a-z和基本符号）
    const isEnglishA = /^[a-z0-9\s\-\_\.\,\!\?\'\"\(\)\[\]\{\}\:\;]+$/.test(strA);
    const isEnglishB = /^[a-z0-9\s\-\_\.\,\!\?\'\"\(\)\[\]\{\}\:\;]+$/.test(strB);
    
    // 英文总是排在中文前面
    if (isEnglishA && !isEnglishB) {
      return -1;
    }
    if (!isEnglishA && isEnglishB) {
      return 1;
    }
    
    // 都是英文或都是中文，使用localeCompare排序
    const localeResult = strA.localeCompare(strB, isEnglishA ? 'en-US' : 'zh-CN-u-co-pinyin', { 
      numeric: true, 
      sensitivity: 'base',
      caseFirst: 'upper' // 大写字母优先
    });
    
    // 如果localeCompare结果为0（首字母相同），则比较长度，短的靠前
    if (localeResult === 0) {
      return a.length - b.length;
    }
    
    return localeResult;
  }; */

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
    
    let listToUpdate: RankingItem[];
    
    // 根据评分模式处理列表
    if (scoringMode === 'scoring') {
      // 使用线性映射计算初始数据的分数
      listToUpdate = calculateRankingScores(updatedList);
    } else {
      // 不评分模式下，使用自定义排序
      listToUpdate = [...updatedList].sort((a, b) => {
        return sortRankingTitles(a.title, b.title);
      }).map((item, index) => ({
        ...item,
        rank: index + 1 // 更新排名
      }));
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
    setEditingItem(item);
    
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
      const coverUrlInput = form.elements.namedItem('coverUrl') as HTMLInputElement;
      
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
    let listToUpdate: RankingItem[];
    
    // 根据评分模式处理列表
    if (scoringMode === 'scoring') {
      // 使用线性映射重新计算所有项目的分数
      listToUpdate = calculateRankingScores(updatedList);
    } else {
      // 不评分模式下，使用自定义排序
      listToUpdate = [...updatedList].sort((a, b) => {
        return sortRankingTitles(a.title, b.title);
      }).map((item, index) => ({
        ...item,
        rank: index + 1 // 更新排名
      }));
    }
    
    setRankingList(listToUpdate);
  };

  // 移动歌曲排名的函数
  const moveItemUp = (item: RankingItem) => {
    setRankingList(moveRankingItemUp(rankingList, item.id));
    // 旧实现已移至 rankingMutations.ts
    /*
      // 交换位置
      [updatedList[index], updatedList[index - 1]] = [updatedList[index - 1], updatedList[index]];
      // 更新排名
      const reorderedList = updatedList.map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
      setRankingList(reorderedList);
    */
  };

  const moveItemDown = (item: RankingItem) => {
    setRankingList(moveRankingItemDown(rankingList, item.id));
    /*
      // 交换位置
      [updatedList[index], updatedList[index + 1]] = [updatedList[index + 1], updatedList[index]];
      // 更新排名
      const reorderedList = updatedList.map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
      setRankingList(reorderedList);
    */
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
      setEditingItem(null);
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
      const isSampleData = rankingList.length === 3 && rankingList.every(item => 
        item.id === '1' || item.id === '2' || item.id === '3'
      );
      
      updatedList = isSampleData ? [newItem] : [...rankingList, newItem];
    }
    
    let listToUpdate: RankingItem[];
    
    // 根据评分模式处理列表
    if (scoringMode === 'scoring') {
      // 使用线性映射重新计算所有项目的分数
      listToUpdate = calculateRankingScores(updatedList);
    } else {
      // 不评分模式下，使用自定义排序
      listToUpdate = [...updatedList].sort((a, b) => {
        return sortRankingTitles(a.title, b.title);
      }).map((item, index) => ({
        ...item,
        rank: index + 1 // 更新排名
      }));
    }
    
    // 更新榜单列表
    setRankingList(listToUpdate);
    
    // 重置表单
    form.reset();
    setCoverUrl('');
    setCoverPreview('');
    
    // 重置分数调节
    if (integrityRef.current) integrityRef.current.value = '0.0';
    if (durabilityRef.current) durabilityRef.current.value = '0.0';
  };
  
  // 处理导入排行榜的函数
  const handleImportRanking = () => {
    if (!importedRankingText.trim()) {
      setShowImportDialog(false);
      setImportedRankingText('');
      return;
    }

    // 解析粘贴的文本
    const lines = importedRankingText.split('\n').filter(line => line.trim());
    const importedItems: RankingItem[] = [];

    lines.forEach(line => {
      let processedLine = line.trim();
      if (!processedLine) return;

      // 第一步：先去掉日期部分
      let mainContent = processedLine;
      
      // 识别并移除日期部分，支持多种日期格式
      // 1. 月.日格式 (如：1.1, 12.31)
      const datePattern1 = /^\d{1,2}\.\d{1,2}\s+/;
      // 2. 年-月-日格式 (如：2024-01-01, 24-1-1)
      const datePattern2 = /^\d{2,4}-\d{1,2}-\d{1,2}\s+/;
      // 3. 月/日格式 (如：1/1, 12/31)
      const datePattern3 = /^\d{1,2}\/\d{1,2}\s+/;
      // 4. 中文日期格式 (如：1月1日, 12月31日)
      const datePattern4 = /^\d{1,2}月\d{1,2}日\s+/;
      
      // 依次检查并移除各种日期格式
      if (datePattern1.test(mainContent)) {
        mainContent = mainContent.replace(datePattern1, '').trim();
      } else if (datePattern2.test(mainContent)) {
        mainContent = mainContent.replace(datePattern2, '').trim();
      } else if (datePattern3.test(mainContent)) {
        mainContent = mainContent.replace(datePattern3, '').trim();
      } else if (datePattern4.test(mainContent)) {
        mainContent = mainContent.replace(datePattern4, '').trim();
      }
      
      // 第二步：去除行首的序号和点
      mainContent = mainContent.replace(/^\d+\s*\.\s*/, '').trim();
      if (!mainContent) return;

      // 使用" - "作为分隔符提取作品名和作者名
      const separatorIndex = mainContent.indexOf(' - ');
      if (separatorIndex === -1) return;

      const title = mainContent.substring(0, separatorIndex).trim();
      const artistAndScore = mainContent.substring(separatorIndex + 3).trim();
      
      // 提取评分信息（如果有）
      const scoreMatch = artistAndScore.match(/(\d+(?:\.\d+)?)(?:\s*\+\s*(\d+(?:\.\d+)?))?(?:\s*\+\+\s*(\d+(?:\.\d+)?))?/);
      
      // 提取作者名（如果有评分，作者名是评分前的部分；否则是整个字符串）
      let artist = artistAndScore;
      let originalScore = 0;
      let integrity = 0;
      let durability = 0;

      if (scoreMatch) {
        // 提取作者名（评分前的部分）
        const scoreStartIndex = artistAndScore.indexOf(scoreMatch[0]);
        artist = artistAndScore.substring(0, scoreStartIndex).trim();
        
        // 提取评分信息，支持可选的评分项
        originalScore = parseFloat(scoreMatch[1]) || 0;
        integrity = parseFloat(scoreMatch[2]) || 0;
        durability = parseFloat(scoreMatch[3]) || 0;
      }

      // 创建新的排行榜项目
      const newItem: RankingItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        rank: 1,
        title: title.trim(),
        artist: artist.trim(),
        coverUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E",
        review: '',
        originalScore,
        integrity,
        durability,
        finalScore: 0 // 初始值，后面会被重新计算
      };

      importedItems.push(newItem);
    });

    if (importedItems.length > 0) {
      // 检查是否是首次提交（如果rankingList包含样例数据，清空后添加新数据）
      const isSampleData = rankingList.length === 3 && rankingList.every(item => 
        item.id === '1' || item.id === '2' || item.id === '3'
      );

      let updatedList: RankingItem[];
      if (isSampleData) {
        updatedList = importedItems;
      } else {
        updatedList = [...rankingList, ...importedItems];
      }

      // 根据评分模式处理列表
      let listToUpdate: RankingItem[];
      if (scoringMode === 'scoring') {
        // 使用线性映射重新计算所有项目的分数
        listToUpdate = calculateRankingScores(updatedList);
      } else {
        // 不评分模式下，使用自定义排序
        listToUpdate = [...updatedList].sort((a, b) => {
          return sortRankingTitles(a.title, b.title);
        }).map((item, index) => ({
          ...item,
          rank: index + 1 // 更新排名
        }));
      }

      // 更新榜单列表
      setRankingList(listToUpdate);
    }

    // 关闭对话框并清空输入
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

  // 计算线性映射十分制分数
  const calculateLinearScores = (items: RankingItem[]): RankingItem[] => calculateRankingScores(items);
  /*
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
        // 明确保留原始的originalScore，避免任何可能的修改
        id: item.id,
        rank: index + 1,
        title: item.title,
        artist: item.artist,
        coverUrl: item.coverUrl,
        review: item.review,
        originalScore: item.originalScore, // 明确保留原始评分
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
        // 明确保留原始的originalScore，避免任何可能的修改
        id: item.id,
        rank: index + 1,
        title: item.title,
        artist: item.artist,
        coverUrl: item.coverUrl,
        review: item.review,
        originalScore: item.originalScore, // 明确保留原始评分
        integrity: item.integrity,
        durability: item.durability,
        finalScore: parseFloat(normalizedScore.toFixed(1)),
        totalScore: item.totalScore
      };
    });
  }; */

  const captureExportImage = async (): Promise<string> => {
    if (!exportRef.current) {
      throw new Error("导出区域不存在");
    }

    const canvas = await html2canvas(exportRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    return canvas.toDataURL("image/jpeg", 1.0);
  };

  /** ====== PDF ====== */
  const exportPDF = async () => {
    // 在生成PDF之前，先重新计算所有项目的分数，确保finalScore是最新的
    const updatedList = calculateRankingScores(rankingList);
    setRankingList(updatedList);
    
    // 等待DOM更新后再捕获图片
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const img = await captureExportImage();
    const pdf = new jsPDF("p", "mm", "a4");

    const w = pdf.internal.pageSize.getWidth();
    const props = pdf.getImageProperties(img);
    const h = (props.height * w) / props.width;

    pdf.addImage(img, "JPEG", 0, 0, w, h);
    pdf.save(`MeloRank_${currentYear}年度榜单.pdf`);
  };

  /** ====== Word ====== */
  const exportDOCX = async () => {
    const currentYear = new Date().getFullYear();
    
    // 根据评分模式准备不同的数据
    let rankingData;
    let tableData;
    
    // 函数：将图片URL转换为二进制数据和类型
    const getImageData = async (url: string) => {
      try {
        console.log('Processing image URL:', url);
        
        // 如果是data URL，直接转换
        if (url.startsWith('data:')) {
          console.log('Processing data URL');
          // 解析data URL获取类型和base64数据
          const matches = url.match(/^data:(image\/(png|jpeg|jpg|gif|bmp));base64,(.*)$/i);
          if (matches && matches.length >= 4) {
            const mimeType = matches[1];
            let matchedType = matches[2].toLowerCase();
            // 确保类型是合法的ImageRun类型
            let type: "png" | "jpg" | "gif" | "bmp" = "png";
            if (matchedType === 'jpeg' || matchedType === 'jpg') {
              type = "jpg";
            } else if (matchedType === 'png') {
              type = "png";
            } else if (matchedType === 'gif') {
              type = "gif";
            } else if (matchedType === 'bmp') {
              type = "bmp";
            }
            const base64 = matches[3];
            // 将base64转换为二进制数据
            const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            console.log('Data URL converted to binary, length:', binary.length, 'type:', type);
            return { binary, type };
          } else {
            // 处理不匹配的data URL，默认使用png
            const base64 = url.split(',')[1];
            const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            console.log('Data URL converted to binary (default type: png), length:', binary.length);
            return { binary, type: 'png' };
          }
        }
        
        // 确保URL格式正确
        let imageUrl = url;
        
        // 如果不是代理URL，使用代理服务
        if (!imageUrl.includes('/api/proxy/qqmusic/image')) {
          imageUrl = getProxyCoverUrl(imageUrl);
          console.log('Using proxy URL for image:', imageUrl);
        }
        
        // 添加默认协议（如果没有）
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          imageUrl = `https://${imageUrl}`;
          console.log('Added https protocol:', imageUrl);
        }
        
        // 使用fetch获取图片，直接转换为二进制数据
        console.log('Using fetch to get image:', imageUrl);
        const response = await fetch(imageUrl, {
          mode: 'cors',
          referrerPolicy: 'no-referrer'
        });
        
        if (!response.ok) {
          console.error('Image fetch failed with status:', response.status);
          // 如果fetch失败，尝试使用canvas方法
          return new Promise<{ binary: Uint8Array; type: string }>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  console.error('Failed to get canvas context');
                  resolve({ binary: new Uint8Array(0), type: 'png' });
                  return;
                }
                
                ctx.drawImage(img, 0, 0);
                
                // 转换为blob，然后转换为Uint8Array
                canvas.toBlob((blob) => {
                  if (!blob) {
                    console.error('Failed to create blob from canvas');
                    resolve({ binary: new Uint8Array(0), type: 'png' });
                    return;
                  }
                  
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const binary = new Uint8Array(arrayBuffer);
                    console.log('Canvas converted to binary, length:', binary.length);
                    resolve({ binary, type: 'png' });
                  };
                  reader.onerror = () => {
                    console.error('Failed to read blob');
                    resolve({ binary: new Uint8Array(0), type: 'png' });
                  };
                  reader.readAsArrayBuffer(blob);
                }, 'image/png');
              } catch (error) {
                console.error('Error in canvas processing:', error);
                resolve({ binary: new Uint8Array(0), type: 'png' });
              }
            };
            
            img.onerror = (error) => {
              console.error('Image failed to load:', error, imageUrl);
              resolve({ binary: new Uint8Array(0), type: 'png' });
            };
            
            img.src = imageUrl;
          });
        }
        
        // 直接获取blob并转换为Uint8Array
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const binary = new Uint8Array(arrayBuffer);
        // 获取图片类型，确保是合法的ImageRun类型
            const contentType = blob.type;
            let type: "png" | "jpg" | "gif" | "bmp" = "png";
            if (contentType.includes('jpeg') || contentType.includes('jpg')) {
              type = "jpg";
            } else if (contentType.includes('png')) {
              type = "png";
            } else if (contentType.includes('gif')) {
              type = "gif";
            } else if (contentType.includes('bmp')) {
              type = "bmp";
            }
        console.log('Fetch converted to binary, length:', binary.length, 'type:', type);
        return { binary, type };
      } catch (error) {
        console.error('Error in getImageData:', error, url);
        // 返回一个默认的空图片
        return { binary: new Uint8Array(0), type: 'png' };
      }
    };

    if (scoringMode === 'scoring') {
      // 评分模式下的逻辑
      // 在生成DOCX之前，先重新计算所有项目的分数，确保finalScore是最新的
      const updatedList = calculateRankingScores(rankingList);
      // 使用更新后的列表数据
      rankingData = updatedList;

      // 准备两张图片的本地路径
      // 图片1：红色圆圈带箭头
      const redCircleWithArrow = '/images/red-circle-with-arrow.png';
      
      // 图片2：黑色圆圈
      const blackCircle = '/images/black-circle.png';

      // 函数：加载图片并在上面绘制分数
      const generateScoreImage = async (score: number, isRed: boolean) => {
        return new Promise<string>((resolve) => {
          // 根据是否为红色圆圈设置不同的画布尺寸
          const canvasWidth = isRed ? 250 : 142;
          const canvasHeight = isRed ? 250 : 142;
          
          const canvas = document.createElement('canvas');
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve('');
            return;
          }
          
          // 创建图片对象
          const img = new Image();
          // 设置跨域支持
          img.crossOrigin = 'anonymous';
          
          // 根据是否为红色圆圈选择图片
          img.src = isRed ? redCircleWithArrow : blackCircle;
          
          img.onload = () => {
            // 绘制图片
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // 统一字体大小为68px
            const fontSize = isRed ?  'bold 90px Times New Roman': 'bold 60px Times New Roman';
            
            // 绘制分数
            ctx.fillStyle = isRed ? '#FF0000' : '#000000';
            ctx.font = fontSize;
            ctx.textAlign = 'center';
            
            // 红色分数向下一点，黑色分数居中
            if (isRed) {
              ctx.textBaseline = 'bottom';
              // 向下调整位置，距离底部20px
              ctx.fillText(formatScore(score), canvas.width / 2, canvas.height - 55);
            } else {
              ctx.textBaseline = 'middle';
              ctx.fillText(formatScore(score), canvas.width / 2, canvas.height / 2);
            }
            
            // 转换为base64
            resolve(canvas.toDataURL('image/png'));
          };
          
          img.onerror = () => {
            // 图片加载失败时，绘制默认样式
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 绘制圆圈
            const radius = isRed ? 80 : 65;
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
            ctx.strokeStyle = isRed ? '#FF0000' : '#000000';
            ctx.lineWidth = 8;
            ctx.stroke();
            
            // 统一字体大小为68px
            const fontSize =isRed ?  'bold 80px Times New Roman': 'bold 50px Times New Roman';
            
            // 绘制分数
            ctx.fillStyle = isRed ? '#FF0000' : '#000000';
            ctx.font = fontSize;
            ctx.textAlign = 'center';
            
            // 红色分数向下一点，黑色分数居中
            if (isRed) {
              ctx.textBaseline = 'bottom';
              // 向下调整位置，距离底部20px
              ctx.fillText(formatScore(score), canvas.width / 2, canvas.height - 20);
            } else {
              ctx.textBaseline = 'middle';
              ctx.fillText(formatScore(score), canvas.width / 2, canvas.height / 2);
            }
            
            resolve(canvas.toDataURL('image/png'));
          };
        });
      };

      // 准备表格数据，包括图片二进制和类型
      tableData = await Promise.all(
        rankingData.map(async item => {
          // 生成包含分数的图片
          const isRed = item.durability === 2;
          const scoreImageUrl = await generateScoreImage(item.finalScore, isRed);
          
          // 获取封面图片数据
          const coverData = await getImageData(item.coverUrl);
          // 获取分数图片数据
          const scoreImageData = await getImageData(scoreImageUrl);
          
          return {
            ...item,
            coverBinary: coverData.binary,
            coverType: coverData.type,
            scoreImageBinary: scoreImageData.binary,
            scoreImageType: scoreImageData.type
          };
        })
      );
    } else {
      // 非评分模式下的逻辑
      // 不评分模式下，使用自定义排序
      const sortedList = [...rankingList].sort((a, b) => {
        return sortRankingTitles(a.title, b.title);
      }).map((item, index) => ({
        ...item,
        rank: index + 1 // 更新排名
      }));
      rankingData = sortedList;

      // 准备表格数据，包括图片二进制和类型
      tableData = await Promise.all(
        rankingData.map(async item => {
          // 获取封面图片数据
          const coverData = await getImageData(item.coverUrl);
          
          return {
            ...item,
            coverBinary: coverData.binary,
            coverType: coverData.type,
            scoreImageBinary: new Uint8Array(0), // 添加空的scoreImageBinary属性，确保类型一致
            scoreImageType: 'png' // 添加默认类型，确保类型一致
          };
        })
      );
    }

    // 创建文档
    const doc = new Document({
      sections: [
        {
          children: [
            // 根据评分模式创建不同的表格
            scoringMode === 'scoring' ? 
            // 评分模式：3列表格
            new Table({
              rows: [
                // 表头行
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "封面",
                              bold: true,
                              size: 24, // 小四 (12pt = 24)
                              font: "仿宋",
                              color: "FFFFFF", // 白字
                            })
                          ],
                          alignment: AlignmentType.CENTER,
                          shading: { fill: "000000" }, // 黑底
                        })
                      ],
                      width: {
                        size: 3800, // 4cm ≈ 4536缇
                        type: WidthType.DXA
                      },
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" }, // 右侧边框改为白色
                      }
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "详情",
                              bold: true,
                              size: 24, // 小四 (12pt = 24)
                              font: "仿宋",
                              color: "FFFFFF", // 白字
                            })
                          ],
                          alignment: AlignmentType.CENTER,
                          shading: { fill: "000000" }, // 黑底
                        })
                      ],
                      width: {
                        size: 6200, // 5cm ≈ 5670缇
                        type: WidthType.DXA
                      },
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" }, // 左侧边框改为白色
                        right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" }, // 右侧边框改为白色
                      }
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "评分",
                              bold: true,
                              size: 24, // 小四 (12pt = 24)
                              font: "仿宋",
                              color: "FFFFFF", // 白字
                            })
                          ],
                          alignment: AlignmentType.CENTER,
                          shading: { fill: "000000" }, // 黑底
                        })
                      ],
                      width: {
                        size: 5000, // 5cm ≈ 5670缇
                        type: WidthType.DXA
                      },
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" }, // 左侧边框改为白色
                        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                      }
                    }),
                  ],
                }),
                // 遍历数据，创建排名行
                ...tableData.flatMap((item) => [
                  // 第一行：排名+专辑/单曲名+艺人名
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: `NO.${item.rank} `,
                                bold: true,
                                size: 24, // 小四 (12pt = 24)
                                font: "Times New Roman",
                              }),
                              new TextRun({
                                text: `${item.title} - ${item.artist}`,
                                bold: false,
                                size: 24, // 小四 (12pt = 24)
                                font: "Times New Roman",
                              })
                            ],
                            alignment: AlignmentType.CENTER,
                          })
                        ],
                        // 合并三列
                        columnSpan: 3,
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        }
                      })
                    ]
                  }),
                  // 第二行：封面+详情（嵌套表格）+评分
                  new TableRow({
                    children: [
                      // 封面列
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new ImageRun({
                                 type: (item.coverType as "png" | "jpg" | "gif" | "bmp") || "png",
                                 data: item.coverBinary,
                                 transformation: {
                                   width: 142, // 5cm ≈ 142像素
                                   height: 142,
                                 },
                               })
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: {
                              before: 0, // 图片上方间距，进一步减小距离
                              after: 0, // 图片下方间距，进一步减小距离
                              line: 1, // 行间距，进一步减小距离
                              lineRule: "atLeast"
                            }
                          })
                        ],
                        width: {
                          size: 4536, // 4cm ≈ 4536缇
                          type: WidthType.DXA
                        },
                        verticalAlign: AlignmentType.CENTER,
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        },
                        margins: {
                          top: 0, // 单元格顶部边距，进一步减小距离
                          bottom: 0, // 单元格底部边距，进一步减小距离
                          left: 0, // 单元格左侧边距，进一步减小距离
                          right: 0, // 单元格右侧边距，进一步减小距离
                        }
                      }),
                      // 详情列：使用嵌套表格分隔评分信息和评论
                      new TableCell({
                        children: [
                          new Table({
                            rows: [
                              // 嵌套表格第一行：原始分数/整体性/保值度
                              new TableRow({
                                children: [
                                  new TableCell({
                                    children: [
                                      new Paragraph({
                                        children: [
                                          new TextRun({
                                            text: `原始分数：${item.originalScore}`,
                                            size: 22, // 11pt = 22
                                            font: "仿宋",
                                          })
                                        ],
                                        alignment: AlignmentType.CENTER,
                                        spacing: {
                                          before: 50, // 段落上方间距
                                          after: 50 // 段落下方间距
                                        }
                                      }),
                                      new Paragraph({
                                        children: [
                                          new TextRun({
                                            text: `整体性：${item.integrity > 0 ? '+' + item.integrity.toFixed(1) : '0'}`,
                                            size: 22, // 11pt = 22
                                            font: "仿宋",
                                          })
                                        ],
                                        alignment: AlignmentType.CENTER,
                                        spacing: {
                                          before: 50, // 段落上方间距
                                          after: 50 // 段落下方间距
                                        }
                                      }),
                                      new Paragraph({
                                        children: [
                                          new TextRun({
                                            text: `保值度：${item.durability > 0 ? '+' + item.durability.toFixed(1) : '0'}`,
                                            size: 22, // 11pt = 22
                                            font: "仿宋",
                                          })
                                        ],
                                        alignment: AlignmentType.CENTER,
                                        spacing: {
                                          before: 50, // 段落上方间距
                                          after: 50 // 段落下方间距
                                        }
                                      })
                                    ],
                                    borders: {
                                      top: { style: BorderStyle.NONE, size: 0, color: "000000" },
                                      bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                                      left: { style: BorderStyle.NONE, size: 0, color: "000000" },
                                      right: { style: BorderStyle.NONE, size: 0, color: "000000" },
                                    }
                                  })
                                ]
                              }),
                              // 嵌套表格第二行：评论
                              new TableRow({
                                children: [
                                  new TableCell({
                                    children: [
                                      new Paragraph({
                                        children: [
                                          new TextRun({
                                            text: item.review || '没有评价的义务！',
                                            size: 22, // 11pt = 22
                                            font: "仿宋",
                                          })
                                        ],
                                        alignment: AlignmentType.CENTER,
                                        spacing: { after: 100, before: 100 }
                                      })
                                    ],
                                    borders: {
                                      top: { style: BorderStyle.NONE, size: 0, color: "000000" },
                                      bottom: { style: BorderStyle.NONE, size: 0, color: "000000" },
                                      left: { style: BorderStyle.NONE, size: 0, color: "000000" },
                                      right: { style: BorderStyle.NONE, size: 0, color: "000000" },
                                    }
                                  })
                                ]
                              })
                            ],
                            width: {
                              size: 100,
                              type: WidthType.PERCENTAGE
                            }
                          })
                        ],
                        width: {
                          size: 4536, // 4cm ≈ 4536缇
                          type: WidthType.DXA
                        },
                        margins: {
                          top: 200, // 单元格顶部边距
                          bottom: 200, // 单元格底部边距
                          left: 200, // 单元格左侧边距
                          right: 200, // 单元格右侧边距
                        },
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        }
                      }),
                      // 评分列
                      new TableCell({
                        verticalAlign: AlignmentType.CENTER,
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              // 只显示生成的包含分数的图片
                              new ImageRun({
                                type: (item.scoreImageType as "png" | "jpg" | "gif" | "bmp") || "png",
                                data: item.scoreImageBinary,
                                transformation: {
                                  width: 142,
                                  height: 142,
                                },
                              })
                            ],
                            spacing: {
                              before: 0, // 图片上方间距，进一步减小距离
                              after: 0 // 图片下方间距，进一步减小距离
                            }
                          }),
                        ],
                        width: {
                          size: 5670, // 5cm ≈ 5670缇
                          type: WidthType.DXA
                        },
                        margins: {
                          top: 0, // 单元格顶部边距，进一步减小距离
                          bottom: 0, // 单元格底部边距，进一步减小距离
                          left: 0, // 单元格左侧边距，进一步减小距离
                          right: 0, // 单元格右侧边距，进一步减小距离
                        },
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        }
                      })
                    ]
                  })
                ])
              ]
            }) : 
            // 非评分模式：2列表格，每三行显示两个排名项
            new Table({
              rows: [
                // 遍历数据，每两个项创建三行
                ...Array.from({ length: Math.ceil(tableData.length / 2) }, (_, index) => {
                  const item1 = tableData[index * 2];
                  const item2 = tableData[index * 2 + 1];
                  
                  return [
                    // 第一行：合并单元格显示歌曲信息
                    new TableRow({
                      children: [
                        // 第一首歌信息
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: `${item1.title} - ${item1.artist}`,
                                  bold: true,
                                  size: 22, // 11pt = 22
                                  font: "Times New Roman",
                                })
                              ],
                              alignment: AlignmentType.CENTER,
                            })
                          ],
                          borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          }
                        }),
                        // 第二首歌信息（如果存在）
                        item2 ? new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: `${item2.title} - ${item2.artist}`,
                                  bold: true,
                                  size: 22, // 11pt = 22
                                  font: "Times New Roman",
                                })
                              ],
                              alignment: AlignmentType.CENTER,
                            })
                          ],
                          borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          }
                        }) : new TableCell({
                          // 空单元格，用于填充
                          children: [new Paragraph({})],
                          borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          }
                        })
                      ],
                    }),
                    // 第二行：只显示封面
                    new TableRow({
                      children: [
                        // 第一首歌封面
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new ImageRun({
                                  type: (item1.coverType as "png" | "jpg" | "gif" | "bmp") || "png",
                                  data: item1.coverBinary,
                                  transformation: {
                                    width: 142, // 5cm ≈ 142像素
                                    height: 142,
                                  },
                                })
                              ],
                              alignment: AlignmentType.CENTER,
                              spacing: {
                                before: 0,
                                after: 0,
                                line: 1,
                                lineRule: "atLeast"
                              }
                            })
                          ],
                          width: {
                            size: 9072, // 10cm ≈ 9072缇
                            type: WidthType.DXA
                          },
                          verticalAlign: AlignmentType.CENTER,
                          borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          },
                          margins: {
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0,
                          }
                        }),
                        // 第二首歌封面（如果存在）
                        item2 ? new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new ImageRun({
                                  type: (item2.coverType as "png" | "jpg" | "gif" | "bmp") || "png",
                                  data: item2.coverBinary,
                                  transformation: {
                                    width: 142, // 5cm ≈ 142像素
                                    height: 142,
                                  },
                                })
                              ],
                              alignment: AlignmentType.CENTER,
                              spacing: {
                                before: 0,
                                after: 0,
                                line: 1,
                                lineRule: "atLeast"
                              }
                            })
                          ],
                          width: {
                            size: 9072, // 10cm ≈ 9072缇
                            type: WidthType.DXA
                          },
                          verticalAlign: AlignmentType.CENTER,
                          borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          },
                          margins: {
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0,
                          }
                        }) : new TableCell({
                          // 空单元格，用于填充
                          children: [new Paragraph({})],
                          width: {
                            size: 9072, // 10cm ≈ 9072缇
                            type: WidthType.DXA
                          },
                          borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          }
                        })
                      ]
                    }),
                    // 第三行：只显示评价
                    new TableRow({
                      children: [
                        // 第一首歌评价（移到第三行）
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: item1.review || '没有评价的义务！',
                                  bold: false,
                                  size: 22, // 11pt = 22
                                  font: "仿宋",
                                })
                              ],
                              alignment: AlignmentType.CENTER,
                              spacing: { after: 100, before: 100 }
                            })
                          ],
                          width: {
                            size: 9072, // 10cm ≈ 9072缇
                            type: WidthType.DXA
                          },
                          verticalAlign: AlignmentType.CENTER,
                          borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          },
                          margins: {
                            top: 200,
                            bottom: 200,
                            left: 200,
                            right: 200,
                          }
                        }),
                        // 第二首歌评价（移到第三行，如果存在）
                        item2 ? new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: item2.review || '没有评价的义务！',
                                  bold: false,
                                  size: 22, // 11pt = 22
                                  font: "仿宋",
                                })
                              ],
                              alignment: AlignmentType.CENTER,
                              spacing: { after: 100, before: 100 }
                            })
                          ],
                          width: {
                            size: 9072, // 10cm ≈ 9072缇
                            type: WidthType.DXA
                          },
                          verticalAlign: AlignmentType.CENTER,
                          borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          },
                          margins: {
                            top: 200,
                            bottom: 200,
                            left: 200,
                            right: 200,
                          }
                        }) : new TableCell({
                          // 空单元格，用于填充
                          children: [new Paragraph({})],
                          width: {
                            size: 9072, // 10cm ≈ 9072缇
                            type: WidthType.DXA
                          },
                          borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          }
                        })
                      ]
                    })
                  ];
                }).flat()
              ]
            })
          ]
        }
      ]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `MeloRank_${currentYear}年度榜单.docx`);
  };
  
  return (
    <div className="yearly-ranking-page">
      <h2>MeloRank · {currentYear} 年度榜单</h2>
      <p className="platform-position">音乐评分与榜单平台</p>
      
      <RankingModeSelector rankingMode={rankingMode} rankingModes={rankingModes} scoringMode={scoringMode} scoringModes={scoringModes} onRankingModeChange={setRankingMode} onScoringModeChange={setScoringMode} onImport={() => setShowImportDialog(true)} />

      <div className="ranking-container">
        <RankingEditor rankingMode={rankingMode} scoringMode={scoringMode} editMode={editMode} coverUrl={coverUrl} coverPreview={coverPreview} searchQuery={searchQuery} searchResults={searchResults} isSearching={isSearching} searchError={searchError} integrityRef={integrityRef} durabilityRef={durabilityRef} fileInputRef={fileInputRef} onSubmit={handleSubmit} onSearchChange={value => { setSearchQuery(value); setShowSearchResults(true); }} onSearchFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }} onSearchResultClick={handleSearchResultClick} onCoverPreview={showCoverPreview} onCoverChange={value => { setCoverUrl(value); setCoverPreview(value); }} onCoverPaste={event => { const item = Array.from(event.clipboardData.items).find(entry => entry.type.startsWith('image/')); const file = item?.getAsFile(); if (!file) return; const reader = new FileReader(); reader.onload = loadEvent => { const value = loadEvent.target?.result as string; setCoverUrl(value); setCoverPreview(value); }; reader.readAsDataURL(file); event.preventDefault(); }} onFileUpload={handleFileUpload} onSelectFile={triggerFileSelect} onAdjustScore={adjustScore} />
        <div style={{ display: 'none' }}>
        <div className="ranking-form">
          <h3>添加到 {rankingMode}</h3>
          <form onSubmit={handleSubmit}>
            {/* 搜索功能区域 */}
            <div className="form-group search-container">
              <label>搜索 {getCurrentRankingTypeName()}</label>
              <div className="search-input-wrapper">
                <input 
                  type="text" 
                  placeholder={`搜索${getCurrentRankingTypeName()}...`} 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => {
                    if (searchResults.length > 0) {
                      setShowSearchResults(true);
                    }
                  }}
                  autoComplete="off"
                  className="search-input"
                />
                {isSearching && <span className="search-loading">搜索中...</span>}
              </div>
              
              {/* 搜索结果显示区域 */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="search-results-dropdown">
                  {searchResults.map((result) => (
                    <div 
                      key={result.id} 
                      className="search-result-item"
                      onClick={(e) => {
                        // 只有点击结果项主体时才触发填充表单，点击按钮时不触发
                        const target = e.target as Element;
                        if (!target.closest('.cover-action-buttons')) {
                          handleSearchResultClick(result);
                        }
                      }}
                    >
                      <div className="search-result-cover">
                        {result.coverUrl && (
                          <img src={result.coverUrl} alt={`${result.title} 封面`} />
                        )}
                      </div>
                      <div className="search-result-info">
                        <div className="search-result-title">
                          {result.title}
                          <span className="search-result-type">
                            {result.type === 'album' && ' [专辑]'}
                            {result.type === 'song' && ' [单曲]'}
                            {result.type === 'artist' && ' [艺人]'}
                          </span>
                        </div>
                        <div className="search-result-subtitle">
                          {result.artist}
                          {result.album && result.type === 'song' && <span className="search-result-album"> · {result.album}</span>}
                        </div>
                      </div>
                      <div className="cover-action-buttons">
                        <button 
                          className="cover-action-btn copy-btn"
                          onClick={(e) => {
                            e.stopPropagation(); // 阻止事件冒泡到父元素
                            e.preventDefault(); // 阻止默认行为
                            showCoverPreview(result.coverUrl);
                          }}
                          title="弹出封面"
                        >
                          弹出封面
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 搜索错误提示 */}
              {searchError && (
                <div className="search-error">{searchError}</div>
              )}
            </div>
            
            <div className="form-group">
              <label>封面图片</label>
              <div className="cover-upload-container">
                <input 
                  type="text" 
                  name="coverUrl" 
                  placeholder="输入图片URL/粘贴图片" 
                  value={coverUrl}
                  onChange={(e) => {
                    setCoverUrl(e.target.value);
                    setCoverPreview(e.target.value);
                  }}
                  onPaste={(e) => {
                    // 处理粘贴事件
                    const items = e.clipboardData?.items;
                    if (items) {
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                          // 获取粘贴的图片文件
                          const file = items[i].getAsFile();
                          if (file) {
                            // 创建FileReader读取图片
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              const result = e.target?.result as string;
                              // 设置为封面URL和预览
                              setCoverUrl(result);
                              setCoverPreview(result);
                            };
                            reader.readAsDataURL(file);
                            // 阻止默认粘贴行为
                            e.preventDefault();
                            break;
                          }
                        }
                      }
                    }
                  }}
                  autoComplete="off"
                />
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button 
                  type="button" 
                  className="upload-btn"
                  onClick={triggerFileSelect}
                >
                  上传本地图片
                </button>
              </div>
              {/* 图片预览区域 */}
              {coverPreview && (
                <div className="cover-preview">
                  <img src={coverPreview} alt="封面预览" />
                </div>
              )}
            </div>
            <div className="form-group">
              <label>作品名称</label>
              <input type="text" name="title" placeholder="输入歌曲/专辑名称" autoComplete="off" />
            </div>
            <div className="form-group">
              <label>艺术家</label>
              <input type="text" name="artist" placeholder="输入艺术家名称" autoComplete="off" />
            </div>
            <div className="form-group">
              <label>评分</label>
              <input type="number" name="score" min="0" max="100" step="0.01" placeholder="0-100" autoComplete="off" disabled={scoringMode === 'non-scoring'} />
            </div>
            <div className="form-group">
              <label>整体性</label>
              <div className="score-adjuster">
                <div className="score-input-with-arrows">
                  <input 
                    type="number" 
                    min="0" 
                    max="2" 
                    step="0.5" 
                    defaultValue="0.0" 
                    placeholder="0-2" 
                    readOnly 
                    ref={integrityRef}
                    disabled={scoringMode === 'non-scoring'}
                  />
                  <div className="arrow-controls">
                    <button 
                      type="button" 
                      className="arrow-btn arrow-up"
                      onClick={() => adjustScore(integrityRef, true)}
                      disabled={scoringMode === 'non-scoring'}
                    >
                      ▲
                    </button>
                    <button 
                      type="button" 
                      className="arrow-btn arrow-down"
                      onClick={() => adjustScore(integrityRef, false)}
                      disabled={scoringMode === 'non-scoring'}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>保值度</label>
              <div className="score-adjuster">
                <div className="score-input-with-arrows">
                  <input 
                    type="number" 
                    min="0" 
                    max="2" 
                    step="0.5" 
                    defaultValue="0.0" 
                    placeholder="0-2" 
                    readOnly 
                    ref={durabilityRef}
                    disabled={scoringMode === 'non-scoring'}
                  />
                  <div className="arrow-controls">
                    <button 
                      type="button" 
                      className="arrow-btn arrow-up"
                      onClick={() => adjustScore(durabilityRef, true)}
                      disabled={scoringMode === 'non-scoring'}
                    >
                      ▲
                    </button>
                    <button 
                      type="button" 
                      className="arrow-btn arrow-down"
                      onClick={() => adjustScore(durabilityRef, false)}
                      disabled={scoringMode === 'non-scoring'}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>评价</label>
              <textarea name="review" rows={4} placeholder="写下你的评价..." autoComplete="off"></textarea>
            </div>
            <button type="submit" className="add-btn">{editMode ? '修改完成' : '添加到榜单'}</button>
          </form>
        </div>
        </div>

        <div className="ranking-display">
          <div className="ranking-display-header">
            <div className="ranking-title-with-restore">
              <h3>{currentYear} {rankingMode}</h3>
              <button 
                className="restore-btn"
                onClick={restoreDefaultRanking}
              >
                恢复默认榜单
              </button>
            </div>
            <div className="export-buttons">
              <button className="export-btn" onClick={saveRanking} disabled={isSaving}>
                {isSaving ? '保存中...' : '保存榜单'}
              </button>

              <button className="export-btn" onClick={fetchHistoryRankings} disabled={isSaving}>
                历史榜单记录
              </button>
              <button className="export-btn" onClick={exportPDF}>导出 PDF</button>
              <button className="export-btn" onClick={exportDOCX}>导出 DOCX</button>
            </div>
          </div>

          <RankingList items={rankingList} mode={scoringMode} onEdit={handleEdit} onDelete={handleDelete} onMoveUp={moveItemUp} onMoveDown={moveItemDown} />
          <div className="user-ranking-list legacy-ranking-list" style={{ display: 'none' }}>
            {/* 根据评分模式处理榜单数据 */}
            {(() => {
              // 如果是不评分模式，使用当前排序（允许用户手动调整）
              if (scoringMode === 'non-scoring') {
                return rankingList.map((item, index) => (
                  <div key={item.id} className="user-rank-item">
                    <div className="user-rank-number">{index + 1}</div>
                    <div className="user-rank-cover">
                      <img 
                        src={item.coverUrl} 
                        alt={`${item.title} 封面`} 
                      />
                    </div>
                    <div className="user-rank-content">
                      <div className="user-rank-title">{item.title}</div>
                      <div className="user-rank-artist">{item.artist}</div>
                      <div className="user-rank-review">
                        {item.review || '没有评价的义务！'}
                      </div>
                    </div>
                    {/* 不评分模式下不显示分数相关内容，但显示移动按钮 */}
                    <div className="user-rank-actions" style={{ marginLeft: 'auto' }}>
                      <button 
                        className="action-btn move-btn" 
                        onClick={() => moveItemUp(item)}
                        disabled={index === 0}
                        title="上移"
                      >
                        ▲
                      </button>
                      <button 
                        className="action-btn move-btn" 
                        onClick={() => moveItemDown(item)}
                        disabled={index === rankingList.length - 1}
                        title="下移"
                      >
                        ▼
                      </button>
                      <button 
                        className="action-btn edit-btn" 
                        onClick={() => handleEdit(item)}
                      >
                        编辑
                      </button>
                      <button 
                        className="action-btn delete-btn" 
                        onClick={() => handleDelete(item.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ));
              }
              
              // 评分模式下按原有逻辑显示
              return rankingList.map((item) => (
                <div key={item.id} className="user-rank-item">
                  <div className="user-rank-number">{item.rank}</div>
                  <div className="user-rank-cover">
                    <img 
                      src={item.coverUrl} 
                      alt={`${item.title} 封面`} 
                    />
                  </div>
                  <div className="user-rank-content">
                    <div className="user-rank-title">{item.title}</div>
                    <div className="user-rank-artist">{item.artist}</div>
                    <div className="user-rank-review">
                      {item.review || '没有评价的义务！'}
                    </div>
                  </div>
                  <div className="user-rank-score">
                    <div className="user-rank-bonus">
                      {item.integrity > 0 && (
                        <span className="bonus-item">
                          <span className="bonus-label">整体性</span>
                          <span className="bonus-star">⭐</span>
                          <span className="bonus-value">+{item.integrity}</span>
                        </span>
                      )}
                      {item.durability > 0 && (
                        <span className="bonus-item">
                          <span className="bonus-label">保值度</span>
                          <span className="bonus-star">⭐</span>
                          <span className="bonus-value">+{item.durability}</span>
                        </span>
                      )}
                    </div>
                    <div className="score-box">
                      {item.originalScore}
                    </div>
                  </div>
                  <div className="user-rank-actions">
                    <button 
                      className="action-btn edit-btn" 
                      onClick={() => handleEdit(item)}
                    >
                      编辑
                    </button>
                    <button 
                      className="action-btn delete-btn" 
                      onClick={() => handleDelete(item.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      <RankingExportPreview ref={exportRef} items={rankingList} mode={scoringMode} formatScore={formatScore} />
      {/* 旧导出预览已由 RankingExportPreview 替代 */}
      <div style={{ display: 'none' }}>
      {/* ====== 隐藏导出榜单（不影响网页） ====== */}
      <div
        ref={exportRef}
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "800px",
          background: "#fff",
        }}
      >
        {/* 使用表格布局，与DOCX结构一致 */}
        <table className="rank-export-table">
          {/* 表头 */}
          <thead>
            <tr>
              <th style={{ width: '33.33%' }}>封面</th>
              <th style={{ width: '33.33%' }}>详情</th>
              {scoringMode === 'scoring' && <th style={{ width: '33.33%' }}>评分</th>}
            </tr>
          </thead>
          <tbody>
            {/* 这里使用动态数据，确保导出格式正确 */}
            {(() => {
              if (scoringMode === 'non-scoring') {
                // 不评分模式下按首字母排序
                const sortedList = [...rankingList].sort((a, b) => {
                  return sortRankingTitles(a.title, b.title);
                });
                
                return sortedList.map((item, index) => (
                  <>
                    {/* 排名+标题行 */}
                    <tr>
                      <td colSpan={3} className="rank-export-title-row">
                        <strong>NO.{index + 1}</strong> {item.title} - {item.artist}
                      </td>
                    </tr>
                    {/* 内容行 */}
                    <tr className="rank-export-content-row">
                      <td className="rank-export-cover">
                        <img src={item.coverUrl} alt={item.title} />
                      </td>
                      <td className="rank-export-details">
                        <div className="rank-export-review">
                          <p>{item.review || '没有评价的义务！'}</p>
                        </div>
                      </td>
                    </tr>
                  </>
                ));
              }
              
              // 评分模式下按原有逻辑显示
              return rankingList.map((item) => (
                <>
                  {/* 排名+标题行 */}
                  <tr>
                    <td colSpan={3} className="rank-export-title-row">
                      <strong>NO.{item.rank}</strong> {item.title} - {item.artist}
                    </td>
                  </tr>
                  {/* 内容行 */}
                  <tr className="rank-export-content-row">
                    <td className="rank-export-cover">
                      <img src={item.coverUrl} alt={item.title} />
                    </td>
                    <td className="rank-export-details">
                      <div className="rank-export-score-info">
                        <p>原始分数：{item.originalScore}</p>
                        <p>整体性：{item.integrity > 0 ? '+' + item.integrity.toFixed(1) : '0'}</p>
                        <p>保值度：{item.durability > 0 ? '+' + item.durability.toFixed(1) : '0'}</p>
                      </div>
                      <div className="rank-export-review">
                        <p>{item.review || '没有评价的义务！'}</p>
                      </div>
                    </td>
                    <td className="rank-export-final-score">
                      <div className={`rank-export-score-circle ${item.durability === 2 ? 'high-durability' : ''}`}>
                        {formatScore(item.finalScore)}
                      </div>
                    </td>
                  </tr>
                </>
              ));
            })()}
          </tbody>
        </table>
      </div>

      </div>
      <RankingDialogs showRestore={showConfirmDialog} showHistory={showHistoryDialog} showImport={showImportDialog} history={historyRankings} importText={importedRankingText} onRestore={confirmRestoreDefault} onCancelRestore={cancelRestoreDefault} onCloseHistory={closeHistoryDialog} onLoadHistory={loadHistoryRanking} onDeleteHistory={deleteHistoryRanking} onImportTextChange={setImportedRankingText} onImport={handleImportRanking} onCloseImport={() => { setShowImportDialog(false); setImportedRankingText(''); }} />
      <div style={{ display: 'none' }}>
      {/* 确认对话框 */}
      {showConfirmDialog && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <div className="confirm-dialog-header">
              <h4>确认恢复默认榜单</h4>
              <button 
                className="confirm-dialog-close" 
                onClick={cancelRestoreDefault}
              >
                ×
              </button>
            </div>
            <div className="confirm-dialog-content">
              <p>将清除所输入内容，是否确认清除？（推荐先保存）</p>
            </div>
            <div className="confirm-dialog-footer">
              <button 
                className="confirm-dialog-confirm" 
                onClick={confirmRestoreDefault}
              >
                确认清除
              </button>
              <button 
                className="confirm-dialog-cancel" 
                onClick={cancelRestoreDefault}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 保存成功提示 */}
      {saveSuccess && (
        <div className="save-success-toast">
          榜单保存成功！
        </div>
      )}

      {/* 历史榜单记录对话框 */}
      {showHistoryDialog && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog" style={{ width: '800px', maxHeight: '600px', overflowY: 'auto' }}>
            <div className="confirm-dialog-header">
              <h4>历史榜单记录</h4>
              <button 
                className="confirm-dialog-close" 
                onClick={closeHistoryDialog}
              >
                ×
              </button>
            </div>
            <div className="confirm-dialog-content">
              {historyRankings.length === 0 ? (
                <p>暂无历史榜单记录</p>
              ) : (
                <div className="history-rankings-list">
                  {historyRankings.map((ranking, index) => (
                    <div key={ranking.id || index} className="history-ranking-item">
                      <div className="history-ranking-info">
                        <h5>{ranking.year} {ranking.type}</h5>
                        <p>评分模式：{ranking.scoringMode === 'scoring' ? '评分' : '不评分'}</p>
                        <p>创建时间：{new Date(ranking.createdAt).toLocaleString()}</p>
                        <p>包含 {ranking.rankingList.length} 个项目</p>
                      </div>
                      <div className="history-ranking-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button 
                          className="confirm-dialog-confirm" 
                          onClick={() => loadHistoryRanking(ranking)}
                          style={{ width: '120px' }}
                        >
                          加载此榜单
                        </button>
                        <button 
                          className="confirm-dialog-cancel" 
                          onClick={() => deleteHistoryRanking(ranking.id || index)}
                          style={{ 
                            backgroundColor: '#ff4d4f', 
                            borderColor: '#ff4d4f',
                            color: '#fff',
                            width: '120px'
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="confirm-dialog-footer">
              <button 
                className="confirm-dialog-cancel" 
                onClick={closeHistoryDialog}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入排行榜对话框 */}
      {showImportDialog && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog" style={{ width: '800px', overflow: 'hidden' }}>
            <div className="confirm-dialog-header">
              <h4>导入排行榜</h4>
              <button 
                className="confirm-dialog-close" 
                onClick={() => setShowImportDialog(false)}
              >
                ×
              </button>
            </div>
            <div className="confirm-dialog-content">
              <p>将您编写的排行榜粘贴至此，我们会为您自动填充排行榜，格式为：</p>
              <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', margin: '10px 0', overflowX: 'auto', fontSize: '14px', lineHeight: '1.5' }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong>1. xx.xx xxx - xxx xx+xx++xx</strong><br />
                  <span style={{ marginLeft: '20px' }}>（月.日 作品名 - 作者名 原始分数+整体性++保值度）</span>
                </div>
                <div>
                  <strong>2. xxx - xxx</strong><br />
                  <span style={{ marginLeft: '20px' }}>（作品名 - 作者名）</span>
                </div>
              </div>
              <textarea 
                style={{ width: '100%', height: '200px', marginTop: '10px', backgroundColor: 'white', color: '#333', border: '1px solid #ddd', borderRadius: '4px', padding: '10px', fontSize: '14px' }}
                placeholder="请在此粘贴排行榜..."
                value={importedRankingText}
                onChange={(e) => setImportedRankingText(e.target.value)}
              ></textarea>
            </div>
            <div className="confirm-dialog-footer">
              <button 
                className="confirm-dialog-confirm" 
                onClick={handleImportRanking}
              >
                确认导入
              </button>
              <button 
                className="confirm-dialog-cancel" 
                onClick={() => {
                  setShowImportDialog(false);
                  setImportedRankingText('');
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
