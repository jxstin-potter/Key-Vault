import { ChevronLeft, ChevronRight } from 'lucide-react';
import '../index.css';
import { useState, useRef, useEffect } from 'react';
import GameCard from './GameCard';

export default function ProductCarousel({ products, onAddToCart }) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollContainerRef = useRef(null);

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    window.addEventListener('resize', checkScrollButtons);
    return () => window.removeEventListener('resize', checkScrollButtons);
  }, [products]);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      setIsScrolling(true);
      const scrollAmount = 320;
      const newScrollLeft = scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });

      // Reset scrolling state after animation
      setTimeout(() => setIsScrolling(false), 500);
    }
  };

  const handleScroll = () => {
    checkScrollButtons();
  };

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-neutral-500">No games available</p>
      </div>
    );
  }

  return (
    <div className="relative w-full group">
      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          disabled={isScrolling}
          aria-label="Scroll left"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white text-primary-600 shadow-lg p-2 rounded-full border border-neutral-200 transition-all duration-200 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          disabled={isScrolling}
          aria-label="Scroll right"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white text-primary-600 shadow-lg p-2 rounded-full border border-neutral-200 transition-all duration-200 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 px-2"
      >
        {products.map(product => (
          <div key={product.id} className="shrink-0 w-[180px] sm:w-[200px]">
            <GameCard product={product} onAddToCart={onAddToCart} />
          </div>
        ))}
      </div>
    </div>
  );
}
