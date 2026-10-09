import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import {
  AdvancedFilterGroup,
  BasicFilterOptions,
  BatchResult,
  ImageItem,
  SortOptions,
} from './types/gallery';
import { scanFolder, updateImageMetadata } from './services/api';
import { filterImages, sortImages } from './utils/filterEngine';

import { GalleryHeader } from './components/GalleryHeader';
import { SourceSidebar } from './components/SourceSidebar';
import { FilterPanel } from './components/FilterPanel';
import { GalleryGrid } from './components/GalleryGrid';
import { InspectorPanel } from './components/InspectorPanel';
import { WorkspaceStatusBar } from './components/WorkspaceStatusBar';
import { FullscreenViewer } from './components/FullscreenViewer';
import { HashtagModal } from './components/HashtagModal';
import { CommentModal } from './components/CommentModal';
import { BatchOperationsModal } from './components/BatchOperationsModal';
import { FolderPickerModal } from './components/FolderPickerModal';
import { SettingsModal } from './components/SettingsModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';

import { ThumbnailControls } from './components/ThumbnailControls';
import { AIAnalysisModal } from './components/AIAnalysisModal';
import { AIStatisticsPage } from './components/AIStatisticsPage';
import { AIProgress } from './components/AIProgress';
import type { AIJob } from './types/ai';
import { analysisSummary, shouldNotifyAnalysisDone } from './utils/aiProgress';
import { useAccess } from './security/AccessProvider';
import { useAI } from './hooks/useAI';
import { fetchAIResults } from './services/ai';
import { dominantRatio, ratioValue, readThumbnailSettings, THUMBNAIL_SETTINGS_KEY } from './utils/thumbnailSettings';

const DEFAULT_FILTERS: BasicFilterOptions = {
  directoryPath: '',
  includeSubdirs: true,
  selectedTypes: [],
  aspectRatio: 'any',
  hashtags: [],
  hashtagOperator: 'AND',
  searchQuery: '',
};

const DEFAULT_SORT: SortOptions = {
  field: 'createdAt',
  direction: 'desc',
};

