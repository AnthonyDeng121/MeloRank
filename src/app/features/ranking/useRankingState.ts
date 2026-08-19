import { useState } from 'react';
import type { ScoringMode } from './rankingLogic';

/** 排行榜编辑区域的集中状态。 */
export function useRankingState(initialMode: ScoringMode = 'scoring') {
  const [coverUrl, setCoverUrl] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyRankings, setHistoryRankings] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [scoringMode, setScoringMode] = useState<ScoringMode>(initialMode);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importedRankingText, setImportedRankingText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  return {
    coverUrl, setCoverUrl, coverPreview, setCoverPreview,
    editMode, setEditMode, showConfirmDialog, setShowConfirmDialog,
    showHistoryDialog, setShowHistoryDialog, historyRankings, setHistoryRankings,
    isSaving, setIsSaving, saveSuccess, setSaveSuccess,
    showSearchResults, setShowSearchResults, searchError, setSearchError,
    scoringMode,
    setScoringMode,
    editingItemId,
    setEditingItemId,
    showImportDialog,
    setShowImportDialog,
    importedRankingText,
    setImportedRankingText,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    setIsSearching
  };
}
