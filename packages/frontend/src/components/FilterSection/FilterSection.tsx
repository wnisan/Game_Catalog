import React from 'react';
import './FilterSection.css';

interface FilterSectionProps {
  title: string;
  children: React.ReactNode; // содержимое
  isExpanded?: boolean;
  onToggle?: () => void;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  children,
  isExpanded = true,
  onToggle
}) => {
  // для доступности
  const sectionId = `filter-section-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <section className="filter-section" aria-labelledby={`${sectionId}-header`}>
      {onToggle ? (
        <div
          className="filter-section__header"
          onClick={onToggle}
          role="button"
          tabIndex={0}
          id={`${sectionId}-header`}
          aria-expanded={isExpanded}
          aria-controls={`${sectionId}-content`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle();
            }
          }}
        >
          <h3 className="filter-section__title">{title}</h3>
          <span
            className={`filter-section__arrow ${isExpanded ? 'expanded' : ''}`}
            aria-hidden="true"
          >
            ▼
          </span>
        </div>
      ) : (
        <h3 className="filter-section__title" id={`${sectionId}-header`}>{title}</h3>
      )}

      {isExpanded && (
        <div
          className="filter-section__content"
          id={`${sectionId}-content`}
          role="region"
          aria-labelledby={`${sectionId}-header`}
        >
          {children}
        </div>
      )}
    </section>
  );
};

export default FilterSection;