const DEFAULT_ADVANCED_GROUP: AdvancedFilterGroup = {
  id: 'root',
  logicalOp: 'AND',
  rules: [],
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export default function App() {
  const access = useAccess();
  const [allImages, setAllImages] = useState<ImageItem[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [directoryPath, setDirectoryPath] = useState('');
  const scanRequest = useRef(0);
  const [completedScanVersion, setCompletedScanVersion] = useState(0);
  const [includeSubdirs, setIncludeSubdirs] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCompletedScan, setHasCompletedScan] = useState(false);
  const [thumbnailSettings, setThumbnailSettings] = useState(readThumbnailSettings);
  const autoRatio = useMemo(() => dominantRatio(allImages), [allImages]);
  const thumbnailRatio = thumbnailSettings.ratio === 'auto' ? autoRatio : ratioValue(thumbnailSettings.ratio);
  const [deletionToast, setDeletionToast] = useState<BatchResult | null>(null);
  const [ratingToast, setRatingToast] = useState<{ count: number; score: number; failedCount: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(THUMBNAIL_SETTINGS_KEY, JSON.stringify(thumbnailSettings)); } catch { /* Storage may be unavailable. */ }
  }, [thumbnailSettings]);

  useEffect(() => {
    if (!deletionToast || deletionToast.errors?.length) return;
    const timer = window.setTimeout(() => setDeletionToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [deletionToast]);

  useEffect(() => {
    if (!ratingToast || ratingToast.failedCount) return;
    const timer = window.setTimeout(() => setRatingToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [ratingToast]);

  const [notice, setNotice] = useState<string | null>(null);

  const [filters, setFilters] = useState<BasicFilterOptions>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortOptions>(DEFAULT_SORT);
  const [advancedGroup, setAdvancedGroup] = useState<AdvancedFilterGroup>(DEFAULT_ADVANCED_GROUP);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(() => window.innerWidth > 850);
  const [quickView, setQuickView] = useState<'all' | 'rated' | 'tagged'>('all');

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionAnchor = useRef<string | null>(null);
  const [gridColumns, setGridColumns] = useState(1);

  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [isWindowFullscreen, setIsWindowFullscreen] = useState(Boolean(document.fullscreenElement));
  const fullscreenPending = useRef(false);

  useEffect(() => {
    const syncFullscreen = () => setIsWindowFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleWindowFullscreen = useCallback(async () => {
    if (fullscreenPending.current) return;
    fullscreenPending.current = true;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        // The toolbar disappears; don't leave keyboard focus on a hidden control.
        if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.gallery-toolbar')) {
          document.activeElement.blur();
        }
      }
    } catch (error) {
      setNotice(getErrorMessage(error, 'Fullscreen could not be changed. Please try again.'));
    } finally {
      fullscreenPending.current = false;
    }
  }, []);
  const [isHashtagModalOpen, setIsHashtagModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isAIStatisticsOpen, setIsAIStatisticsOpen] = useState(false);
  const [scannedDirectory, setScannedDirectory] = useState('');
  const [scannedSubdirs, setScannedSubdirs] = useState(true);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const ai = useAI(() => {
    if (!allImages.length) return;
    void fetchAIResults(allImages.map(image => image.path)).then(results => {
      setAllImages(current => current.map(image => results[image.path] ? { ...image, ai: results[image.path] } : image));
    }).catch(error => setNotice(getErrorMessage(error, 'Could not load AI results.')));
  });

  const [dismissedAnalysisJobId, setDismissedAnalysisJobId] = useState<string | null>(null);
  const [analysisToast, setAnalysisToast] = useState<AIJob | null>(null);
  const previousAIJob = useRef<AIJob | null>(null);
  useEffect(() => {
    const next = ai.status?.job ?? null;
    if (shouldNotifyAnalysisDone(previousAIJob.current, next, isAIModalOpen)) setAnalysisToast(next);
    previousAIJob.current = next;
  }, [ai.status?.job, isAIModalOpen]);
  useEffect(() => {
    if (!analysisToast) return;
    const timer = window.setTimeout(() => setAnalysisToast(null), 10000);
    return () => window.clearTimeout(timer);
  }, [analysisToast]);

  const handleScan = useCallback(async (pathOverride?: string) => {
    const request = ++scanRequest.current;
    setIsScanning(true);
    setNotice(null);
    try {
      const result = await scanFolder(pathOverride || directoryPath, includeSubdirs);
      if (request !== scanRequest.current) return;
      setScannedDirectory(result.directory);
      setScannedSubdirs(includeSubdirs);
      setAllImages(result.images);
      setAvailableTypes(result.availableTypes);
      setDirectoryPath(result.directory);
      // Let the filtered, sorted view choose its first image, not the scanner's file order.
      setFocusedId(null);
      setCompletedScanVersion((version) => version + 1);
      setSelectedIds(new Set());
      selectionAnchor.current = null;
      setHasCompletedScan(true);
    } catch (error) {
      if (request !== scanRequest.current) return;
      console.error('Failed to scan folder:', error);
      setNotice(getErrorMessage(error, 'The folder could not be scanned. Check the path and try again.'));
    } finally {
      if (request === scanRequest.current) setIsScanning(false);
    }
  }, [directoryPath, includeSubdirs]);

  useEffect(() => {
    void handleScan();
    return () => { scanRequest.current += 1; };
    // An empty path resumes this account's last scanned folder on the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAndSortedImages = useMemo(() => {
    const combinedFilters = { ...filters, searchQuery };
    return sortImages(filterImages(allImages, combinedFilters, advancedGroup), sort);
  }, [allImages, filters, searchQuery, advancedGroup, sort]);

  const processedImages = useMemo(() => {
    if (quickView === 'rated') return filteredAndSortedImages.filter((image) => image.score > 0);
    if (quickView === 'tagged') return filteredAndSortedImages.filter((image) => image.hashtags.length > 0);
    return filteredAndSortedImages;
  }, [filteredAndSortedImages, quickView]);

  useEffect(() => {
    if (processedImages.length === 0) {
      if (focusedId !== null) setFocusedId(null);
      return;
    }
    if (!focusedId || !processedImages.some((image) => image.id === focusedId)) {
      setFocusedId(processedImages[0].id);
    }
  }, [focusedId, processedImages]);

  const focusedIndex = useMemo(() => {
    if (!focusedId) return 0;
    const index = processedImages.findIndex((image) => image.id === focusedId);
    return index < 0 ? 0 : index;
  }, [focusedId, processedImages]);

  const focusedImage = processedImages[focusedIndex] ?? null;
  const selectedImages = useMemo(
    () => allImages.filter((image) => selectedIds.has(image.id)),
    [allImages, selectedIds]
  );

  const hasActiveFilters = useMemo(
    () => Boolean(
      searchQuery ||
      filters.selectedTypes.length ||
      filters.minWidth ||
      filters.maxWidth ||
      filters.minHeight ||
      filters.maxHeight ||
      filters.aspectRatio !== 'any' ||
      filters.minDate ||
      filters.maxDate ||
      filters.minScore ||
      filters.maxScore ||
      filters.hashtags.length ||
      filters.includedTags?.some(tag => tag.trim()) ||
      filters.excludedTags?.some(tag => tag.trim()) ||
      advancedGroup.rules.length ||
      quickView !== 'all'
    ),
    [advancedGroup.rules.length, filters, quickView, searchQuery]
  );

  const handleSelectOnly = useCallback((id: string) => {
    selectionAnchor.current = id;
    setSelectedIds(new Set([id]));
  }, []);

  const handleToggleSelection = useCallback((id: string) => {
    selectionAnchor.current = id;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRangeSelection = useCallback((id: string, additive: boolean) => {
    const end = processedImages.findIndex((image) => image.id === id);
    if (end < 0) return;
    let start = processedImages.findIndex((image) => image.id === selectionAnchor.current);
    if (start < 0) {
      start = end;
      selectionAnchor.current = id;
    }
    const range = processedImages.slice(Math.min(start, end), Math.max(start, end) + 1);
    setSelectedIds((previous) => new Set([
      ...(additive ? previous : []),
      ...range.map((image) => image.id),
    ]));
  }, [processedImages]);

  // Serialize rating gestures so rapid number presses are saved in their original order.
  const ratingQueue = useRef<Promise<void>>(Promise.resolve());
  const rateImages = useCallback((targets: ImageItem[], score: number) => {
    if (!access.canWrite) return Promise.resolve();
    ratingQueue.current = ratingQueue.current.then(async () => {
      const results = await Promise.allSettled(targets.map((image) => updateImageMetadata(image.path, { score })));
      const savedIds = new Set(targets.filter((_, index) => results[index].status === 'fulfilled').map((image) => image.id));
      // Leave failed images at their last saved rating, including after an earlier queued gesture.
      setAllImages((images) => images.map((image) => savedIds.has(image.id) ? { ...image, score } : image));
      const failedCount = targets.length - savedIds.size;
      if (targets.length > 1) {
        setRatingToast({ count: savedIds.size, score, failedCount });
      }
      if (failedCount && targets.length === 1) {
        setNotice(`Could not save ${failedCount} of ${targets.length} ratings. Those images kept their previous ratings.`);
      }
    });
    return ratingQueue.current;
  }, []);

  const handleRateImage = useCallback((score: number) => {
    if (focusedImage) return rateImages([focusedImage], score);
  }, [focusedImage, rateImages]);

  const handleRateSelection = useCallback((score: number) => {
    const targets = selectedImages.length ? selectedImages : focusedImage ? [focusedImage] : [];
    if (targets.length) return rateImages(targets, score);
  }, [selectedImages, focusedImage, rateImages]);

  const handleSaveHashtags = useCallback(async (hashtags: string[]) => {
    if (!access.canWrite || !focusedImage) return;
    const target = focusedImage;
    setAllImages((images) => images.map((image) => image.id === target.id ? { ...image, hashtags } : image));
    try {
      await updateImageMetadata(target.path, { hashtags });
    } catch (error) {
      setAllImages((images) => images.map((image) => image.id === target.id ? { ...image, hashtags: target.hashtags } : image));
      setNotice(getErrorMessage(error, 'The tags could not be saved. Your previous tags were restored.'));
    }
  }, [focusedImage]);

  const handleSaveComment = useCallback(async (comment: string) => {
    if (!access.canWrite || !focusedImage) return;
    const target = focusedImage;
    setAllImages((images) => images.map((image) => image.id === target.id ? { ...image, comment } : image));
    try {
      await updateImageMetadata(target.path, { comment });
    } catch (error) {
      setAllImages((images) => images.map((image) => image.id === target.id ? { ...image, comment: target.comment } : image));
      setNotice(getErrorMessage(error, 'The comment could not be saved. Your previous comment was restored.'));
    }
  }, [focusedImage]);

  const moveFocus = useCallback((nextIndex: number) => {
    const image = processedImages[Math.max(0, Math.min(processedImages.length - 1, nextIndex))];
    if (image) setFocusedId(image.id);
  }, [processedImages]);

  const handleBatchSuccess = useCallback((result: BatchResult) => {
    if (result.action === 'delete') {
      setIsBatchModalOpen(false);
      setDeletionToast(result);
    }
    if (result.action === 'delete' || result.action === 'rename') void handleScan();
  }, [handleScan]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (isAIModalOpen || isSettingsOpen) return;
      if (event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (!event.repeat && !isHashtagModalOpen && !isCommentModalOpen && !isBatchModalOpen && !isFolderPickerOpen && !isShortcutsModalOpen) {
          setIsExpandedView(expanded => !expanded);
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        }
        return;
      }
      if (isAIStatisticsOpen) {
        if (event.key === 'Escape' && isExpandedView && !isHashtagModalOpen && !isCommentModalOpen && !isBatchModalOpen && !isFolderPickerOpen && !isShortcutsModalOpen) {
          event.preventDefault();
          if (!event.repeat) setIsExpandedView(false);
        }
        return;
      }
      if (event.metaKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (!isWindowFullscreen && !isExpandedView) document.querySelector<HTMLInputElement>('[aria-label="Search image names, comments, and tags"]')?.focus();
        return;
      }

      if (
        isHashtagModalOpen ||
        isCommentModalOpen ||
        isBatchModalOpen ||
        isFolderPickerOpen ||
        isShortcutsModalOpen ||
        isAIModalOpen
      ) return;

      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, a, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (!event.repeat) void toggleWindowFullscreen();
        return;
      }
      if (event.key === 'Escape' && isExpandedView && !isFullscreenOpen) {
        event.preventDefault();
        if (!event.repeat) setIsExpandedView(false);
        return;
      }
      if (event.key === 'Escape' && isWindowFullscreen && !isFullscreenOpen) {
        event.preventDefault();
        if (!event.repeat) void toggleWindowFullscreen();
        return;
      }
      if (isFullscreenOpen) return;
      const isRatingKey = ['1', '2', '3', '4', '5'].includes(event.key)
        && !event.metaKey && !event.ctrlKey && !event.altKey;
      // Selection checkboxes retain button focus after clicking; rating shortcuts still apply there.
      if (target.closest('button') && !(isRatingKey && target.closest('.selection-check'))) return;
      if (isRatingKey) {
        event.preventDefault();
        if (!event.repeat) {
          // Resolve hover at keypress time so scrolling/filtering cannot leave a stale target.
          const hoveredId = document.querySelector<HTMLElement>('.gallery-grid .proof-card:hover')?.dataset.imageId;
          const hoveredImage = processedImages.find((image) => image.id === hoveredId);
          if (hoveredImage) void rateImages([hoveredImage], Number(event.key));
          else void handleRateSelection(Number(event.key));
        }
        return;
      }
      if (processedImages.length === 0) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveFocus(focusedIndex + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveFocus(focusedIndex - 1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveFocus(focusedIndex + gridColumns);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveFocus(focusedIndex - gridColumns);
      } else if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        setIsFullscreenOpen(true);
      } else if (access.canWrite && event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        setIsCommentModalOpen(true);
      } else if (access.canWrite && event.key === 'Enter') {
        event.preventDefault();
        setIsHashtagModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    focusedIndex,
    gridColumns,
    handleRateSelection,
    isBatchModalOpen,
    isCommentModalOpen,
    isFolderPickerOpen,
    isFullscreenOpen,
    isWindowFullscreen,
    isExpandedView,
    toggleWindowFullscreen,
    isHashtagModalOpen,
    isShortcutsModalOpen,
    isSettingsOpen,
    isAIModalOpen,
    isAIStatisticsOpen,
    moveFocus,
    processedImages,
    rateImages,
  ]);

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSort(DEFAULT_SORT);
    setAdvancedGroup(DEFAULT_ADVANCED_GROUP);
    setSearchQuery('');
    setQuickView('all');
  };

  return (
    <div className={`app-shell${isWindowFullscreen || isExpandedView ? ' is-window-fullscreen' : ''}`}>
      <GalleryHeader
        directoryPath={directoryPath}
        searchQuery={searchQuery}
        selectedCount={selectedIds.size}
        isScanning={isScanning}
        isFilterPanelOpen={isFilterPanelOpen}
        isInspectorOpen={isInspectorOpen}
        onDirectoryChange={setDirectoryPath}
        onSearchChange={setSearchQuery}
        onScan={() => void handleScan()}
        onOpenFolderPicker={() => setIsFolderPickerOpen(true)}
        onToggleFilterPanel={() => setIsFilterPanelOpen((open) => !open)}
        onToggleInspector={() => setIsInspectorOpen((open) => !open)}
        onOpenBatchModal={() => setIsBatchModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleFullscreen={() => void toggleWindowFullscreen()}
        onOpenAIStatistics={() => setIsAIStatisticsOpen(open => !open)}
        isAIStatisticsOpen={isAIStatisticsOpen}
        onOpenAI={() => setIsAIModalOpen(true)}
        aiBusy={ai.status?.job?.state === 'running'}
      />

      {!isAIModalOpen && ai.status?.job?.kind === 'analyze' && dismissedAnalysisJobId !== ai.status.job.id && <div className="ai-header-progress">
        <div className="ai-job-heading"><strong>AI Analysis · {ai.status.job.state === 'running' ? `${ai.status.job.completed + ai.status.job.skipped + ai.status.job.failed} / ${ai.status.job.total}` : ai.status.job.state}</strong><div className="ai-progress-actions"><button className="ai-text-button" type="button" onClick={() => setIsAIModalOpen(true)}>View analysis</button><button className="icon-button" type="button" aria-label="Dismiss analysis progress" title="Dismiss analysis progress" onClick={() => setDismissedAnalysisJobId(ai.status!.job!.id)}><X aria-hidden="true" /></button></div></div>
        <AIProgress job={ai.status.job} />
      </div>}
      {isAIStatisticsOpen ? <AIStatisticsPage images={allImages} directory={scannedDirectory} includeSubdirs={scannedSubdirs} isScanning={isScanning} onBack={() => setIsAIStatisticsOpen(false)} onAnalyze={() => setIsAIModalOpen(true)} onTag={tag => {
        resetFilters();
        setFilters({ ...DEFAULT_FILTERS, includedTags: [tag] });
        setIsAIStatisticsOpen(false);
      }} /> : <div className="workspace">
        <SourceSidebar
          directoryPath={directoryPath}
          includeSubdirs={includeSubdirs}
          totalFound={allImages.length}
          filteredCount={processedImages.length}
          selectedCount={selectedIds.size}
          isScanning={isScanning}
          quickView={quickView}
          ratedCount={allImages.filter((image) => image.score > 0).length}
          taggedCount={allImages.filter((image) => image.hashtags.length > 0).length}
          onSubdirsChange={setIncludeSubdirs}
          onOpenFolderPicker={() => setIsFolderPickerOpen(true)}
          onScan={() => void handleScan()}
          onQuickViewChange={setQuickView}
          onSelectAll={() => {
            setSelectedIds(new Set(processedImages.map((image) => image.id)));
            selectionAnchor.current = processedImages[0]?.id ?? null;
          }}
        />

        <main className="workspace-main">
          {notice && (
            <div className="notice-banner" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{notice}</span>
              <button onClick={() => setNotice(null)} type="button" aria-label="Dismiss message">
                <X aria-hidden="true" />
              </button>
            </div>
          )}

          <ThumbnailControls directoryPath={directoryPath} images={allImages} settings={thumbnailSettings} autoRatio={autoRatio} onChange={setThumbnailSettings} />

          <div className="proof-workspace">
            {isFilterPanelOpen && (
              <div className="filter-overlay">
                <FilterPanel
                  availableTypes={availableTypes}
                  filters={filters}
                  sort={sort}
                  advancedGroup={advancedGroup}
                  onFilterChange={setFilters}
                  onSortChange={setSort}
                  onAdvancedGroupChange={setAdvancedGroup}
                  onReset={resetFilters}
                />
              </div>
            )}

            <GalleryGrid
              completedScanVersion={completedScanVersion}
              thumbnailSettings={thumbnailSettings}
              thumbnailSize={thumbnailSettings.size}
              thumbnailRatio={thumbnailRatio}
              images={processedImages}
              focusedIndex={focusedIndex}
              selectedIds={selectedIds}
              isScanning={isScanning}
              hasCompletedScan={hasCompletedScan}
              hasActiveFilters={hasActiveFilters}
              onFocusIndex={(index) => setFocusedId(processedImages[index]?.id ?? null)}
              onSelectOnly={handleSelectOnly}
              onRangeSelection={handleRangeSelection}
              onToggleSelection={handleToggleSelection}
              onOpenFullscreen={(index) => {
                setFocusedId(processedImages[index]?.id ?? null);
                setIsFullscreenOpen(true);
              }}
              onOpenFolderPicker={() => setIsFolderPickerOpen(true)}
              onColumnCountChange={setGridColumns}
            />
          </div>

          <WorkspaceStatusBar
            filteredCount={processedImages.length}
            totalCount={allImages.length}
            selectedCount={selectedIds.size}
            isScanning={isScanning}
          />
        </main>

        <InspectorPanel
          image={focusedImage}
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          onRate={(score) => void handleRateImage(score)}
          onOpenHashtags={() => setIsHashtagModalOpen(true)}
          onOpenComment={() => setIsCommentModalOpen(true)}
          onOpenFullscreen={() => setIsFullscreenOpen(true)}
          onAnalyze={() => setIsAIModalOpen(true)}
          onPromoteAI={async (tags) => {
            if (!access.canWrite || !focusedImage) return;
            const hashtags = Array.from(new Set([...focusedImage.hashtags, ...tags]));
            await updateImageMetadata(focusedImage.path, { hashtags });
            setAllImages(current => current.map(image => image.id === focusedImage.id ? { ...image, hashtags } : image));
          }}
          onClearAI={(family) => {
            if (!access.canWrite || !focusedImage) return;
            setAllImages(current => current.map(image => {
              if (image.id !== focusedImage.id) return image;
              const results = { ...image.ai };
              delete results[family];
              return { ...image, ai: results };
            }));
          }}
        />
      </div>}

      {isFullscreenOpen && focusedImage && (
        <FullscreenViewer
          image={focusedImage}
          currentIndex={focusedIndex}
          totalImages={processedImages.length}
          shortcutsEnabled={!isHashtagModalOpen && !isCommentModalOpen && !isAIModalOpen}
          onClose={() => setIsFullscreenOpen(false)}
          onNext={() => moveFocus(focusedIndex + 1)}
          onPrev={() => moveFocus(focusedIndex - 1)}
          onRate={(score) => void handleRateImage(score)}
          onOpenHashtags={() => setIsHashtagModalOpen(true)}
          onOpenComment={() => setIsCommentModalOpen(true)}
        />
      )}

      {isHashtagModalOpen && focusedImage && (
        <HashtagModal
          image={focusedImage}
          isOpen={isHashtagModalOpen}
          onClose={() => setIsHashtagModalOpen(false)}
          onSave={(hashtags) => void handleSaveHashtags(hashtags)}
        />
      )}

      {isCommentModalOpen && focusedImage && (
        <CommentModal
          image={focusedImage}
          isOpen={isCommentModalOpen}
          onClose={() => setIsCommentModalOpen(false)}
          onSave={(comment) => void handleSaveComment(comment)}
        />
      )}

      <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
        {analysisToast && <div className="deletion-toast">
          <CheckCircle aria-hidden="true" /><div><strong>AI Analysis done</strong><p className="rating-toast-detail">{analysisSummary(analysisToast)}</p></div>
          <button className="icon-button" type="button" aria-label="Dismiss AI analysis notification" onClick={() => setAnalysisToast(null)}><X aria-hidden="true" /></button>
        </div>}
        {ratingToast && (
          <div className={`deletion-toast${ratingToast.failedCount ? ' rating-toast-warning' : ''}`}>
            {ratingToast.failedCount ? <AlertCircle aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
            <div>
              <strong>
                {ratingToast.count
                  ? `Rated ${ratingToast.count} ${ratingToast.count === 1 ? 'image' : 'images'} · ${ratingToast.score} ${ratingToast.score === 1 ? 'star' : 'stars'}`
                  : `Could not save ${ratingToast.score}-star ratings`}
              </strong>
              {ratingToast.failedCount > 0 && (
                <p className="rating-toast-detail">
                  {ratingToast.failedCount} {ratingToast.failedCount === 1 ? 'image kept its' : 'images kept their'} previous rating.
                </p>
              )}
            </div>
            <button className="icon-button" type="button" aria-label="Dismiss rating notification" onClick={() => setRatingToast(null)}>
              <X aria-hidden="true" />
            </button>
          </div>
        )}
        {deletionToast && (
          <div className="deletion-toast">
            {deletionToast.errors?.length ? <AlertCircle aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
            <div>
              <strong>Deleted {deletionToast.affectedCount} {deletionToast.affectedCount === 1 ? 'file' : 'files'}</strong>
              {Boolean(deletionToast.errors?.length) && (
                <details>
                  <summary>{deletionToast.errors!.length} files could not be deleted</summary>
                  <ul>{deletionToast.errors!.map((error, index) => <li key={index}>{error}</li>)}</ul>
                </details>
              )}
            </div>
            <button className="icon-button" type="button" aria-label="Dismiss deletion notification" onClick={() => setDeletionToast(null)}>
              <X aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <BatchOperationsModal
        isOpen={isBatchModalOpen}
        filteredImages={processedImages}
        selectedImages={selectedImages}
        onClose={() => setIsBatchModalOpen(false)}
        onSuccess={handleBatchSuccess}
      />

      <FolderPickerModal
        isOpen={isFolderPickerOpen}
        initialPath={directoryPath}
        title="Choose an image folder"
        onClose={() => setIsFolderPickerOpen(false)}
        onSelectFolder={(selectedPath) => {
          setDirectoryPath(selectedPath);
          void handleScan(selectedPath);
        }}
      />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onImported={() => handleScan()} />
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
      <AIAnalysisModal isOpen={isAIModalOpen} status={ai.status} serviceError={ai.error} selected={selectedImages} filtered={processedImages} focused={focusedImage} onClose={() => setIsAIModalOpen(false)} onRefresh={ai.refresh} />
    </div>
  );
}
