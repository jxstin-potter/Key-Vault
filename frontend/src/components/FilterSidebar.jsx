import { X } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Persistent catalogue filters.
 *
 * These controls used to live behind a "Filters" toggle that defaulted closed,
 * which meant platform, region and stock filtering were effectively
 * undiscoverable - a shopper had to find a button before they could narrow by
 * the two axes this catalogue is actually organised around. Every comparable
 * store (Eneba, Steam) keeps these permanently visible, because filtering is
 * the browse task rather than an advanced option.
 *
 * Rendered inline as a sidebar on large screens, and as a slide-over drawer on
 * small ones, where a permanent sidebar would cost too much width.
 */

const Group = ({ label, children }) => (
  <div className="pb-5 mb-5 border-b border-neutral-200 last:border-0 last:mb-0 last:pb-0">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
      {label}
    </h3>
    {children}
  </div>
);

const selectClass =
  'w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

export default function FilterSidebar({
  categories,
  platforms,
  regions,
  selectedCategory,
  selectedPlatform,
  selectedRegion,
  inStockOnly,
  onCategoryChange,
  onPlatformChange,
  onRegionChange,
  onInStockChange,
  className
}) {
  return (
    <aside className={cn('bg-neutral-100 rounded-xl border border-neutral-200 p-5', className)}>
      <Group label="Genre">
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className={selectClass}
          aria-label="Filter by genre"
        >
          <option value="All">All genres</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Group>

      <Group label="Platform">
        <select
          value={selectedPlatform}
          onChange={(e) => onPlatformChange(e.target.value)}
          className={selectClass}
          aria-label="Filter by platform"
        >
          <option value="All">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </Group>

      <Group label="Region">
        <select
          value={selectedRegion}
          onChange={(e) => onRegionChange(e.target.value)}
          className={selectClass}
          aria-label="Filter by region"
        >
          <option value="All">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </Group>

      <Group label="Availability">
        <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onInStockChange(e.target.checked)}
            className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          In stock only
        </label>
      </Group>
    </aside>
  );
}

/**
 * Removable chips for whatever is currently applied.
 *
 * Without these the only feedback for an active filter is the result count
 * changing, which reads as an empty catalogue rather than a narrow one.
 */
export function ActiveFilters({ filters, onRemove, onClearAll }) {
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onRemove(f.key)}
          className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-medium bg-primary-600/15 text-primary-400 border border-primary-600/40 hover:bg-primary-600/25 transition-colors"
          aria-label={`Remove ${f.label} filter`}
        >
          {f.label}
          <X size={12} />
        </button>
      ))}
      <button
        onClick={onClearAll}
        className="px-3 py-1 rounded-full text-xs text-neutral-500 border border-neutral-300 hover:text-neutral-900 hover:border-neutral-400 transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}
