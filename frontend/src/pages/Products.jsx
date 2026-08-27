import { useState, useEffect } from 'react';
import { Search, Filter, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { productApi } from '../lib/productApi';
import { useCartStore } from '../stores/cartStore';
import GameCard from '../components/GameCard';
import toast from 'react-hot-toast';

const PLATFORMS = ['STEAM', 'EPIC', 'GOG', 'XBOX', 'PLAYSTATION', 'BATTLENET', 'UBISOFT', 'NINTENDO'];
const REGIONS = ['GLOBAL', 'NA', 'EU', 'UK', 'ASIA', 'LATAM'];

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
  const [showFilters, setShowFilters] = useState(false);
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
          productApi.getAllProducts(currentPage, 24, {
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

  // On mount, seed the category filter from a ?category= query param (used by
  // Categories.jsx links)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category');
    if (cat && categories.includes(cat)) {
      setSelectedCategory(cat);
    }
  }, [location.search, categories]);

  const resetPage = () => setCurrentPage(1);

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock > 0) {
      addToCart(product.id, 1);
    } else {
      toast.error('This game is out of stock');
    }
  };

  // Loading state
  if (isLoading && products.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="h-8 bg-neutral-200 rounded w-1/3 mb-4 animate-pulse"></div>
            <div className="h-4 bg-neutral-200 rounded w-1/2 animate-pulse"></div>
          </div>

          <div className="flex flex-wrap gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-neutral-200 rounded w-32 animate-pulse"></div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-neutral-200 overflow-hidden animate-pulse">
                <div className="aspect-[2/3] bg-neutral-200"></div>
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-neutral-200 rounded w-3/4"></div>
                  <div className="h-4 bg-neutral-200 rounded w-full"></div>
                  <div className="h-5 bg-neutral-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-neutral-900">Games</h1>
          <p className="text-neutral-600 mt-1">Instant-delivery keys for every major platform</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-soft p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Genre Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); resetPage(); }}
              className="px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="All">All Genres</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); resetPage(); }}
              className="px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="name">Name</option>
              <option value="price">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Rating</option>
              <option value="newest">Newest</option>
              <option value="popular">Most Reviewed</option>
            </select>

            {/* More filters toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <Filter size={16} />
              <span>Filters</span>
            </button>
          </div>

          {/* Platform / Region / Stock filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-neutral-200 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Platform</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => { setSelectedPlatform(e.target.value); resetPage(); }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="All">All Platforms</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Region</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => { setSelectedRegion(e.target.value); resetPage(); }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="All">All Regions</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => { setInStockOnly(e.target.checked); resetPage(); }}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-neutral-700">In stock only</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="mb-6 flex items-center gap-2">
          <p className="text-neutral-600">
            Showing {products.length} of {totalProducts} games (Page {currentPage} of {totalPages})
          </p>
          {isLoading && <Loader2 size={16} className="animate-spin text-neutral-400" />}
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {products.map(product => (
            <GameCard key={product.id} product={product} onAddToCart={handleAddToCart} />
          ))}
        </div>

        {/* Empty state */}
        {products.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="text-neutral-400 mb-4">
              <Search size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No games found</h3>
            <p className="text-neutral-600">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <nav className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-neutral-500 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        : 'text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-neutral-500 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
