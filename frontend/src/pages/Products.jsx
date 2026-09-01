import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, Loader2, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { productApi } from '../lib/productApi';
import { useCartStore } from '../stores/cartStore';
import GameCard from '../components/GameCard';
import FilterSidebar, { ActiveFilters } from '../components/FilterSidebar';
import toast from 'react-hot-toast';

const PLATFORMS = ['STEAM', 'EPIC', 'GOG', 'XBOX', 'PLAYSTATION', 'BATTLENET', 'UBISOFT', 'NINTENDO'];
const REGIONS = ['GLOBAL', 'NA', 'EU', 'UK', 'ASIA', 'LATAM'];
const PAGE_SIZE = 24;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState(() => new URLSearchParams(window.location.search).get('sort') || 'name');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const location = useLocation();
  const { addToCart } = useCartStore();

  // Debounce the search box so we don't fire a request on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch games whenever any filter, sort, or page changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [productsData, categoriesData] = await Promise.all([
          productApi.getAllProducts(currentPage, PAGE_SIZE, {
            sort: sortBy,
            ...(selectedCategory !== 'All' && { category: selectedCategory }),
            ...(selectedPlatform !== 'All' && { platform: selectedPlatform }),
            ...(selectedRegion !== 'All' && { region: selectedRegion }),
            ...(inStockOnly && { inStock: true }),
            ...(debouncedSearchTerm && { search: debouncedSearchTerm })
          }),
          productApi.getCategories()
        ]);

        setProducts(productsData.products || []);
        setTotalPages(productsData.pagination?.pages || 1);
        setTotalProducts(productsData.pagination?.total || 0);

        const categoryArray = Array.isArray(categoriesData)
          ? categoriesData
          : categoriesData.categories;
        setCategories(categoryArray.map(cat => cat.name));
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Failed to load games');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentPage, selectedCategory, selectedPlatform, selectedRegion, inStockOnly, sortBy, debouncedSearchTerm]);

  // Seed filters from the URL. Categories.jsx links with ?category=, and the
  // homepage platform strip links with ?platform=, so both have to be applied
  // on arrival or the link silently does nothing.
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const cat = params.get('category');
    if (cat && categories.includes(cat)) setSelectedCategory(cat);

    const plat = params.get('platform');
    if (plat && PLATFORMS.includes(plat)) setSelectedPlatform(plat);

    const reg = params.get('region');
    if (reg && REGIONS.includes(reg)) setSelectedRegion(reg);
  }, [location.search, categories]);

  const resetPage = () => setCurrentPage(1);

  const setFilter = (setter) => (value) => {
    setter(value);
    resetPage();
    setDrawerOpen(false);
  };

  // Whatever is currently narrowing the catalogue, so it can be shown and undone
  const activeFilters = [
    selectedCategory !== 'All' && { key: 'category', label: selectedCategory },
    selectedPlatform !== 'All' && { key: 'platform', label: selectedPlatform },
    selectedRegion !== 'All' && { key: 'region', label: selectedRegion },
    inStockOnly && { key: 'inStock', label: 'In stock' },
    debouncedSearchTerm && { key: 'search', label: `"${debouncedSearchTerm}"` }
  ].filter(Boolean);

  const removeFilter = (key) => {
    if (key === 'category') setSelectedCategory('All');
    if (key === 'platform') setSelectedPlatform('All');
    if (key === 'region') setSelectedRegion('All');
    if (key === 'inStock') setInStockOnly(false);
    if (key === 'search') { setSearchTerm(''); setDebouncedSearchTerm(''); }
    resetPage();
  };

  const clearAllFilters = () => {
    setSelectedCategory('All');
    setSelectedPlatform('All');
    setSelectedRegion('All');
    setInStockOnly(false);
    setSearchTerm('');
    setDebouncedSearchTerm('');
    resetPage();
  };

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock > 0) {
      addToCart(product.id, 1);
    } else {
      toast.error('This game is out of stock');
    }
  };

  const sidebarProps = {
    categories,
    platforms: PLATFORMS,
    regions: REGIONS,
    selectedCategory,
    selectedPlatform,
    selectedRegion,
    inStockOnly,
    onCategoryChange: setFilter(setSelectedCategory),
    onPlatformChange: setFilter(setSelectedPlatform),
    onRegionChange: setFilter(setSelectedRegion),
    onInStockChange: setFilter(setInStockOnly)
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-neutral-100 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-neutral-900">Games</h1>
          <p className="text-neutral-600 mt-1">Instant-delivery keys for every major platform</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search + sort, full width above the split */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              placeholder="Search games..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-900"
          >
            <SlidersHorizontal size={16} />
            Filters
            {activeFilters.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-bold">
                {activeFilters.length}
              </span>
            )}
          </button>

          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); resetPage(); }}
            aria-label="Sort games"
            className="px-4 py-2.5 bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="name">Name</option>
            <option value="price">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Rating</option>
            <option value="newest">Newest</option>
            <option value="popular">Most Reviewed</option>
          </select>
        </div>

        <div className="flex gap-6">
          {/* Persistent sidebar on desktop */}
          <FilterSidebar {...sidebarProps} className="hidden lg:block w-60 flex-shrink-0 self-start sticky top-6" />

          <div className="flex-1 min-w-0">
            <ActiveFilters
              filters={activeFilters}
              onRemove={removeFilter}
              onClearAll={clearAllFilters}
            />

            <div className="flex items-center gap-2 mb-4 text-sm text-neutral-600">
              <span>
                {totalProducts} {totalProducts === 1 ? 'game' : 'games'}
                {totalPages > 1 && ` · page ${currentPage} of ${totalPages}`}
              </span>
              {isLoading && <Loader2 size={14} className="animate-spin text-neutral-400" />}
            </div>

            {isLoading && products.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-neutral-100 rounded-xl border border-neutral-200 overflow-hidden animate-pulse">
                    <div className="aspect-[2/3] bg-neutral-200"></div>
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-neutral-200 rounded w-3/4"></div>
                      <div className="h-4 bg-neutral-200 rounded w-full"></div>
                      <div className="h-5 bg-neutral-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 bg-neutral-100 rounded-xl border border-neutral-200">
                <Search size={40} className="mx-auto text-neutral-400 mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 mb-2">No games match those filters</h3>
                <p className="text-neutral-600 mb-5">Try removing one of the filters above.</p>
                {activeFilters.length > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map(product => (
                  <GameCard key={product.id} product={product} onAddToCart={handleAddToCart} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <nav className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 border border-neutral-300 rounded-md hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 text-sm font-medium rounded-md ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'text-neutral-700 bg-neutral-100 border border-neutral-300 hover:bg-neutral-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 border border-neutral-300 rounded-md hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer - a permanent sidebar would cost too much width here */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative ml-auto w-80 max-w-[85vw] h-full bg-neutral-50 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Filters</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-neutral-500 hover:text-neutral-900"
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            </div>
            <FilterSidebar {...sidebarProps} />
          </div>
        </div>
      )}
    </div>
  );
}
