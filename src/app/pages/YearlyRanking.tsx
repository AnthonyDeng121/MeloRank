import React, { useState, useRef, useCallback, useEffect } from "react";
import { qqMusicService } from "../services/qqMusicService";
import "../../styles/YearlyRanking.css";

import { downloadRanking, type RankingExportFormat } from '../services/rankingExport';
import { parseRankingText } from '../utils/rankingImport';

import {
  useRankingContext,
  RankingItem,
  DEFAULT_RANKING_LIST,
} from "../contexts/RankingContext";

import { ArtistRecommendations } from "../components/ArtistRecommendations";

interface YearlyRankingProps {
  pageType?: string;
}

export function YearlyRanking({
  pageType = "yearly-ranking",
}: YearlyRankingProps) {
  // 如果是艺人推荐页面，显示ArtistRecommendations组件
  if (pageType === "artist-recommendations") {
    return <ArtistRecommendations />;
  }

  // 使用RankingContext获取和更新榜单状态
  const { rankingMode, setRankingMode, rankingList, setRankingList } =
    useRankingContext();

  // 根据pageType设置初始榜单类型
  React.useEffect(() => {
    if (pageType === "yearly-songs") {
      setRankingMode("年度单曲榜");
    } else if (pageType === "yearly-albums") {
      setRankingMode("年度专辑榜");
    }
  }, [pageType, setRankingMode]);

  const currentYear = new Date().getFullYear();

  // 添加状态管理来存储上传的图片和预览URL
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [coverPreview, setCoverPreview] = useState<string>("");

  // 添加编辑状态管理
  const [editMode, setEditMode] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<
    (typeof rankingList)[0] | null
  >(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // 添加确认对话框状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // 添加评分模式状态管理
  const [scoringMode, setScoringMode] = useState<"scoring" | "non-scoring">(
    "scoring"
  );

  // 评分模式选项
  const scoringModes = [
    { value: "scoring", label: "评分" },
    { value: "non-scoring", label: "不评分" },
  ];

  // 添加保存和历史榜单相关状态
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyRankings, setHistoryRankings] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importedRankingText, setImportedRankingText] = useState("");
  const [importError, setImportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [coverProgress, setCoverProgress] = useState({ loading: false, completed: 0, total: 0, unmatched: 0 });
  const coverGeneration = useRef(0);
  useEffect(() => () => { coverGeneration.current++; }, []);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [rankingName, setRankingName] = useState("");
  const [currentRankingId, setCurrentRankingId] = useState<string | null>(null);
  const [currentRankingName, setCurrentRankingName] = useState<string | null>(
    null
  );
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renamingRankingId, setRenamingRankingId] = useState<string | null>(
    null
  );
  const [newRankingName, setNewRankingName] = useState("");

  const rankingModes = ["年度艺人榜", "年度专辑榜", "年度单曲榜", "年度MV榜"];

  // 搜索相关状态管理
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // 防抖定时器引用
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchTimeRef = useRef(0);
  const searchInputRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  /** ====== 导出专用隐藏 DOM ====== */

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
      if (!file.type.startsWith("image/")) {
        alert("请上传图片文件");
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
    if (rankingMode.includes("艺人")) return "艺人";
    if (rankingMode.includes("专辑")) return "专辑";
    if (rankingMode.includes("单曲")) return "单曲";
    if (rankingMode.includes("MV")) return "MV";
    return "作品";
  };

  // 组件挂载时，使用线性映射计算初始数据的分数
  React.useEffect(() => {
    const updatedList = calculateLinearScores(rankingList);
    setRankingList(updatedList);
  }, []);

  // 当榜单类型或评分模式变化时，更新样例数据的标题
  React.useEffect(() => {
    // 检查是否是样例数据
    const isSampleData =
      rankingList.length === 3 &&
      rankingList.every(
        (item) => item.id === "1" || item.id === "2" || item.id === "3"
      );

    if (isSampleData) {
      let updatedList;

      if (scoringMode === "non-scoring") {
        // 不评分模式下，显示曲目1、曲目2、曲目3
        updatedList = rankingList.map((item) => {
          let title = "";
          if (item.rank === 1) title = `曲目1`;
          if (item.rank === 2) title = `曲目2`;
          if (item.rank === 3) title = `曲目3`;
          return {
            ...item,
            title,
          };
        });
      } else {
        // 评分模式下，保持原有逻辑
        const typeName = getCurrentRankingTypeName();
        updatedList = rankingList.map((item) => {
          let title = "";
          if (item.rank === 1) title = `冠军${typeName}`;
          if (item.rank === 2) title = `亚军${typeName}`;
          if (item.rank === 3) title = `季军${typeName}`;
          return {
            ...item,
            title,
          };
        });
      }

      setRankingList(updatedList);
    }
  }, [rankingMode, scoringMode]);

  // 恢复默认榜单的函数
  const restoreDefaultRanking = () => {
    coverGeneration.current++;
    setCoverProgress({ loading: false, completed: 0, total: 0, unmatched: 0 });
    setShowConfirmDialog(true);
  };

  // 自定义排序函数：实现中英文混排，按首字母ASCII顺序，相同时短的靠前
  const customSort = (a: string, b: string): number => {
    // 转换为小写进行比较，确保大小写不影响排序
    const strA = a.toLowerCase();
    const strB = b.toLowerCase();

    // 检查是否为英文（只包含a-z和基本符号）
    const isEnglishA = /^[a-z0-9\s\-\_\.\,\!\?\'\"\(\)\[\]\{\}\:\;]+$/.test(
      strA
    );
    const isEnglishB = /^[a-z0-9\s\-\_\.\,\!\?\'\"\(\)\[\]\{\}\:\;]+$/.test(
      strB
    );

    // 英文总是排在中文前面
    if (isEnglishA && !isEnglishB) {
      return -1;
    }
    if (!isEnglishA && isEnglishB) {
      return 1;
    }

    // 都是英文或都是中文，使用localeCompare排序
    const localeResult = strA.localeCompare(
      strB,
      isEnglishA ? "en-US" : "zh-CN-u-co-pinyin",
      {
        numeric: true,
        sensitivity: "base",
        caseFirst: "upper", // 大写字母优先
      }
    );

    // 如果localeCompare结果为0（首字母相同），则比较长度，短的靠前
    if (localeResult === 0) {
      return a.length - b.length;
    }

    return localeResult;
  };

  // 确认恢复默认榜单
  const confirmRestoreDefault = () => {
    let updatedList;

    if (scoringMode === "non-scoring") {
      // 不评分模式下，显示曲目1、曲目2、曲目3
      updatedList = DEFAULT_RANKING_LIST.map((item) => {
        let title = "";
        if (item.rank === 1) title = `曲目1`;
        if (item.rank === 2) title = `曲目2`;
        if (item.rank === 3) title = `曲目3`;
        return {
          ...item,
          title,
        };
      });
    } else {
      // 评分模式下，保持原有逻辑
      const typeName = getCurrentRankingTypeName();
      updatedList = DEFAULT_RANKING_LIST.map((item) => {
        let title = "";
        if (item.rank === 1) title = `冠军${typeName}`;
        if (item.rank === 2) title = `亚军${typeName}`;
        if (item.rank === 3) title = `季军${typeName}`;
        return {
          ...item,
          title,
        };
      });
    }

    let listToUpdate: RankingItem[];

    // 根据评分模式处理列表
    if (scoringMode === "scoring") {
      // 使用线性映射计算初始数据的分数
      listToUpdate = calculateLinearScores(updatedList);
    } else {
      // 不评分模式下，使用自定义排序
      listToUpdate = [...updatedList]
        .sort((a, b) => {
          return customSort(a.title, b.title);
        })
        .map((item, index) => ({
          ...item,
          rank: index + 1, // 更新排名
        }));
    }

    setRankingList(listToUpdate);
    setCurrentRankingId(null);
    setCurrentRankingName(null);
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
    setCoverUrl(item.coverUrl);
    setCoverPreview(item.coverUrl);
    setShowEditDialog(true);
    setTimeout(() => {
      const form = document.getElementById(
        "edit-form"
      ) as HTMLFormElement | null;
      if (!form) return;
      const setField = (name: string, value: string) => {
        const input = form.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null;
        if (input) input.value = value;
      };
      setField("title", item.title);
      setField("artist", item.artist);
      setField("score", String(item.originalScore));
      setField("review", item.review || "");
      setField("coverUrl", item.coverUrl);
      if (integrityRef.current)
        integrityRef.current.value = item.integrity.toFixed(1);
      if (durabilityRef.current)
        durabilityRef.current.value = item.durability.toFixed(1);
    }, 0);
  };

  // 处理删除操作
  const handleDelete = (id: string) => {
    const updatedList = rankingList.filter((item) => item.id !== id);
    let listToUpdate: RankingItem[];

    // 根据评分模式处理列表
    if (scoringMode === "scoring") {
      // 使用线性映射重新计算所有项目的分数
      listToUpdate = calculateLinearScores(updatedList);
    } else {
      // 不评分模式下，使用自定义排序
      listToUpdate = [...updatedList]
        .sort((a, b) => {
          return customSort(a.title, b.title);
        })
        .map((item, index) => ({
          ...item,
          rank: index + 1, // 更新排名
        }));
    }

    setRankingList(listToUpdate);
  };

  // 移动歌曲排名的函数
  const moveItemUp = (item: RankingItem) => {
    const index = rankingList.findIndex((i) => i.id === item.id);
    if (index > 0) {
      const updatedList = [...rankingList];
      // 交换位置
      [updatedList[index], updatedList[index - 1]] = [
        updatedList[index - 1],
        updatedList[index],
      ];
      // 更新排名
      const reorderedList = updatedList.map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));
      setRankingList(reorderedList);
    }
  };

  const moveItemDown = (item: RankingItem) => {
    const index = rankingList.findIndex((i) => i.id === item.id);
    if (index < rankingList.length - 1) {
      const updatedList = [...rankingList];
      // 交换位置
      [updatedList[index], updatedList[index + 1]] = [
        updatedList[index + 1],
        updatedList[index],
      ];
      // 更新排名
      const reorderedList = updatedList.map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));
      setRankingList(reorderedList);
    }
  };

  // 添加一个函数来获取代理封面URL
  const getProxyCoverUrl = (originalUrl: string): string => {
    // 如果是base64或默认封面，直接返回
    if (
      originalUrl.startsWith("data:image/") ||
      originalUrl.includes("svg") ||
      originalUrl.includes("/api/proxy/qqmusic/image")
    ) {
      return originalUrl;
    }
    // 使用本地代理服务获取QQ音乐图片
    return `${
      import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
    }/api/proxy/qqmusic/image?url=${encodeURIComponent(originalUrl)}`;
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 获取表单数据
    const form = e.target as HTMLFormElement;
    const title =
      (form.elements.namedItem("title") as HTMLInputElement)?.value || "";
    const artist =
      (form.elements.namedItem("artist") as HTMLInputElement)?.value || "";

    // 根据评分模式处理评分相关数据
    let originalScore = 0;
    let integrity = 0;
    let durability = 0;

    if (scoringMode === "scoring") {
      // 解决浮点数精度问题：先转换为字符串，去除可能的小数误差，再转换为浮点数
      const rawScore =
        (form.elements.namedItem("score") as HTMLInputElement)?.value || "0";
      // 先转换为数字，再使用toFixed(2)处理，最后转回数字
      originalScore = parseFloat(parseFloat(rawScore).toFixed(2)) || 0;

      // 获取分数调节值，解决浮点数精度问题
      const integrityStr = integrityRef.current?.value || "0";
      const durabilityStr = durabilityRef.current?.value || "0";
      integrity = parseFloat(parseFloat(integrityStr).toFixed(1)) || 0;
      durability = parseFloat(parseFloat(durabilityStr).toFixed(1)) || 0;
    }

    const review =
      (form.elements.namedItem("review") as HTMLTextAreaElement)?.value || "";

    // 自动搜索封面图片
    let finalCoverUrl = coverUrl;
    if (
      title &&
      (!finalCoverUrl || finalCoverUrl === DEFAULT_RANKING_LIST[0].coverUrl)
    ) {
      try {
        // 构建搜索查询
        const searchQuery = artist ? `${title} ${artist}` : title;

        // 部署版本统一搜索歌曲，使用所属专辑的封面。
        const searchType = "songs";

        console.log("开始自动搜索封面:", {
          searchQuery,
          searchType,
          title,
          artist,
        });

        // 调用QQ音乐搜索API
        const result = await qqMusicService.searchWithType(
          searchQuery,
          20,
          searchType,
          1
        );

        console.log("搜索原始结果:", result);

        // 处理搜索结果，适配API返回格式
        const searchResult = result.response || result;
        const actualData = searchResult.data || searchResult;

        console.log("处理后的搜索结果:", actualData);

        // 提取第一个结果的封面URL
        let firstResult = null;
        if (actualData.song?.list?.length > 0) {
          firstResult = actualData.song.list[0];
        }

        console.log("第一个结果:", firstResult);

        // 如果有结果，获取封面URL并使用代理
        if (firstResult) {
          let originalUrl = "";
          originalUrl = firstResult.albummid
            ? `https://y.qq.com/music/photo_new/T002R300x300M000${firstResult.albummid}.jpg`
            : "";

          if (originalUrl) finalCoverUrl = originalUrl;
          console.log("最终封面URL:", finalCoverUrl);
        }
      } catch (error) {
        console.error("自动搜索封面失败:", error);
        // 搜索失败不影响表单提交，继续使用默认封面
      }
    }

    let updatedList: RankingItem[];
    const previousItem = rankingList.find((item) => item.id === editingItemId);
    const scoreChanged =
      previousItem &&
      (previousItem.originalScore !== originalScore ||
        previousItem.integrity !== integrity ||
        previousItem.durability !== durability);

    if (editMode && editingItemId) {
      // 编辑模式：更新现有项
      updatedList = rankingList.map((item) => {
        if (item.id === editingItemId) {
          return {
            ...item,
            title,
            artist,
            coverUrl:
              finalCoverUrl ||
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E",
            review,
            originalScore,
            integrity,
            durability,
          };
        }
        return item;
      });

      // 重置编辑状态
      setEditMode(false);
      setEditingItemId(null);
      setEditingItem(null);
      setShowEditDialog(false);
    } else {
      // 添加模式：创建新的榜单项
      const newItem: RankingItem = {
        id: Date.now().toString(),
        rank: 1,
        title,
        artist,
        coverUrl:
          finalCoverUrl ||
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E",
        review,
        originalScore,
        integrity,
        durability,
        finalScore: 0, // 初始值，后面会被重新计算
      };

      // 检查是否是首次提交（如果rankingList包含样例数据，清空后添加新数据）
      const isSampleData =
        rankingList.length === 3 &&
        rankingList.every(
          (item) => item.id === "1" || item.id === "2" || item.id === "3"
        );

      updatedList = isSampleData ? [newItem] : [...rankingList, newItem];
    }

    let listToUpdate: RankingItem[];

    // 根据评分模式处理列表
    if (editMode && editingItemId && scoringMode === "non-scoring") {
      // 部署版编辑文字时保留用户手动调整的顺序。
      listToUpdate = updatedList.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
    } else if (editMode && editingItemId && !scoreChanged) {
      const totals = updatedList.map((item) =>
        parseFloat(
          (item.originalScore + item.integrity + item.durability).toFixed(2)
        )
      );
      const max = Math.max(...totals),
        min = Math.min(...totals);
      listToUpdate = updatedList.map((item) => {
        if (item.id !== editingItemId) return item;
        const totalScore = parseFloat(
          (item.originalScore + item.integrity + item.durability).toFixed(2)
        );
        return {
          ...item,
          totalScore,
          finalScore:
            max === min
              ? 10
              : parseFloat(
                  (((totalScore - min) / (max - min)) * 10).toFixed(1)
                ),
        };
      });
    } else if (scoringMode === "scoring") {
      // 使用线性映射重新计算所有项目的分数
      listToUpdate = calculateLinearScores(updatedList);
    } else {
      // 不评分模式下，使用自定义排序
      listToUpdate = [...updatedList]
        .sort((a, b) => {
          return customSort(a.title, b.title);
        })
        .map((item, index) => ({
          ...item,
          rank: index + 1, // 更新排名
        }));
    }

    // 更新榜单列表
    setRankingList(listToUpdate);

    // 重置表单
    form.reset();
    setCoverUrl("");
    setCoverPreview("");

    // 重置分数调节
    if (integrityRef.current) integrityRef.current.value = "0.0";
    if (durabilityRef.current) durabilityRef.current.value = "0.0";
  };

  // 处理导入排行榜的函数
  // Parse first, then fill covers in the background with at most three requests in flight.
  const handleImportRanking = () => {
    const parsed = parseRankingText(importedRankingText, scoringMode === 'scoring');
    if (parsed.errors.length) {
      setImportError(parsed.errors.join('\n'));
      return;
    }
    if (!parsed.items.length) { setImportError('请粘贴至少一条有效的榜单数据'); return; }
    const importedItems: RankingItem[] = parsed.items.map((item, index) => ({
      ...item, id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      rank: index + 1, coverUrl: DEFAULT_RANKING_LIST[0].coverUrl, review: '', finalScore: 0,
    }));
    const isSampleData = rankingList.length === 3 && rankingList.every(item => ['1', '2', '3'].includes(item.id));
    const updatedList = isSampleData ? importedItems : [...rankingList, ...importedItems];
    const listToUpdate = scoringMode === 'scoring' ? calculateLinearScores(updatedList)
      : [...updatedList].sort((a, b) => customSort(a.title, b.title)).map((item, index) => ({ ...item, rank: index + 1 }));
    setRankingList(listToUpdate);
    setShowImportDialog(false);
    setImportedRankingText('');
    setImportError('');
    void fillImportedCovers(importedItems, rankingMode);
  };

  const fillImportedCovers = async (items: RankingItem[], mode: string) => {
    const generation = ++coverGeneration.current;
    let next = 0, completed = 0, unmatched = 0;
    setCoverProgress({ loading: true, completed: 0, total: items.length, unmatched: 0 });
    await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
      while (next < items.length && generation === coverGeneration.current) {
        const item = items[next++];
        let cover = '';
        try { cover = await qqMusicService.findCover(item.title, item.artist, mode); } catch {}
        if (generation !== coverGeneration.current) return;
        if (cover) setRankingList(current => current.map(existing =>
          existing.id === item.id && existing.title === item.title && existing.artist === item.artist
            && (!existing.coverUrl || existing.coverUrl === DEFAULT_RANKING_LIST[0].coverUrl)
            ? { ...existing, coverUrl: cover } : existing));
        else unmatched++;
        completed++;
        setCoverProgress({ loading: completed < items.length, completed, total: items.length, unmatched });
      }
    }));
  };

  const adjustScore = (
    ref: React.RefObject<HTMLInputElement | null>,
    isIncrease: boolean
  ) => {
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
  const handleAdjustButtonClick = (
    ref: React.RefObject<HTMLInputElement | null>,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const halfHeight = rect.height / 2;

    adjustScore(ref, clickY < halfHeight);
  };

  // 搜索音乐的函数
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      setSearchResults(
        await qqMusicService.searchWithType(query, 50, "songs", 1)
      );
    } catch (error) {
      console.error("搜索失败:", error);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debouncedSearch = useCallback(
    (query: string) => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        const now = Date.now();
        if (now - lastSearchTimeRef.current < 1000) return;
        lastSearchTimeRef.current = now;
        handleSearch(query);
      }, 500);
    },
    [handleSearch]
  );

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") debouncedSearch(searchQuery);
  };

  useEffect(
    () => () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    },
    []
  );

  // 弹出封面
  const showCoverPreview = async (coverUrl: string) => {
    try {
      // 直接显示封面预览，不再尝试自动复制
      // 降级方案：创建一个临时的图片元素，让用户手动复制
      const tempImg = document.createElement("img");
      tempImg.src = coverUrl;
      tempImg.style.position = "fixed";
      tempImg.style.top = "50%";
      tempImg.style.left = "50%";
      tempImg.style.transform = "translate(-50%, -50%)";
      tempImg.style.width = "300px";
      tempImg.style.height = "300px";
      tempImg.style.objectFit = "cover";
      tempImg.style.zIndex = "9999";
      tempImg.style.border = "4px solid #667eea";
      tempImg.style.borderRadius = "12px";
      tempImg.style.cursor = "pointer";
      tempImg.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.5)";
      tempImg.title = "点击复制图片到剪贴板";
      tempImg.onclick = () => {
        // 创建canvas来复制图片
        const canvas = document.createElement("canvas");
        canvas.width = tempImg.naturalWidth;
        canvas.height = tempImg.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(tempImg, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const item = new ClipboardItem({ "image/png": blob });
              navigator.clipboard
                .write([item])
                .then(() => {
                  document.body.removeChild(tempImg);
                  document.body.removeChild(closeBtn);
                  alert("封面已复制到剪贴板");
                })
                .catch(() => {
                  // 再次降级，使用传统方法
                  try {
                    // 移除不支持的select方法
                    document.body.removeChild(tempImg);
                    document.body.removeChild(closeBtn);
                    alert("复制封面失败，请手动保存图片");
                  } catch (error) {
                    console.error("复制封面失败:", error);
                    alert("复制封面失败，请手动保存图片");
                  }
                });
            }
          });
        }
      };

      // 添加关闭按钮
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "×";
      closeBtn.style.position = "fixed";
      closeBtn.style.top = "calc(50% - 180px)";
      closeBtn.style.left = "calc(50% + 130px)";
      closeBtn.style.width = "30px";
      closeBtn.style.height = "30px";
      closeBtn.style.border = "none";
      closeBtn.style.borderRadius = "50%";
      closeBtn.style.backgroundColor = "#ff4d4f";
      closeBtn.style.color = "white";
      closeBtn.style.fontSize = "20px";
      closeBtn.style.fontWeight = "bold";
      closeBtn.style.cursor = "pointer";
      closeBtn.style.zIndex = "10000";
      closeBtn.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
      closeBtn.onclick = () => {
        document.body.removeChild(tempImg);
        document.body.removeChild(closeBtn);
      };

      document.body.appendChild(tempImg);
      document.body.appendChild(closeBtn);
    } catch (error) {
      console.error("弹出封面失败:", error);
      alert("弹出封面失败，请稍后重试");
    }
  };

  // 处理搜索结果点击
  const handleSearchResultClick = (song: any) => {
    const form = (
      editMode
        ? document.getElementById("edit-form")
        : document.querySelector("form")
    ) as HTMLFormElement | null;
    if (form) {
      const title = form.elements.namedItem("title") as HTMLInputElement | null;
      const artist = form.elements.namedItem(
        "artist"
      ) as HTMLInputElement | null;
      if (title) title.value = song.songname || "";
      if (artist)
        artist.value =
          song.singer?.map((singer: any) => singer.name).join(", ") || "";
    }
    if (song.albummid) {
      const cover =
        "https://y.qq.com/music/photo_new/T002R300x300M000" +
        song.albummid +
        ".jpg";
      setCoverUrl(cover);
      setCoverPreview(cover);
    }
    setSearchResults(null);
    setSearchQuery("");
  };

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (
        searchResultsRef.current &&
        searchInputRef.current &&
        !searchResultsRef.current.contains(event.target as Node) &&
        !searchInputRef.current.contains(event.target as Node)
      )
        setSearchResults(null);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  // 保存榜单到本地存储
  const handleSaveClick = () =>
    currentRankingId ? saveRanking() : setShowSaveDialog(true);
  const handleSaveAsClick = () => setShowSaveDialog(true);

  const saveRanking = () => {
    setIsSaving(true);
    setSaveSuccess(false);
    const persist = (stripImages = false) => {
      const rankings = JSON.parse(
        localStorage.getItem("yearlyRankings") || "[]"
      );
      const saveAsNew = showSaveDialog;
      const now = new Date().toISOString();
      const fallbackName =
        rankingMode + "_" + currentYear + "_" + now.slice(0, 10);
      const previous = rankings.find(
        (ranking: any) => ranking.id === currentRankingId
      );
      const record = {
        id: saveAsNew
          ? "ranking_" + Date.now()
          : currentRankingId || "ranking_" + Date.now(),
        name: saveAsNew
          ? rankingName || fallbackName
          : currentRankingName || rankingName || fallbackName,
        year: currentYear,
        type: rankingMode,
        scoringMode,
        rankingList: stripImages
          ? rankingList.map((item) =>
              item.coverUrl.startsWith("data:image/")
                ? { ...item, coverUrl: "" }
                : item
            )
          : rankingList,
        createdAt: saveAsNew ? now : previous?.createdAt || now,
        updatedAt: now,
      };
      const updated =
        currentRankingId && !saveAsNew
          ? rankings.map((ranking: any) =>
              ranking.id === currentRankingId ? record : ranking
            )
          : [...rankings, record];
      localStorage.setItem("yearlyRankings", JSON.stringify(updated));
    };
    try {
      persist();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setShowSaveDialog(false);
      setRankingName("");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("QuotaExceededError")
      ) {
        try {
          persist(true);
          alert(
            "保存成功：由于本地存储容量限制，部分base64图片已被优化。建议您使用外部图片链接以获得更好的体验。"
          );
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
          setShowSaveDialog(false);
          setRankingName("");
        } catch {
          alert(
            "保存榜单失败：本地存储容量不足。请尝试减少图片数量或使用外部图片链接。"
          );
        }
      } else {
        alert("保存榜单失败，请稍后重试。");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRenameClick = (ranking: any) => {
    setRenamingRankingId(ranking.id);
    setNewRankingName(ranking.name || ranking.year + " " + ranking.type);
    setShowRenameDialog(true);
  };

  const renameHistoryRanking = () => {
    if (!renamingRankingId) return;
    try {
      const rankings = JSON.parse(
        localStorage.getItem("yearlyRankings") || "[]"
      );
      const updated = rankings.map((ranking: any) =>
        ranking.id === renamingRankingId
          ? {
              ...ranking,
              name: newRankingName || ranking.year + " " + ranking.type,
            }
          : ranking
      );
      localStorage.setItem("yearlyRankings", JSON.stringify(updated));
      setHistoryRankings(updated);
      setShowRenameDialog(false);
      setRenamingRankingId(null);
      setNewRankingName("");
    } catch {
      alert("重命名历史榜单失败，请稍后重试");
    }
  };

  // 获取历史榜单记录
  const fetchHistoryRankings = () => {
    try {
      setIsSaving(true);

      // 从本地存储获取历史榜单数据
      const existingRankings = localStorage.getItem("yearlyRankings");
      const yearlyRankings = existingRankings
        ? JSON.parse(existingRankings)
        : [];
      console.log("从本地存储获取的历史榜单数据:", yearlyRankings);

      // 更新历史榜单状态
      setHistoryRankings(yearlyRankings || []);

      // 显示历史榜单对话框
      setShowHistoryDialog(true);
    } catch (error) {
      console.error("获取历史榜单失败:", error);
      alert("获取历史榜单失败，请稍后重试");
    } finally {
      setIsSaving(false);
    }
  };

  // 加载历史榜单到当前编辑
  const loadHistoryRanking = (ranking: any) => {
    coverGeneration.current++;
    setCoverProgress({ loading: false, completed: 0, total: 0, unmatched: 0 });
    // 更新当前榜单状态
    setRankingMode(ranking.type);
    setScoringMode(ranking.scoringMode);
    setRankingList(ranking.rankingList);
    setCurrentRankingId(ranking.id || null);
    setCurrentRankingName(ranking.name || ranking.year + " " + ranking.type);

    // 关闭历史榜单对话框
    setShowHistoryDialog(false);
  };

  // 删除历史榜单
  const deleteHistoryRanking = (rankingId: string | number) => {
    try {
      // 从本地存储获取现有数据
      const existingRankings = localStorage.getItem("yearlyRankings");
      let rankings = existingRankings ? JSON.parse(existingRankings) : [];

      // 过滤掉要删除的榜单
      if (typeof rankingId === "string") {
        // 如果有唯一ID，使用ID过滤
        rankings = rankings.filter((item: any) => item.id !== rankingId);
      } else {
        // 否则使用索引过滤（兼容旧数据）
        rankings.splice(rankingId, 1);
      }

      // 保存回本地存储
      localStorage.setItem("yearlyRankings", JSON.stringify(rankings));

      // 更新状态
      setHistoryRankings(rankings);

      console.log("删除历史榜单成功，剩余榜单数量:", rankings.length);
    } catch (error) {
      console.error("删除历史榜单失败:", error);
      alert("删除历史榜单失败，请稍后重试");
    }
  };

  // 关闭历史榜单对话框
  const closeHistoryDialog = () => {
    setShowHistoryDialog(false);
  };

  // 格式化分数显示：10.0显示为10，0.0显示为0，其他保持原样
  const formatScore = (score: number): string => {
    if (score === 10.0) return "10";
    if (score === 0.0) return "0";
    return score.toFixed(1);
  };

  // 计算线性映射十分制分数
  const calculateLinearScores = (items: RankingItem[]): RankingItem[] => {
    // 计算每个作品的百分制总分，解决浮点数精度问题
    const itemsWithTotalScore = items.map((item) => ({
      ...item,
      totalScore: parseFloat(
        (item.originalScore + item.integrity + item.durability).toFixed(2)
      ),
    }));

    // 根据总分降序排序
    const sortedItems = [...itemsWithTotalScore].sort(
      (a, b) => b.totalScore - a.totalScore
    );

    // 找出最高分和最低分
    const scores = sortedItems.map((item) => item.totalScore);
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
        totalScore: item.totalScore,
      }));
    }

    // 线性映射到0-10分，并重新分配排名
    return sortedItems.map((item, index) => {
      const normalizedScore =
        ((item.totalScore - minScore) / (maxScore - minScore)) * 10;
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
        totalScore: item.totalScore,
      };
    });
  };

  // All formats use the same DOCX as their rendering source.
  const exportRanking = async (format: RankingExportFormat) => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError('');
    try {
      await downloadRanking(rankingList, scoringMode === 'scoring', format,
        `MeloRank_${currentYear}_${rankingMode}`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '??????????');
    } finally { setIsExporting(false); }
  };

  return (
    <div className="yearly-ranking-page">
      <h2>
        {"MeloRank · "}
        {currentYear}
        {" 年度榜单"}
      </h2>
      <p className="platform-position">
        {
          "导出使用 A4 窄页边距，PDF 与图片由同一份 DOCX 渲染。每页图片会打包为 ZIP。"
        }
        <br />
        {"历史榜单保存于浏览器中，各个浏览器之间看不到彼此的数据"}
      </p>
      {coverProgress.total > 0 && <p role="status" className="ranking-import-status">
        {coverProgress.loading ? `正在匹配封面 ${coverProgress.completed}/${coverProgress.total}…` : `封面匹配完成：${coverProgress.completed - coverProgress.unmatched}/${coverProgress.total}`}
        {coverProgress.unmatched > 0 && `；${coverProgress.unmatched} 项未找到准确匹配，可手动上传封面`}
      </p>}
      {isExporting && <p role="status">正在生成文档与分页，请稍候…</p>}
      {exportError && <p role="alert" className="ranking-error">{exportError}</p>}
      <div
        className="ranking-mode-selector"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <label htmlFor="ranking-mode">{"选择榜单类型："}</label>
          <select
            id="ranking-mode"
            value={rankingMode}
            onChange={(Ne) => setRankingMode(Ne.target.value)}
          >
            {rankingModes.map((Ne) => (
              <option value={Ne} key={Ne}>
                {Ne}
              </option>
            ))}
          </select>
          <label htmlFor="scoring-mode" style={{ marginLeft: "15px" }}>
            {"选择是否评分："}
          </label>
          <select
            id="scoring-mode"
            value={scoringMode}
            onChange={(Ne) =>
              setScoringMode(Ne.target.value as "scoring" | "non-scoring")
            }
          >
            {scoringModes.map((Ne) => (
              <option value={Ne.value} key={Ne.value}>
                {Ne.label}
              </option>
            ))}
          </select>
        </div>
        <button className="export-btn" onClick={() => setShowImportDialog(!0)}>
          {"导入排行榜"}
        </button>
      </div>
      <div className="ranking-container">
        <div className="ranking-form">
          <h3>
            {"添加到 "}
            {rankingMode}
          </h3>
          <div className="yearly-search-container" ref={searchInputRef}>
            <div className="yearly-search-input-wrapper">
              <input
                type="text"
                className="yearly-search-input"
                placeholder="搜索歌曲..."
                value={searchQuery}
                onChange={(Ne) => {
                  const je = Ne.target.value;
                  setSearchQuery(je), debouncedSearch(je);
                }}
                onKeyPress={handleSearchKeyDown}
              />
            </div>
            {isSearching && (
              <div className="yearly-search-loading">{"正在搜索..."}</div>
            )}
            {searchResults && (
              <div className="yearly-search-results" ref={searchResultsRef}>
                {(() => {
                  let Ne: any[] = [];
                  const je = searchResults.response || searchResults,
                    ze = je.data || je;
                  return (
                    ze.song && ze.song.list && (Ne = ze.song.list),
                    Ne.length > 0 ? (
                      Ne.map((Me) => {
                        var st;
                        return !Me || !Me.songmid ? null : (
                          <div
                            className="yearly-search-result-item"
                            onClick={() => handleSearchResultClick(Me)}
                            key={Me.songmid}
                          >
                            <div className="yearly-search-result-cover">
                              {Me.albummid && (
                                <img
                                  src={`https://y.qq.com/music/photo_new/T002R300x300M000${Me.albummid}.jpg`}
                                  alt={Me.songname || "歌曲封面"}
                                />
                              )}
                            </div>
                            <div className="yearly-search-result-info">
                              <div className="yearly-search-result-title">
                                {Me.songname || "未知歌曲"}
                              </div>
                              <div className="yearly-search-result-subtitle">
                                {((st = Me.singer) == null
                                  ? void 0
                                  : st
                                      .map((gt: any) => gt.name || "未知歌手")
                                      .join(", ")) || "未知歌手"}
                                {" · "}
                                {Me.albumname || "未知专辑"}
                              </div>
                            </div>
                            <button
                              className="cover-preview-btn"
                              onClick={(gt) => {
                                if ((gt.stopPropagation(), Me.albummid)) {
                                  const ft = `https://y.qq.com/music/photo_new/T002R300x300M000${Me.albummid}.jpg`;
                                  showCoverPreview(ft);
                                }
                              }}
                              title="查看封面"
                            >
                              {"弹出封面"}
                            </button>
                          </div>
                        );
                      }).filter(Boolean)
                    ) : (
                      <div className="yearly-search-no-results">
                        {"没有找到相关结果"}
                      </div>
                    )
                  );
                })()}
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{"封面图片"}</label>
              <div className="cover-upload-container">
                <input
                  type="text"
                  name="coverUrl"
                  placeholder="输入图片URL/粘贴图片"
                  value={coverUrl}
                  onChange={(Ne) => {
                    setCoverUrl(Ne.target.value),
                      setCoverPreview(Ne.target.value);
                  }}
                  onPaste={(Ne) => {
                    var ze;
                    const je =
                      (ze = Ne.clipboardData) == null ? void 0 : ze.items;
                    if (je) {
                      for (let Me = 0; Me < je.length; Me++)
                        if (je[Me].type.indexOf("image") !== -1) {
                          const st = je[Me].getAsFile();
                          if (st) {
                            const gt = new FileReader();
                            (gt.onload = (ft) => {
                              var Fr;
                              const lr =
                                (Fr = ft.target) == null ? void 0 : Fr.result;
                              if (typeof lr === "string") {
                                setCoverUrl(lr);
                                setCoverPreview(lr);
                              }
                            }),
                              gt.readAsDataURL(st),
                              Ne.preventDefault();
                            break;
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
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="upload-btn"
                  onClick={triggerFileSelect}
                >
                  {"上传本地图片"}
                </button>
              </div>
              {coverPreview && (
                <div className="cover-preview">
                  <img src={coverPreview} alt="封面预览" />
                </div>
              )}
            </div>
            <div className="form-group">
              <label>{"作品名称"}</label>
              <input
                type="text"
                name="title"
                placeholder="输入歌曲/专辑名称"
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label>{"艺术家"}</label>
              <input
                type="text"
                name="artist"
                placeholder="输入艺术家名称"
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label>{"评分"}</label>
              <input
                type="number"
                name="score"
                min="0"
                max="100"
                step="0.01"
                placeholder="0-100"
                autoComplete="off"
                disabled={scoringMode === "non-scoring"}
              />
            </div>
            <div className="form-group">
              <label>{"整体性"}</label>
              <div className="score-adjuster">
                <div className="score-input-with-arrows">
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.5"
                    defaultValue="0.0"
                    placeholder="0-2"
                    readOnly={!0}
                    ref={integrityRef}
                    disabled={scoringMode === "non-scoring"}
                  />
                  <div className="arrow-controls">
                    <button
                      type="button"
                      className="arrow-btn arrow-up"
                      onClick={() => adjustScore(integrityRef, !0)}
                      disabled={scoringMode === "non-scoring"}
                    >
                      {"▲"}
                    </button>
                    <button
                      type="button"
                      className="arrow-btn arrow-down"
                      onClick={() => adjustScore(integrityRef, !1)}
                      disabled={scoringMode === "non-scoring"}
                    >
                      {"▼"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>{"保值度"}</label>
              <div className="score-adjuster">
                <div className="score-input-with-arrows">
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.5"
                    defaultValue="0.0"
                    placeholder="0-2"
                    readOnly={!0}
                    ref={durabilityRef}
                    disabled={scoringMode === "non-scoring"}
                  />
                  <div className="arrow-controls">
                    <button
                      type="button"
                      className="arrow-btn arrow-up"
                      onClick={() => adjustScore(durabilityRef, !0)}
                      disabled={scoringMode === "non-scoring"}
                    >
                      {"▲"}
                    </button>
                    <button
                      type="button"
                      className="arrow-btn arrow-down"
                      onClick={() => adjustScore(durabilityRef, !1)}
                      disabled={scoringMode === "non-scoring"}
                    >
                      {"▼"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>{"评价"}</label>
              <textarea
                name="review"
                rows={4}
                placeholder="写下你的评价..."
                autoComplete="off"
              />
            </div>
            <button type="submit" className="add-btn">
              {editMode ? "修改完成" : "添加到榜单"}
            </button>
          </form>
        </div>
        <div className="ranking-display">
          <div className="ranking-display-header">
            <div className="ranking-title-with-restore">
              <h3>
                {currentYear} {rankingMode}
              </h3>
              <button className="restore-btn" onClick={restoreDefaultRanking}>
                {"恢复默认榜单"}
              </button>
            </div>
            <div className="export-buttons">
              <button
                className="export-btn"
                onClick={handleSaveClick}
                disabled={isSaving}
              >
                {isSaving ? "保存中..." : "保存榜单"}
              </button>
              <button
                className="export-btn"
                onClick={handleSaveAsClick}
                disabled={isSaving}
              >
                {isSaving ? "保存中..." : "另存为"}
              </button>
              <button
                className="export-btn"
                onClick={fetchHistoryRankings}
                disabled={isSaving}
              >
                {"历史榜单记录"}
              </button>
              <button className="export-btn" disabled={isExporting || coverProgress.loading} onClick={() => exportRanking('docx')}>
                {"导出 DOCX"}
              </button>
              <button className="export-btn" disabled={isExporting || coverProgress.loading} onClick={() => exportRanking('pdf')}>导出 PDF</button>
              <button className="export-btn" disabled={isExporting || coverProgress.loading} onClick={() => exportRanking('long-image')}>导出长图片</button>
              <button className="export-btn" disabled={isExporting || coverProgress.loading} onClick={() => exportRanking('pages')}>导出每页图片</button>
            </div>
          </div>
          <div className="user-ranking-list">
            {scoringMode === "non-scoring"
              ? rankingList.map((Ne, je) => (
                  <div className="user-rank-item" key={Ne.id}>
                    <div className="user-rank-number">{je + 1}</div>
                    <div className="user-rank-cover">
                      <img
                        src={
                          Ne.coverUrl ||
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E"
                        }
                        alt={`${Ne.title} 封面`}
                        onClick={() =>
                          showCoverPreview(
                            Ne.coverUrl ||
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E"
                          )
                        }
                        style={{ cursor: "pointer" }}
                      />
                    </div>
                    <div className="user-rank-content">
                      <div className="user-rank-title">{Ne.title}</div>
                      <div className="user-rank-artist">{Ne.artist}</div>
                      <div className="user-rank-review">
                        {Ne.review || "没有评价的义务！"}
                      </div>
                    </div>
                    <div
                      className="user-rank-actions"
                      style={{ marginLeft: "auto" }}
                    >
                      <div className="move-buttons">
                        <button
                          className="action-btn move-btn"
                          onClick={() => moveItemUp(Ne)}
                          disabled={je === 0}
                          title="上移"
                        >
                          {"▲"}
                        </button>
                        <button
                          className="action-btn move-btn"
                          onClick={() => moveItemDown(Ne)}
                          disabled={je === rankingList.length - 1}
                          title="下移"
                        >
                          {"▼"}
                        </button>
                      </div>
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEdit(Ne)}
                      >
                        {"编辑"}
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(Ne.id)}
                      >
                        {"删除"}
                      </button>
                      <button
                        className="action-btn cover-btn"
                        onClick={() =>
                          showCoverPreview(
                            Ne.coverUrl ||
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E"
                          )
                        }
                        title="查看封面"
                      >
                        {"弹出封面"}
                      </button>
                    </div>
                  </div>
                ))
              : rankingList.map((Ne) => (
                  <div className="user-rank-item" key={Ne.id}>
                    <div className="user-rank-number">{Ne.rank}</div>
                    <div className="user-rank-cover">
                      <img
                        src={
                          Ne.coverUrl ||
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E"
                        }
                        alt={`${Ne.title} 封面`}
                        onClick={() =>
                          showCoverPreview(
                            Ne.coverUrl ||
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='Arial' font-size='14'%3EMeloRank%3C/text%3E%3C/svg%3E"
                          )
                        }
                        style={{ cursor: "pointer" }}
                      />
                    </div>
                    <div className="user-rank-content">
                      <div className="user-rank-title">{Ne.title}</div>
                      <div className="user-rank-artist">{Ne.artist}</div>
                      <div className="user-rank-review">
                        {Ne.review || "没有评价的义务！"}
                      </div>
                    </div>
                    <div className="user-rank-score">
                      <div className="user-rank-bonus">
                        {Ne.integrity > 0 && (
                          <span className="bonus-item">
                            <span className="bonus-label">{"整体性"}</span>
                            <span className="bonus-star">{"⭐"}</span>
                            <span className="bonus-value">
                              {"+"}
                              {Ne.integrity}
                            </span>
                          </span>
                        )}
                        {Ne.durability > 0 && (
                          <span className="bonus-item">
                            <span className="bonus-label">{"保值度"}</span>
                            <span className="bonus-star">{"⭐"}</span>
                            <span className="bonus-value">
                              {"+"}
                              {Ne.durability}
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="score-box">{Ne.originalScore}</div>
                    </div>
                    <div className="user-rank-actions">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEdit(Ne)}
                      >
                        {"编辑"}
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(Ne.id)}
                      >
                        {"删除"}
                      </button>
                      <button
                        className="action-btn cover-btn"
                        onClick={() => showCoverPreview(Ne.coverUrl)}
                        title="查看封面"
                      >
                        {"弹出封面"}
                      </button>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
      {showEditDialog && (
        <div className="confirm-dialog-overlay">
          <div
            className="confirm-dialog"
            style={{ width: "600px", maxHeight: "80vh", overflowY: "auto" }}
          >
            <div className="confirm-dialog-header">
              <h4>{"编辑排名项"}</h4>
              <button
                className="confirm-dialog-close"
                onClick={() => {
                  setShowEditDialog(!1),
                    setEditMode(!1),
                    setEditingItemId(null),
                    setEditingItem(null);
                }}
              >
                {"×"}
              </button>
            </div>
            <div className="confirm-dialog-content">
              <form id="edit-form" onSubmit={handleSubmit}>
                <div className="yearly-search-container" ref={searchInputRef}>
                  <div className="yearly-search-input-wrapper">
                    <input
                      type="text"
                      className="yearly-search-input"
                      placeholder="搜索歌曲..."
                      value={searchQuery}
                      onChange={(Ne) => {
                        const je = Ne.target.value;
                        setSearchQuery(je), debouncedSearch(je);
                      }}
                      onKeyPress={handleSearchKeyDown}
                    />
                  </div>
                  {isSearching && (
                    <div className="yearly-search-loading">{"正在搜索..."}</div>
                  )}
                  {searchResults && (
                    <div
                      className="yearly-search-results"
                      ref={searchResultsRef}
                    >
                      {(() => {
                        let Ne: any[] = [];
                        const je = searchResults.response || searchResults,
                          ze = je.data || je;
                        return (
                          ze.song && ze.song.list && (Ne = ze.song.list),
                          Ne.length > 0 ? (
                            Ne.map((Me) => {
                              var st;
                              return !Me || !Me.songmid ? null : (
                                <div
                                  className="yearly-search-result-item"
                                  onClick={() => handleSearchResultClick(Me)}
                                  key={Me.songmid}
                                >
                                  <div className="yearly-search-result-cover">
                                    {Me.albummid && (
                                      <img
                                        src={`https://y.qq.com/music/photo_new/T002R300x300M000${Me.albummid}.jpg`}
                                        alt={Me.songname || "歌曲封面"}
                                      />
                                    )}
                                  </div>
                                  <div className="yearly-search-result-info">
                                    <div className="yearly-search-result-title">
                                      {Me.songname || "未知歌曲"}
                                    </div>
                                    <div className="yearly-search-result-subtitle">
                                      {((st = Me.singer) == null
                                        ? void 0
                                        : st
                                            .map(
                                              (gt: any) => gt.name || "未知歌手"
                                            )
                                            .join(", ")) || "未知歌手"}
                                      {" · "}
                                      {Me.albumname || "未知专辑"}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="cover-preview-btn"
                                    onClick={(gt) => {
                                      if ((gt.stopPropagation(), Me.albummid)) {
                                        const ft = `https://y.qq.com/music/photo_new/T002R300x300M000${Me.albummid}.jpg`;
                                        showCoverPreview(ft);
                                      }
                                    }}
                                    title="查看封面"
                                  >
                                    {"弹出封面"}
                                  </button>
                                </div>
                              );
                            }).filter(Boolean)
                          ) : (
                            <div className="yearly-search-no-results">
                              {"没有找到相关结果"}
                            </div>
                          )
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>{"封面图片"}</label>
                  <div className="cover-upload-container">
                    <input
                      type="text"
                      name="coverUrl"
                      placeholder="输入图片URL/粘贴图片"
                      value={coverUrl}
                      onChange={(Ne) => {
                        setCoverUrl(Ne.target.value),
                          setCoverPreview(Ne.target.value);
                      }}
                      onPaste={(Ne) => {
                        var ze;
                        const je =
                          (ze = Ne.clipboardData) == null ? void 0 : ze.items;
                        if (je) {
                          for (let Me = 0; Me < je.length; Me++)
                            if (je[Me].type.indexOf("image") !== -1) {
                              const st = je[Me].getAsFile();
                              if (st) {
                                const gt = new FileReader();
                                (gt.onload = (ft) => {
                                  var Fr;
                                  const lr =
                                    (Fr = ft.target) == null
                                      ? void 0
                                      : Fr.result;
                                  if (typeof lr === "string") {
                                    setCoverUrl(lr);
                                    setCoverPreview(lr);
                                  }
                                }),
                                  gt.readAsDataURL(st),
                                  Ne.preventDefault();
                                break;
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
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      className="upload-btn"
                      onClick={triggerFileSelect}
                    >
                      {"上传本地图片"}
                    </button>
                  </div>
                  {coverPreview && (
                    <div className="cover-preview">
                      <img src={coverPreview} alt="封面预览" />
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>{"作品名称"}</label>
                  <input
                    type="text"
                    name="title"
                    placeholder="输入歌曲/专辑名称"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label>{"艺术家"}</label>
                  <input
                    type="text"
                    name="artist"
                    placeholder="输入艺术家名称"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label>{"评分"}</label>
                  <input
                    type="number"
                    name="score"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0-100"
                    autoComplete="off"
                    disabled={scoringMode === "non-scoring"}
                  />
                </div>
                <div className="form-group">
                  <label>{"整体性"}</label>
                  <div className="score-adjuster">
                    <div className="score-input-with-arrows">
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.5"
                        defaultValue="0.0"
                        placeholder="0-2"
                        readOnly={!0}
                        ref={integrityRef}
                        disabled={scoringMode === "non-scoring"}
                      />
                      <div className="arrow-controls">
                        <button
                          type="button"
                          className="arrow-btn arrow-up"
                          onClick={() => adjustScore(integrityRef, !0)}
                          disabled={scoringMode === "non-scoring"}
                        >
                          {"▲"}
                        </button>
                        <button
                          type="button"
                          className="arrow-btn arrow-down"
                          onClick={() => adjustScore(integrityRef, !1)}
                          disabled={scoringMode === "non-scoring"}
                        >
                          {"▼"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>{"保值度"}</label>
                  <div className="score-adjuster">
                    <div className="score-input-with-arrows">
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.5"
                        defaultValue="0.0"
                        placeholder="0-2"
                        readOnly={!0}
                        ref={durabilityRef}
                        disabled={scoringMode === "non-scoring"}
                      />
                      <div className="arrow-controls">
                        <button
                          type="button"
                          className="arrow-btn arrow-up"
                          onClick={() => adjustScore(durabilityRef, !0)}
                          disabled={scoringMode === "non-scoring"}
                        >
                          {"▲"}
                        </button>
                        <button
                          type="button"
                          className="arrow-btn arrow-down"
                          onClick={() => adjustScore(durabilityRef, !1)}
                          disabled={scoringMode === "non-scoring"}
                        >
                          {"▼"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>{"评价"}</label>
                  <textarea
                    name="review"
                    rows={4}
                    placeholder="写下你的评价..."
                    autoComplete="off"
                  />
                </div>
              </form>
            </div>
            <div className="confirm-dialog-footer">
              <button
                type="submit"
                form="edit-form"
                className="confirm-dialog-confirm"
              >
                {"保存修改"}
              </button>
              <button
                type="button"
                className="confirm-dialog-cancel"
                onClick={() => {
                  setShowEditDialog(!1),
                    setEditMode(!1),
                    setEditingItemId(null),
                    setEditingItem(null);
                }}
              >
                {"取消"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showConfirmDialog && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <div className="confirm-dialog-header">
              <h4>{"确认恢复默认榜单"}</h4>
              <button
                className="confirm-dialog-close"
                onClick={cancelRestoreDefault}
              >
                {"×"}
              </button>
            </div>
            <div className="confirm-dialog-content">
              <p>{"将清除所输入内容，是否确认清除？（推荐先保存）"}</p>
            </div>
            <div className="confirm-dialog-footer">
              <button
                className="confirm-dialog-confirm"
                onClick={confirmRestoreDefault}
              >
                {"确认清除"}
              </button>
              <button
                className="confirm-dialog-cancel"
                onClick={cancelRestoreDefault}
              >
                {"取消"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSaveDialog && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <div className="confirm-dialog-header">
              <h4>{"保存榜单"}</h4>
              <button
                className="confirm-dialog-close"
                onClick={() => {
                  setShowSaveDialog(!1), setRankingName("");
                }}
              >
                {"×"}
              </button>
            </div>
            <div className="confirm-dialog-content">
              <div className="form-group">
                <label>{"榜单名称"}</label>
                <input
                  type="text"
                  placeholder={`例如：${rankingMode}_${currentYear}_自定义名称`}
                  value={rankingName}
                  onChange={(Ne) => setRankingName(Ne.target.value)}
                  autoComplete="off"
                  maxLength={50}
                />
                <small>{"不填写则使用默认名称"}</small>
              </div>
              <div className="form-info">
                <p>
                  <strong>{"榜单信息："}</strong>
                </p>
                <p>
                  {"类型："}
                  {rankingMode}
                </p>
                <p>
                  {"评分模式："}
                  {scoringMode === "scoring" ? "评分" : "不评分"}
                </p>
                <p>
                  {"包含 "}
                  {rankingList.length}
                  {" 个项目"}
                </p>
              </div>
            </div>
            <div className="confirm-dialog-footer">
              <button
                className="confirm-dialog-confirm"
                onClick={saveRanking}
                disabled={isSaving}
              >
                {isSaving ? "保存中..." : "保存"}
              </button>
              <button
                className="confirm-dialog-cancel"
                onClick={() => {
                  setShowSaveDialog(!1), setRankingName("");
                }}
              >
                {"取消"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showRenameDialog && (
        <div className="confirm-dialog-overlay" style={{ zIndex: 10001 }}>
          <div className="confirm-dialog" style={{ zIndex: 10002 }}>
            <div className="confirm-dialog-header">
              <h4>{"重命名榜单"}</h4>
              <button
                className="confirm-dialog-close"
                onClick={() => {
                  setShowRenameDialog(!1),
                    setRenamingRankingId(null),
                    setNewRankingName("");
                }}
              >
                {"×"}
              </button>
            </div>
            <div className="confirm-dialog-content">
              <div className="form-group">
                <label>{"新名称"}</label>
                <input
                  type="text"
                  placeholder="输入新的榜单名称"
                  value={newRankingName}
                  onChange={(Ne) => setNewRankingName(Ne.target.value)}
                  autoComplete="off"
                  maxLength={50}
                />
                <small>{"不填写则使用默认名称"}</small>
              </div>
            </div>
            <div className="confirm-dialog-footer">
              <button
                className="confirm-dialog-confirm"
                onClick={renameHistoryRanking}
                disabled={isSaving}
              >
                {"保存"}
              </button>
              <button
                className="confirm-dialog-cancel"
                onClick={() => {
                  setShowRenameDialog(!1),
                    setRenamingRankingId(null),
                    setNewRankingName("");
                }}
              >
                {"取消"}
              </button>
            </div>
          </div>
        </div>
      )}
      {saveSuccess && (
        <div className="save-success-toast">{"榜单保存成功！"}</div>
      )}
      {showHistoryDialog && (
        <div className="confirm-dialog-overlay">
          <div
            className="confirm-dialog"
            style={{ width: "800px", maxHeight: "600px", overflowY: "auto" }}
          >
            <div className="confirm-dialog-header">
              <h4>{"历史榜单记录"}</h4>
              <button
                className="confirm-dialog-close"
                onClick={closeHistoryDialog}
              >
                {"×"}
              </button>
            </div>
            <div className="confirm-dialog-content">
              {historyRankings.length === 0 ? (
                <p>{"暂无历史榜单记录"}</p>
              ) : (
                <div className="history-rankings-list">
                  {historyRankings.map((Ne, je) => (
                    <div className="history-ranking-item" key={Ne.id || je}>
                      <div className="history-ranking-info">
                        <h5>{Ne.name || `${Ne.year} ${Ne.type}`}</h5>
                        <p>
                          {"类型："}
                          {Ne.type}
                        </p>
                        <p>
                          {"评分模式："}
                          {Ne.scoringMode === "scoring" ? "评分" : "不评分"}
                        </p>
                        <p>
                          {"创建时间："}
                          {new Date(Ne.createdAt).toLocaleString()}
                        </p>
                        <p>
                          {"包含 "}
                          {Ne.rankingList.length}
                          {" 个项目"}
                        </p>
                      </div>
                      <div
                        className="history-ranking-actions"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <button
                          className="confirm-dialog-confirm"
                          onClick={() => loadHistoryRanking(Ne)}
                          style={{ width: "120px" }}
                        >
                          {"加载此榜单"}
                        </button>
                        <button
                          className="confirm-dialog-confirm"
                          onClick={() => handleRenameClick(Ne)}
                          style={{
                            width: "120px",
                            backgroundColor: "#1890ff",
                            borderColor: "#1890ff",
                          }}
                        >
                          {"重命名"}
                        </button>
                        <button
                          className="confirm-dialog-cancel"
                          onClick={() => deleteHistoryRanking(Ne.id || je)}
                          style={{
                            backgroundColor: "#ff4d4f",
                            borderColor: "#ff4d4f",
                            color: "#fff",
                            width: "120px",
                          }}
                        >
                          {"删除"}
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
                {"关闭"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showImportDialog && (
        <div className="confirm-dialog-overlay">
          <div
            className="confirm-dialog"
            style={{ width: "800px", overflow: "hidden" }}
          >
            <div className="confirm-dialog-header">
              <h4>{"导入排行榜"}</h4>
              <button
                className="confirm-dialog-close"
                onClick={() => setShowImportDialog(!1)}
              >
                {"×"}
              </button>
            </div>
            <div className="confirm-dialog-content">
              <p>
                {"将您编写的排行榜粘贴至此，我们会为您自动填充排行榜，格式为："}
              </p>
              <div
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "10px",
                  borderRadius: "4px",
                  margin: "10px 0",
                  overflowX: "auto",
                  fontSize: "14px",
                  lineHeight: "1.5",
                  color: "#000",
                }}
              >
                <div style={{ marginBottom: "10px" }}>
                  <strong>{"月.日 作品名 - 作者名 原始分数+整体性++保值度"}</strong>
                  <br />
                  <span style={{ marginLeft: "20px" }}>
                    {"（月.日 作品名 - 作者名 原始分数+整体性++保值度）"}
                  </span>
                </div>
                <p><strong>或者（任选一种格式，也可混合粘贴）</strong></p>
                <div>
                  <strong>{"作品名 - 作者名"}</strong>
                  <br />
                  <span style={{ marginLeft: "20px" }}>
                    {"（作品名 - 作者名）"}
                  </span>
                </div>
                <p>评分可省略；填写时分数前必须有空格。+ 表示整体性，++ 表示保值度。例：Not Anymore - 16 43；CRACK CODE - Kep1er 55.4。</p>
                <p>不评分模式会完整保留作者字段，包括数字结尾的姓名。</p>
              </div>
              <textarea
                className="import-ranking-textarea"
                style={{
                  width: "100%",
                  height: "200px",
                  marginTop: "10px",
                  backgroundColor: "white",
                  color: "#333",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "10px",
                  fontSize: "14px",
                }}
                placeholder="请在此粘贴排行榜..."
                value={importedRankingText}
                onChange={(Ne) => setImportedRankingText(Ne.target.value)}
              />
              {importError && <p role="alert" className="ranking-error" style={{ whiteSpace: 'pre-wrap' }}>{importError}</p>}
            </div>
            <div className="confirm-dialog-footer">
              <button
                className="confirm-dialog-confirm"
                onClick={handleImportRanking}
              >
                {"确认导入"}
              </button>
              <button
                className="confirm-dialog-cancel"
                onClick={() => {
                  setShowImportDialog(!1), setImportedRankingText("");
                }}
              >
                {"取消"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
