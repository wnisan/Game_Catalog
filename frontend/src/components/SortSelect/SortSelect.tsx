import React from 'react';
import { SORT_OPTIONS } from '../../types/filters';
import './SortSelect.css';

interface SortSelectProps {
    value: string;
    onChange: (value: string) => void;
}

const SortSelect: React.FC<SortSelectProps> = ({value, onChange}) => {
 return (
    <div className="sort-select">
      <label htmlFor="sort-select" className="sort-select__label">
        Sort by:
      </label>
      <select
        id="sort-select"
        className="sort-select__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {SORT_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SortSelect;