import { useState, useEffect } from 'react';
import { Search, Filter, Grid, List, Star, Heart, ShoppingCart, Eye, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Link, useLocation } from 'react-router-dom';
import { productApi } from '../lib/productApi';
import { useCartStore } from '../stores/cartStore';
import toast from 'react-hot-toast';

//products page
export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'price', 'rating'
  const [priceRange, setPriceRange] = useState([0, 1000]);
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

  // Fetch products and categories whenever the page, category, or search changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [productsData, categoriesData] = await Promise.all([
          productApi.getAllProducts(currentPage, 10, {
            ...(selectedCategory !== 'All' && { category: selectedCategory }),
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
        toast.error('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentPage, selectedCategory, debouncedSearchTerm]);

  // On mount, set category from query param if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category');
    if (cat && categories.includes(cat)) {
      setSelectedCategory(cat);
    }
  }, [location.search, categories]);

  // Use products directly since we're using server-side pagination
  const filteredProducts = products;

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock > 0) {
      addToCart(product.id, 1);
    } else {
      toast.error('Product is out of stock');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header skeleton */}
          <div className="mb-8">
            <div className="h-8 bg-neutral-200 rounded w-1/3 mb-4 animate-pulse"></div>
            <div className="h-4 bg-neutral-200 rounded w-1/2 animate-pulse"></div>
          </div>
          
          {/* Filters skeleton */}
          <div className="flex flex-wrap gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-neutral-200 rounded w-32 animate-pulse"></div>
            ))}
          </div>
          
          {/* Products grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-soft animate-pulse">
                <div className="aspect-square bg-neutral-200 rounded-t-xl"></div>
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                  <div className="h-6 bg-neutral-200 rounded w-1/2"></div>
                  <div className="h-4 bg-neutral-200 rounded w-1/4"></div>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Products</h1>
              <p className="text-neutral-600 mt-1">Discover amazing products for your lifestyle</p>
            </div>
            
            {/* View mode toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  viewMode === 'grid' 
                    ? "bg-primary-100 text-primary-600" 
                    : "text-neutral-400 hover:text-neutral-600"
                )}
              >
                <Grid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  viewMode === 'list' 
                    ? "bg-primary-100 text-primary-600" 
                    : "text-neutral-400 hover:text-neutral-600"
                )}
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-soft p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-4">
              <Filter className="text-neutral-400" size={20} />
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="All">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-4">
              <span className="text-neutral-600">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="name">Name</option>
                <option value="price">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Rating</option>
                <option value="newest">Newest</option>
              </select>
            </div>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <Filter size={16} />
              <span>Filters</span>
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-neutral-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Price Range: ${priceRange[0]} - ${priceRange[1]}
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Availability
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                      <span className="ml-2 text-sm text-neutral-600">In Stock</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                      <span className="ml-2 text-sm text-neutral-600">On Sale</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="mb-6">
          <p className="text-neutral-600">
            Showing {filteredProducts.length} of {totalProducts} products (Page {currentPage} of {totalPages})
          </p>
        </div>

        {/* Products Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map(product => (
              <ProductListItem key={product.id} product={product} onAddToCart={handleAddToCart} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-neutral-400 mb-4">
              <Search size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No products found</h3>
            <p className="text-neutral-600">Try adjusting your search or filter criteria</p>
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

// Product Card Component (Grid View)
function ProductCard({ product, onAddToCart }) {
  const [isHovered, setIsHovered] = useState(false);

  // Get the first image or fallback
  const getImageUrl = (product) => {
    if (product.images && product.images.length > 0) {
      return product.images[0].replace('http://', 'https://');
    }
    return 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop';
  };

  return (
    <div 
      className="bg-white rounded-xl shadow-soft hover:shadow-medium transition-all duration-200 overflow-hidden group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link to={`/products/${product.id}`}>
        <div className="relative aspect-square overflow-hidden">
          <img
            src={getImageUrl(product)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop';
            }}
          />
          
          {/* Badges */}
          {product.stock === 0 && (
            <div className="absolute top-2 right-2 bg-error-500 text-white px-2 py-1 rounded-full text-xs font-medium">
              Out of Stock
            </div>
          )}
          {product.stock > 0 && product.stock < 10 && (
            <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-medium">
              Low Stock
            </div>
          )}

          {/* Quick Actions Overlay */}
          {isHovered && (
            <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center gap-2">
              <button
                onClick={(e) => onAddToCart(e, product)}
                disabled={product.stock === 0}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add to Cart"
              >
                <ShoppingCart size={16} className="text-neutral-700" />
              </button>
              <button
                className="p-2 bg-white rounded-full shadow-lg hover:bg-primary-50 transition-colors"
                title="Quick View"
              >
                <Eye size={16} className="text-neutral-700" />
              </button>
              <button
                className="p-2 bg-white rounded-full shadow-lg hover:bg-primary-50 transition-colors"
                title="Add to Wishlist"
              >
                <Heart size={16} className="text-neutral-700" />
              </button>
            </div>
          )}
        </div>
      </Link>
      
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-1 rounded-full">
            {product.category?.name || 'General'}
          </span>
        </div>
        
        <h3 className="font-semibold text-neutral-900 mb-2 overflow-hidden text-ellipsis whitespace-nowrap">
          {product.name}
        </h3>
        
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={cn(
                  "w-4 h-4",
                  i < Math.floor(product.averageRating || 0) 
                    ? "text-accent-500 fill-current" 
                    : "text-neutral-300"
                )}
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-sm text-neutral-600">({product.reviewCount || 0})</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-neutral-900">${product.price}</span>
          </div>
          <button
            onClick={(e) => onAddToCart(e, product)}
            disabled={product.stock === 0}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-colors",
              product.stock > 0
                ? "bg-primary-600 text-white hover:bg-primary-700"
                : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
            )}
          >
            {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Product List Item Component (List View)
function ProductListItem({ product }) {
  // Get the first image or fallback
  const getImageUrl = (product) => {
    if (product.images && product.images.length > 0) {
      return product.images[0].replace('http://', 'https://');
    }
    return 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop';
  };

  return (
    <div className="bg-white rounded-xl shadow-soft p-6 flex gap-6">
      <div className="relative w-24 h-24 flex-shrink-0">
        <img
          src={getImageUrl(product)}
          alt={product.name}
          className="w-full h-full object-cover rounded-lg"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop';
          }}
        />
        {!product.inStock && (
          <div className="absolute top-1 right-1 bg-error-500 text-white px-1 py-0.5 rounded text-xs">
            Out
          </div>
        )}
        {product.isNew && (
          <div className="absolute top-1 left-1 bg-green-500 text-white px-1 py-0.5 rounded text-xs">
            New
          </div>
        )}
        {product.discount && (
          <div className="absolute top-1 left-1 bg-red-500 text-white px-1 py-0.5 rounded text-xs">
            {product.discount}%
          </div>
        )}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-1 rounded-full">
            {product.category}
          </span>
        </div>
        
        <h3 className="font-semibold text-neutral-900 mb-2">{product.name}</h3>
        
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={cn(
                  "w-4 h-4",
                  i < Math.floor(product.rating) 
                    ? "text-accent-500 fill-current" 
                    : "text-neutral-300"
                )}
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-sm text-neutral-600">({product.reviews})</span>
        </div>
      </div>
      
      <div className="flex flex-col items-end justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-neutral-900">${product.price}</span>
          {product.originalPrice && (
            <span className="text-sm text-neutral-400 line-through">${product.originalPrice}</span>
          )}
        </div>
        <button
          disabled={!product.inStock}
          className={cn(
            "px-4 py-2 rounded-lg font-medium transition-colors",
            product.inStock
              ? "bg-primary-600 text-white hover:bg-primary-700"
              : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
          )}
        >
          {product.inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
} 