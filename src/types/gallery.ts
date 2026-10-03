import type { AIFamily, AIResult } from './ai';

export interface ImageItem {
  id: string;
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  width: number;
  height: number;
  aspectRatio: number;
  size: number;
  createdAt: string;
  modifiedAt: string;
  score: number; // 0 to 5
  hashtags: string[];
  comment: string;
  ai?: Partial<Record<AIFamily, AIResult>>;
}

export type AspectRatioFilter = 'any' | 'landscape' | 'portrait' | 'square';

export interface BasicFilterOptions {
  directoryPath: string;
  includeSubdirs: boolean;
  selectedTypes: string[];
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  aspectRatio: AspectRatioFilter;
  minDate?: string;
  maxDate?: string;
  minScore?: number;
  maxScore?: number;
  hashtags: string[];
  hashtagOperator: 'AND' | 'OR' | 'NOT';
  includedTags?: string[];
  excludedTags?: string[];
  searchQuery: string;
}

export type FilterField = 
  | 'extension' 
  | 'width' 
  | 'height' 
  | 'aspectRatio' 
  | 'score' 
  | 'hashtag' 
  | 'comment'
  | 'aiTag'
  | 'aiGroup'
  | 'aiModel'
  | 'createdAt' 
  | 'size' 
  | 'name';

export type ComparisonOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'greater_than' 
  | 'less_than' 
  | 'between' 
  | 'contains' 
  | 'not_contains' 
  | 'in';

export interface SingleRule {
  id: string;
  field: FilterField;
  operator: ComparisonOperator;
  value: any;
  value2?: any; // For 'between'
}

export interface AdvancedFilterGroup {
  id: string;
  logicalOp: 'AND' | 'OR' | 'NOT';
  rules: (SingleRule | AdvancedFilterGroup)[];
}

export type SortField = 'name' | 'createdAt' | 'modifiedAt' | 'score' | 'width' | 'height' | 'size';
export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
  field: SortField;
  direction: SortDirection;
}

export interface ScanResult {
  directory: string;
  totalFound: number;
  images: ImageItem[];
  availableTypes: string[];
}

export interface FolderNode {
  name: string;
  path: string;
  hasSubdirs: boolean;
  createdAt?: number | null;
}

export type BatchAction = 'copy' | 'delete' | 'rename' | 'zip';

export interface BatchRequest {
  action: BatchAction;
  imagePaths: string[];
  targetDirectory?: string;
  renamePattern?: string; // e.g. "photo_{n:3}_{orig}"
  zipFileName?: string;
}

export interface BatchResult {
  success: boolean;
  action: BatchAction;
  affectedCount: number;
  message: string;
  errors?: string[];
  zipFilePath?: string;
}
