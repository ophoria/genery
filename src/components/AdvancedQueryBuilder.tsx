import React from 'react';
import {
  AdvancedFilterGroup,
  SingleRule,
  FilterField,
  ComparisonOperator,
} from '../types/gallery';
import { Plus, Trash2, Layers } from 'lucide-react';

interface AdvancedQueryBuilderProps {
  group: AdvancedFilterGroup;
  onChange: (updatedGroup: AdvancedFilterGroup) => void;
}

const FIELD_OPTIONS: { label: string; value: FilterField }[] = [
  { label: 'File Extension', value: 'extension' },
  { label: 'Width (px)', value: 'width' },
  { label: 'Height (px)', value: 'height' },
  { label: 'Aspect Ratio', value: 'aspectRatio' },
  { label: 'Score (1-5)', value: 'score' },
  { label: 'Hashtag', value: 'hashtag' },
  { label: 'Comment', value: 'comment' },
  { label: 'Creation Date', value: 'createdAt' },
  { label: 'File Size (bytes)', value: 'size' },
  { label: 'File Name', value: 'name' },
];

const OPERATOR_OPTIONS: { label: string; value: ComparisonOperator }[] = [
  { label: 'Equals (=)', value: 'equals' },
  { label: 'Not Equals (≠)', value: 'not_equals' },
  { label: 'Greater Than (>)', value: 'greater_than' },
  { label: 'Less Than (<)', value: 'less_than' },
  { label: 'Between', value: 'between' },
  { label: 'Contains', value: 'contains' },
  { label: 'Not Contains', value: 'not_contains' },
  { label: 'In List (comma-sep)', value: 'in' },
];

export const AdvancedQueryBuilder: React.FC<AdvancedQueryBuilderProps> = ({
  group,
  onChange,
}) => {
  const handleOpChange = (op: 'AND' | 'OR' | 'NOT') => {
    onChange({ ...group, logicalOp: op });
  };

  const handleAddRule = () => {
    const newRule: SingleRule = {
      id: Math.random().toString(36).substring(2, 9),
      field: 'score',
      operator: 'greater_than',
      value: '3',
    };
    onChange({
      ...group,
      rules: [...group.rules, newRule],
    });
  };

  const handleAddSubGroup = () => {
    const newSubGroup: AdvancedFilterGroup = {
      id: Math.random().toString(36).substring(2, 9),
      logicalOp: 'AND',
      rules: [],
    };
    onChange({
      ...group,
      rules: [...group.rules, newSubGroup],
    });
  };

  const handleRemoveItem = (index: number) => {
    const updated = group.rules.filter((_, i) => i !== index);
    onChange({ ...group, rules: updated });
  };

  const handleRuleChange = (index: number, updatedRule: SingleRule) => {
    const updated = [...group.rules];
    updated[index] = updatedRule;
    onChange({ ...group, rules: updated });
  };

  const handleSubGroupChange = (index: number, updatedSubGroup: AdvancedFilterGroup) => {
    const updated = [...group.rules];
    updated[index] = updatedSubGroup;
    onChange({ ...group, rules: updated });
  };

  return (
    <div className="p-3 bg-dark-900/60 rounded-lg border border-dark-700/80 flex flex-col gap-3">
      {/* Logical Operator Selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-gray-300">Match Logic:</span>
          <div className="inline-flex rounded-md shadow-sm">
            {(['AND', 'OR', 'NOT'] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => handleOpChange(op)}
                className={`px-2.5 py-1 text-[11px] font-bold transition-colors first:rounded-l-md last:rounded-r-md border ${
                  group.logicalOp === op
                    ? op === 'NOT'
                      ? 'bg-red-600 text-white border-red-500'
                      : op === 'OR'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-blue-600 text-white border-blue-500'
                    : 'bg-dark-800 text-gray-400 hover:text-white border-dark-600'
                }`}
              >
                {op}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddRule}
            className="flex items-center gap-1 px-2.5 py-1 bg-dark-800 hover:bg-dark-700 text-blue-400 text-xs font-medium rounded border border-dark-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Condition</span>
          </button>
          <button
            type="button"
            onClick={handleAddSubGroup}
            className="flex items-center gap-1 px-2.5 py-1 bg-dark-800 hover:bg-dark-700 text-purple-400 text-xs font-medium rounded border border-dark-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nested Group</span>
          </button>
        </div>
      </div>

      {/* Rules list */}
      {group.rules.length === 0 ? (
        <div className="text-[11px] text-gray-500 italic py-2 text-center border border-dashed border-dark-700 rounded">
          No conditions added to this logic group. Click + Condition above.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 pl-2 border-l-2 border-dark-700">
          {group.rules.map((rule, idx) => {
            if ('logicalOp' in rule) {
              return (
                <div key={rule.id} className="relative group/sub">
                  <AdvancedQueryBuilder
                    group={rule}
                    onChange={(updated) => handleSubGroupChange(idx, updated)}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 rounded hover:bg-dark-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            const singleRule = rule as SingleRule;
            return (
              <div key={singleRule.id} className="flex flex-wrap items-center gap-2 bg-dark-800 p-2 rounded border border-dark-700">
                {/* Field Select */}
                <select
                  value={singleRule.field}
                  onChange={(e) =>
                    handleRuleChange(idx, {
                      ...singleRule,
                      field: e.target.value as FilterField,
                    })
                  }
                  className="px-2 py-1 bg-dark-900 border border-dark-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  {FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Operator Select */}
                <select
                  value={singleRule.operator}
                  onChange={(e) =>
                    handleRuleChange(idx, {
                      ...singleRule,
                      operator: e.target.value as ComparisonOperator,
                    })
                  }
                  className="px-2 py-1 bg-dark-900 border border-dark-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  {OPERATOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Value Input */}
                <input
                  type="text"
                  value={singleRule.value}
                  onChange={(e) =>
                    handleRuleChange(idx, { ...singleRule, value: e.target.value })
                  }
                  placeholder="Value..."
                  className="flex-1 min-w-[120px] px-2 py-1 bg-dark-900 border border-dark-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                />

                {/* Optional Value2 for 'between' */}
                {singleRule.operator === 'between' && (
                  <input
                    type="text"
                    value={singleRule.value2 || ''}
                    onChange={(e) =>
                      handleRuleChange(idx, { ...singleRule, value2: e.target.value })
                    }
                    placeholder="And..."
                    className="w-24 px-2 py-1 bg-dark-900 border border-dark-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                  />
                )}

                {/* Delete rule button */}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-dark-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
