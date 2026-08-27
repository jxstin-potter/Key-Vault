import ProductCarousel from '../components/ProductCarousel';
import ParallaxValueProps from '../components/ParallaxValueProps';
import Footer from '../components/layout/Footer';
import { TrendingUp, Sparkles, Zap, ArrowRight, Shield, Clock } from 'lucide-react';
import { useRef, useState, useEffect, useMemo } from 'react';
import { productApi } from '../lib/productApi';
import { Link } from 'react-router-dom';
import { useCartStore } from '../stores/cartStore';
import toast from 'react-hot-toast';

function ProductRow({ title, products, seeMoreLink, icon: Icon, isLoading, onAddToCart }) {
  if (isLoading) {
    return (
      <section className="w-full py-12 bg-gradient-to-b from-neutral-50 to-neutral-100 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {Icon && <Icon className="text-primary-600" size={24} />}
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">{title}</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
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
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="w-full py-12 bg-gradient-to-b from-neutral-50 to-neutral-100 border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {Icon && <Icon className="text-primary-600" size={24} />}
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">{title}</h2>
          </div>
          {seeMoreLink && (
            <Link to={seeMoreLink} className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors">
              See more
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
        <ProductCarousel products={products} onAddToCart={onAddToCart} />
      </div>
    </section>
  );
}

export default function Home() {
  const topRef = useRef(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToCart } = useCartStore();

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);



  // Fetch products on mount (fetch multiple pages for homepage sections)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        // Fetch 30 products in one request to have enough for homepage sections
        const result = await productApi.getAllProducts(1, 30);
        setProducts(result.products || []);
      } catch (error) {
        console.error('Failed to fetch products:', error);
        toast.error('Failed to load products. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleBackToTop = () => {
    if (topRef.current) topRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAddToCart = async (e, product) => {
    if (product.stock === 0) return;
    await addToCart(product.id, 1);
  };

  // Calculate categorized products with uniqueness using useMemo
  const categorizedProducts = useMemo(() => {
    if (products.length === 0) {
      return { bestSellers: [], newReleases: [], bestSales: [] };
    }

    const usedIds = new Set();
    const result = { bestSellers: [], newReleases: [], bestSales: [] };

    // Helper function to get unique products
    const getUniqueProducts = (productList, maxCount = 6) => {
      const uniqueProducts = productList.filter(product => !usedIds.has(product.id));
      const selected = uniqueProducts.slice(0, maxCount);
      selected.forEach(product => usedIds.add(product.id));
      return selected;
    };

    // Get Best Sellers
    let bestSellers = products
      .filter(product => product.averageRating >= 4.5 && product.reviewCount >= 50)
      .sort((a, b) => b.averageRating - a.averageRating);

    if (bestSellers.length === 0) {
      bestSellers = products
        .filter(product => product.averageRating > 0)
        .sort((a, b) => b.averageRating - a.averageRating);
    }

    if (bestSellers.length === 0) {
      bestSellers = products
        .filter(product => product.stock > 0 && product.stock <= 30)
        .sort((a, b) => a.stock - b.stock);
    }

    if (bestSellers.length === 0) {
      bestSellers = products.slice(0, 6);
    }

    result.bestSellers = getUniqueProducts(bestSellers, 6);

    // Get New Releases
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let newReleases = products
      .filter(product => new Date(product.createdAt) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (newReleases.length === 0) {
      newReleases = products
        .filter(product => product.stock > 50)
        .sort((a, b) => b.stock - a.stock);
    }

    if (newReleases.length === 0) {
      const midPoint = Math.floor(products.length / 2);
      newReleases = products.slice(midPoint, midPoint + 6);
    }

    result.newReleases = getUniqueProducts(newReleases, 6);

    // Get Best Sales
    let bestSales = products
      .filter(product => product.stock > 0 && product.stock <= 20)
      .sort((a, b) => a.stock - b.stock);

    if (bestSales.length === 0) {
      bestSales = products
        .filter(product => product.stock > 0 && product.stock <= 50)
        .sort((a, b) => a.stock - b.stock);
    }

    if (bestSales.length === 0) {
      bestSales = products
        .filter(product => parseFloat(product.price) > 50)
        .sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    }

    result.bestSales = getUniqueProducts(bestSales, 6);

    return result;
  }, [products]);



  // GameCard and ProductCarousel consume the raw API product shape directly,
  // so the categorized lists need no reshaping before being handed down.
  const { bestSellers, newReleases, bestSales } = categorizedProducts;

  return (
    <>
      <div ref={topRef} />
      {/* Hero Section */}
      <section className="min-h-[80vh] w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-50 via-neutral-50 to-secondary-50 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary-500 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-4xl mx-auto text-center w-full relative z-10">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
              <Sparkles size={16} />
              Instant delivery, 24/7
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-neutral-900 mb-4 sm:mb-6 tracking-tight leading-tight">
            Game Keys,
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600">
              Delivered Instantly
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-neutral-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Genuine keys for Steam, Epic, GOG, Xbox and PlayStation. Pay securely,
            redeem in seconds, and start playing tonight.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/products"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-semibold rounded-lg hover:from-primary-700 hover:to-secondary-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Browse Games
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/categories"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 border-2 border-neutral-300 text-neutral-700 font-semibold rounded-lg hover:border-primary-600 hover:text-primary-600 transition-all duration-200"
            >
              Browse Genres
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 sm:gap-8 text-sm text-neutral-600">
          <div className="flex items-center gap-2">
            <Zap size={16} />
            <span className="hidden sm:inline">Instant Delivery</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={16} />
            <span className="hidden sm:inline">Secure Payment</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span className="hidden sm:inline">24/7 Support</span>
          </div>
        </div>
      </section>

      {/* Product Rows */}
      <ProductRow 
        title="Best Sellers" 
        products={bestSellers} 
        seeMoreLink="/products?sort=rating" 
        icon={TrendingUp}
        isLoading={isLoading}
        onAddToCart={handleAddToCart}
      />
      <ProductRow 
        title="New Releases" 
        products={newReleases} 
        seeMoreLink="/products?sort=newest" 
        icon={Sparkles}
        isLoading={isLoading}
        onAddToCart={handleAddToCart}
      />
      <ProductRow 
        title="Popular Right Now" 
        products={bestSales} 
        seeMoreLink="/products?sort=popular" 
        icon={Zap}
        isLoading={isLoading}
        onAddToCart={handleAddToCart}
      />

      {/* Value Props (padded section) */}
      <section className="w-full flex flex-col items-center justify-center px-0 py-16 sm:py-20 bg-gradient-to-b from-neutral-50 to-neutral-100">
        <ParallaxValueProps />
      </section>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={handleBackToTop}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 text-white rounded-full shadow-lg p-3 transition-all duration-200 transform hover:scale-110"
          aria-label="Back to top"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </>
  );
} 