import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Gamepad2 } from 'lucide-react';
import { cn } from '../lib/utils';

// Real brand colors so a badge is recognizable at a glance, the way G2A/Kinguin
// use platform icons - we use text since no brand-icon library is installed.
const PLATFORM_STYLES = {
  STEAM: 'bg-[#1b2838]',
  EPIC: 'bg-black',
  GOG: 'bg-[#8c2ce0]',
  XBOX: 'bg-[#107c10]',
  PLAYSTATION: 'bg-[#003791]',
  BATTLENET: 'bg-[#00a3e0]',
  UBISOFT: 'bg-[#000f9f]',
  NINTENDO: 'bg-[#e60012]'
};

// Release dates are stored at midnight UTC; without pinning the timezone a
// negative-offset viewer sees the previous day.
const releaseYear = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' }) : null;

/**
 * The single shared product tile. Consumes the RAW API product shape only
 * (product.stock, product.averageRating, product.reviewCount,
 * product.category.name, product.platform, product.region) - no page should
 * reshape a product before handing it to this component.
 */
export default function GameCard({ product, onAddToCart }) {
  const [imgFailed, setImgFailed] = useState(false);

  const rating = product.averageRating || 0;
  const reviewCount = product.reviewCount || 0;
  const outOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock < 10;
  const image = product.images?.[0];
  const year = releaseYear(product.releaseDate);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart?.(e, product);
  };

  return (
    <div className="group relative flex flex-col bg-neutral-100 rounded-xl border border-neutral-200 overflow-hidden hover:shadow-medium hover:-translate-y-0.5 transition-all duration-200">
      <Link to={`/products/${product.id}`} className="flex flex-col flex-1">
        <div className="relative aspect-[2/3] overflow-hidden bg-neutral-200">
          {image && !imgFailed ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-200">
              <Gamepad2 size={40} className="text-neutral-400" />
            </div>
          )}

          <span
            className={cn(
              'absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-white',
              PLATFORM_STYLES[product.platform] || 'bg-black'
            )}
          >
            {product.platform}
          </span>

          {outOfStock && (
            <span className="absolute top-2 right-2 bg-error-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
              Out of Stock
            </span>
          )}
          {lowStock && (
            <span className="absolute top-2 right-2 bg-yellow-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
              Only {product.stock} left
            </span>
          )}
        </div>

        <div className="p-3 pb-0 flex-1">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-[10px] font-medium text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded">
              {product.category?.name || 'General'}
            </span>
            {product.region && (
              <span className="text-[10px] font-medium text-neutral-500 bg-neutral-200 px-1.5 py-0.5 rounded">
                {product.region}
              </span>
            )}
          </div>

          <h3 className="font-semibold text-neutral-900 text-sm leading-snug mb-1 line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </h3>

          {/* The API has always returned these; the card used to discard them.
              At four columns there is room to show what a shopper compares on. */}
          {(product.developer || year) && (
            <p className="text-[11px] text-neutral-500 mb-1.5 truncate">
              {[product.developer, year].filter(Boolean).join(' · ')}
            </p>
          )}

          <div className="flex items-center gap-1 mb-2">
            <Star
              size={12}
              className={rating > 0 ? 'text-accent-500 fill-current' : 'text-neutral-300'}
            />
            <span className="text-xs text-neutral-600">
              {rating > 0 ? rating.toFixed(1) : '-'} ({reviewCount})
            </span>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between p-3 pt-0">
        <span className="text-lg font-bold text-neutral-900">${product.price}</span>
        <button
          onClick={handleAddToCart}
          disabled={outOfStock}
          title={outOfStock ? 'Out of stock' : 'Add to cart'}
          className={cn(
            'p-2 rounded-lg transition-colors',
            outOfStock
              ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          )}
        >
          <ShoppingCart size={16} />
        </button>
      </div>
    </div>
  );
}
