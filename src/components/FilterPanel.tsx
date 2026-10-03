import React, { useState } from 'react';
import {
  BasicFilterOptions,
  SortOptions,
  AdvancedFilterGroup,
  AspectRatioFilter,
  SortField,
  SortDirection,
} from '../types/gallery';
import { AdvancedQueryBuilder } from './AdvancedQueryBuilder';
import {
  Filter,
  RotateCcw,
  Star,
  Sliders,
  Calendar,
  Maximize,
  Tag,
  ArrowUpDown,
  Code2,
} from 'lucide-react';

interface FilterPanelProps {
  availableTypes: string[];
  filters: BasicFilterOptions;
  sort: SortOptions;
  advancedGroup: AdvancedFilterGroup;
  onFilterChange: (updated: BasicFilterOptions) => void;
  onSortChange: (updated: SortOptions) => void;
  onAdvancedGroupChange: (updated: AdvancedFilterGroup) => void;
  onReset: () => void;
}

const ALL_COMMON_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif', 'tiff'];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  availableTypes,
  filters,
  sort,
  advancedGroup,
  onFilterChange,
  onSortChange,
  onAdvancedGroupChange,
  onReset,
}) => {
  const [showAdvancedBuilder, setShowAdvancedBuilder] = useState(false);

  const displayTypes = Array.from(
    new Set([...ALL_COMMON_TYPES, ...availableTypes])
  ).sort();

  const handleTypeToggle = (ext: string) => {
    const isSelected = filters.selectedTypes.includes(ext);
    const updatedTypes = isSelected
      ? filters.selectedTypes.filter((t) => t !== ext)
      : [...filters.selectedTypes, ext];
    onFilterChange({ ...filters, selectedTypes: updatedTypes });
  };

  const handleSelectAllTypes = () => {
    onFilterChange({ ...filters, selectedTypes: displayTypes });
  };

  const handleDeselectAllTypes = () => {
    onFilterChange({ ...filters, selectedTypes: [] });
  };

  return (
    <div className="filter-panel bg-dark-800 border-b border-dark-700 p-4 text-xs text-gray-200 flex flex-col gap-4 animate-in slide-in-from-top duration-200">
      {/* Top Header & Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm text-blue-400">
          <Filter className="w-4 h-4" />
          <span>Filter & Sort</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdvancedBuilder(!showAdvancedBuilder)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              showAdvancedBuilder
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-dark-700 text-blue-300 hover:bg-dark-600 border-dark-600'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showAdvancedBuilder ? 'Hide Logic Rules' : 'Logic Rules'}</span>
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded border border-dark-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Controls Grid */}
      <div className="filter-groups">
        {/* 1. File Extension Filter */}
        <div className="filter-group">
          <div className="flex items-center justify-between font-semibold text-gray-300">
            <span className="flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              File Extensions
            </span>
            <div className="flex gap-1.5 text-[10px]">
              <button onClick={handleSelectAllTypes} className="text-blue-400 hover:underline">
                All
              </button>
              <span className="text-gray-600">|</span>
              <button onClick={handleDeselectAllTypes} className="text-gray-400 hover:underline">
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {displayTypes.map((ext) => {
              const isChecked = filters.selectedTypes.length === 0 || filters.selectedTypes.includes(ext);
              return (
                <button
                  key={ext}
                  type="button"
                  onClick={() => handleTypeToggle(ext)}
                  className={`px-2 py-0.5 rounded text-[11px] uppercase font-bold transition-colors border ${
                    isChecked
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                      : 'bg-dark-800 text-gray-500 border-dark-700 hover:text-gray-300'
                  }`}
                >
                  {ext}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Dimensions & Aspect Ratio Filter */}
        <div className="filter-group">
          <div className="font-semibold text-gray-300 flex items-center gap-1">
            <Maximize className="w-3.5 h-3.5 text-emerald-400" />
            Dimensions & Aspect Ratio
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400">Min Width (px)</label>
              <input
                type="number"
                value={filters.minWidth || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    minWidth: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                placeholder="e.g. 1920"
                className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-gray-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Min Height (px)</label>
              <input
                type="number"
                value={filters.minHeight || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    minHeight: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                placeholder="e.g. 1080"
                className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-gray-200"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-400">Aspect Ratio</label>
            <select
              value={filters.aspectRatio}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  aspectRatio: e.target.value as AspectRatioFilter,
                })
              }
              className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-gray-200"
            >
              <option value="any">Any Aspect Ratio</option>
              <option value="landscape">Landscape (&gt; 1.1)</option>
              <option value="portrait">Portrait (&lt; 0.9)</option>
              <option value="square">Square (1:1 ± 0.1)</option>
            </select>
          </div>
        </div>

        {/* 3. Score & Creation Date Filter */}
        <div className="filter-group">
          <div className="font-semibold text-gray-300 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-400" />
              Score & Creation Date
            </span>
          </div>

          {/* Min Score filter */}
          <div>
            <label className="text-[10px] text-gray-400">Min Score Rating (1-5)</label>
            <div className="flex items-center gap-1 mt-0.5">
              {[0, 1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      minScore: s === 0 ? undefined : s,
                    })
                  }
                  className={`flex-1 py-1 rounded text-[11px] font-bold border transition-colors ${
                    (filters.minScore || 0) === s
                      ? 'bg-yellow-500 text-dark-900 border-yellow-400'
                      : 'bg-dark-800 text-gray-400 border-dark-600 hover:text-white'
                  }`}
                >
                  {s === 0 ? 'All' : `${s}★+`}
                </button>
              ))}
            </div>
          </div>

          {/* Date range filter */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <label className="text-[10px] text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-400" />
                From Date
              </label>
              <input
                type="date"
                value={filters.minDate || ''}
                onChange={(e) =>
                  onFilterChange({ ...filters, minDate: e.target.value || undefined })
                }
                className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-gray-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-400" />
                To Date
              </label>
              <input
                type="date"
                value={filters.maxDate || ''}
                onChange={(e) =>
                  onFilterChange({ ...filters, maxDate: e.target.value || undefined })
                }
                className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-gray-200"
              />
            </div>
          </div>
        </div>

        {/* 4. Sorting & Hashtags */}
        <div className="filter-group">
          <div className="font-semibold text-gray-300 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
            Sorting & Tag Filtering
          </div>

          {/* Sorting Dropdowns */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400">Sort By</label>
              <select
                value={sort.field}
                onChange={(e) => onSortChange({ ...sort, field: e.target.value as SortField })}
                className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-gray-200"
              >
                <option value="score">Score Rating</option>
                <option value="createdAt">Creation Date</option>
                <option value="modifiedAt">Modified Date</option>
                <option value="name">File Name</option>
                <option value="width">Width / Height</option>
                <option value="size">File Size</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Order</label>
              <select
                value={sort.direction}
                onChange={(e) => onSortChange({ ...sort, direction: e.target.value as SortDirection })}
                className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-gray-200"
              >
                <option value="desc">Descending (High → Low / Newest)</option>
                <option value="asc">Ascending (Low → High / Oldest)</option>
              </select>
            </div>
          </div>

          <div className="tag-filter-fields">
            <label>Include tags<input type="text" value={(filters.includedTags || []).join(',')} onChange={event => onFilterChange({ ...filters, includedTags: event.target.value.split(',') })} placeholder="e.g. forest, pixel art" /></label>
            <label>Exclude tags<input type="text" value={(filters.excludedTags || []).join(',')} onChange={event => onFilterChange({ ...filters, excludedTags: event.target.value.split(',') })} placeholder="e.g. portrait, vehicle" /></label>
            <p>Manual and AI tags · comma-separated · include all, exclude any</p>
          </div>
          {/* Hashtag filter input & operator */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-blue-400" />
                Hashtags (comma sep)
              </span>
              <div className="flex gap-1">
                {(['AND', 'OR', 'NOT'] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => onFilterChange({ ...filters, hashtagOperator: op })}
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      filters.hashtagOperator === op
                        ? 'bg-blue-600 text-white'
                        : 'bg-dark-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={filters.hashtags.join(', ')}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  hashtags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0),
                })
              }
              placeholder="e.g. nature, portrait..."
              className="w-full mt-1 px-2 py-1 bg-dark-800 border border-dark-600 rounded text-gray-200"
            />
          </div>
        </div>
      </div>

      {/* Advanced Rule Builder Collapsible Drawer */}
      {showAdvancedBuilder && (
        <div className="mt-2 border-t border-dark-700 pt-3">
          <div className="mb-2 text-xs font-semibold text-blue-300 flex items-center gap-1.5">
            <Code2 className="w-4 h-4" />
            <span>Advanced Expression Builder (Combine conditions with AND / OR / NOT)</span>
          </div>
          <AdvancedQueryBuilder
            group={advancedGroup}
            onChange={onAdvancedGroupChange}
          />
        </div>
      )}
    </div>
  );
};
