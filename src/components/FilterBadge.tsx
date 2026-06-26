import React from 'react';

interface FilterBadgeProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
  compact?: boolean;
}

export const FilterBadge: React.FC<FilterBadgeProps> = ({ label, isActive, onClick, count, compact }) => {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1 rounded-full font-medium transition-all duration-200 border
        ${compact ? 'px-2.5 py-0.5 text-xs' : 'px-4 py-2 text-sm'}
        ${isActive
          ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-500'
        }
      `}
    >
      {label}
      {count !== undefined && (
        <span className={`rounded-full px-1 font-bold tabular-nums ${isActive ? 'bg-blue-500 text-blue-100' : 'bg-gray-100 text-gray-400'}`}>
          {count}
        </span>
      )}
    </button>
  );
};