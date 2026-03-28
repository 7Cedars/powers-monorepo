import { useState, useRef, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  ArrowsUpDownIcon, 
  XMarkIcon,
  CalendarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  UserIcon
} from '@heroicons/react/24/outline';

export type FilterOption = 'all' | 'active' | 'completed' | 'pending';
export type SortOption = 'newest' | 'oldest' | 'most-active' | 'alphabetical';

interface SearchFilterSortProps {
  onSearchChange?: (query: string) => void;
  onFilterChange?: (filter: FilterOption) => void;
  onSortChange?: (sort: SortOption) => void;
}

export function SearchFilterSort({ 
  onSearchChange, 
  onFilterChange, 
  onSortChange 
}: SearchFilterSortProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<FilterOption>('all');
  const [currentSort, setCurrentSort] = useState<SortOption>('newest');

  const searchMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchMenuRef.current && !searchMenuRef.current.contains(event.target as Node)) {
        setShowSearchMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearchChange?.(value);
  };

  const handleFilterSelect = (filter: FilterOption) => {
    setCurrentFilter(filter);
    onFilterChange?.(filter);
    setShowFilterMenu(false);
  };

  const handleSortSelect = (sort: SortOption) => {
    setCurrentSort(sort);
    onSortChange?.(sort);
    setShowSortMenu(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    onSearchChange?.('');
  };

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative" ref={searchMenuRef}>
        <button
          onClick={() => setShowSearchMenu(!showSearchMenu)}
          className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
          title="Search"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
          {searchQuery && (
            <span className="text-[10px] text-primary">•</span>
          )}
        </button>

        {showSearchMenu && (
          <div className="absolute top-full right-0 mt-1 w-64 bg-background border border-border  shadow-lg z-50 animate-in fade-in duration-200">
            <div className="px-3 py-2 border-b border-border">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                Search
              </span>
            </div>
            
            <div className="p-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Type to search..."
                className="w-full bg-transparent border border-border px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground "
                autoFocus
              />
            </div>

            {searchQuery && (
              <>
                <div className="border-t border-border" />
                <button
                  onClick={clearSearch}
                  className="w-full px-3 py-2 text-left font-mono text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <XMarkIcon className="h-3 w-3" />
                  Clear Search
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="relative" ref={filterMenuRef}>
        <button
          onClick={() => setShowFilterMenu(!showFilterMenu)}
          className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
          title="Filter"
        >
          <FunnelIcon className="h-4 w-4" />
          {currentFilter !== 'all' && (
            <span className="text-[10px] text-primary">•</span>
          )}
        </button>

        {showFilterMenu && (
          <div className="absolute top-full right-0 mt-1 w-44 bg-background border border-border  shadow-lg z-50 animate-in fade-in duration-200">
            <div className="px-3 py-2 border-b border-border">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                Filter by Status
              </span>
            </div>
            
            <div className="py-1">
              <button
                onClick={() => handleFilterSelect('all')}
                className={`w-full px-3 py-2 text-left font-mono text-xs transition-colors ${
                  currentFilter === 'all' 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>All Items</span>
                  {currentFilter === 'all' && <span className="text-primary">✓</span>}
                </div>
              </button>
              
              <button
                onClick={() => handleFilterSelect('active')}
                className={`w-full px-3 py-2 text-left font-mono text-xs transition-colors ${
                  currentFilter === 'active' 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Active Only</span>
                  {currentFilter === 'active' && <span className="text-primary">✓</span>}
                </div>
              </button>
              
              <button
                onClick={() => handleFilterSelect('completed')}
                className={`w-full px-3 py-2 text-left font-mono text-xs transition-colors ${
                  currentFilter === 'completed' 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Completed</span>
                  {currentFilter === 'completed' && <span className="text-primary">✓</span>}
                </div>
              </button>
              
              <button
                onClick={() => handleFilterSelect('pending')}
                className={`w-full px-3 py-2 text-left font-mono text-xs transition-colors ${
                  currentFilter === 'pending' 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Pending</span>
                  {currentFilter === 'pending' && <span className="text-primary">✓</span>}
                </div>
              </button>
            </div>

            {currentFilter !== 'all' && (
              <>
                <div className="border-t border-border" />
                <button
                  onClick={() => handleFilterSelect('all')}
                  className="w-full px-3 py-2 text-left font-mono text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Clear Filter
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sort */}
      <div className="relative" ref={sortMenuRef}>
        <button
          onClick={() => setShowSortMenu(!showSortMenu)}
          className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
          title="Sort"
        >
          <ArrowsUpDownIcon className="h-4 w-4" />
        </button>

        {showSortMenu && (
          <div className="absolute top-full right-0 mt-1 w-44 bg-background border border-border  shadow-lg z-50 animate-in fade-in duration-200">
            <div className="px-3 py-2 border-b border-border">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                Sort By
              </span>
            </div>
            
            <div className="py-1">
              <button
                onClick={() => handleSortSelect('newest')}
                className={`w-full px-3 py-2 text-left font-mono text-xs transition-colors ${
                  currentSort === 'newest' 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="flex-1">Newest First</span>
                  {currentSort === 'newest' && <span className="text-primary">✓</span>}
                </div>
              </button>
              
              <button
                onClick={() => handleSortSelect('oldest')}
                className={`w-full px-3 py-2 text-left font-mono text-xs transition-colors ${
                  currentSort === 'oldest' 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4" />
                  <span className="flex-1">Oldest First</span>
                  {currentSort === 'oldest' && <span className="text-primary">✓</span>}
                </div>
              </button>
              
              <button
                onClick={() => handleSortSelect('most-active')}
                className={`w-full px-3 py-2 text-left font-mono text-xs transition-colors ${
                  currentSort === 'most-active' 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ArrowTrendingUpIcon className="h-4 w-4" />
                  <span className="flex-1">Most Active</span>
                  {currentSort === 'most-active' && <span className="text-primary">✓</span>}
                </div>
              </button>
              
              <button
                onClick={() => handleSortSelect('alphabetical')}
                className={`w-full px-3 py-2 text-left font-mono text-xs transition-colors ${
                  currentSort === 'alphabetical' 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span className="flex-1">Alphabetical</span>
                  {currentSort === 'alphabetical' && <span className="text-primary">✓</span>}
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
