import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ShoppingCart, ArrowLeft, Star, Tag, Minus, Plus, CheckCircle, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { productApi } from '../lib/productApi';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [showCartPreview, setShowCartPreview] = useState(true);
  
  const { addToCart, isInCart, getCartItem, updateQuantity, removeFromCart, isLoading: cartLoading, getItemCount } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  
  // Fetch product on mount
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        const productData = await productApi.getProductById(id);
        setProduct(productData.product || productData);
      } catch (error) {
        console.error('Failed to fetch product:', error);
        toast.error('Failed to load product');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // Check if product is already in cart
  const cartItem = product ? getCartItem(product.id) : null;
  const isProductInCart = product ? isInCart(product.id) : false;

  // Update quantity if product is in cart
  useEffect(() => {
    if (cartItem) {
      setQuantity(cartItem.quantity);
    }
  }, [cartItem]);

  // Sync cart on mount
  useEffect(() => {
    const { loadCart } = useCartStore.getState();
    if (isAuthenticated) {
      loadCart();
    }
  }, [isAuthenticated]);

  const handleQuantityChange = (newQuantity) => {
    if (newQuantity < 1) return;
    
    // Check stock limit
    const maxQuantity = Math.min(10, product?.stock || 10);
    if (newQuantity > maxQuantity) {
      toast.error(`Only ${maxQuantity} items available in stock`);
      return;
    }
    
    setQuantity(newQuantity);
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to add items to cart');
      // Navigate to login page with return URL
      navigate('/login', { state: { from: `/products/${product.id}` } });
      return;
    }

    if (product.stock === 0) {
      toast.error('This product is out of stock');
      return;
    }

    try {
      await addToCart(product.id, quantity);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  const handleUpdateQuantity = async (newQuantity) => {
    if (!cartItem) return;
    
    try {
      await updateQuantity(cartItem.id, newQuantity);
      setQuantity(newQuantity);
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  const handleRemoveFromCart = async () => {
    if (!cartItem) return;
    
    try {
      await removeFromCart(cartItem.id);
      setQuantity(1);
    } catch (error) {
      console.error('Failed to remove from cart:', error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image skeleton */}
            <div className="aspect-square bg-neutral-200 rounded-xl animate-pulse"></div>
            
            {/* Content skeleton */}
            <div className="space-y-6">
              <div className="h-8 bg-neutral-200 rounded w-3/4 animate-pulse"></div>
              <div className="h-6 bg-neutral-200 rounded w-1/4 animate-pulse"></div>
              <div className="h-4 bg-neutral-200 rounded w-1/2 animate-pulse"></div>
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-neutral-200 rounded animate-pulse"></div>
                ))}
              </div>
              <div className="h-12 bg-neutral-200 rounded w-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Product not found
  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="inline-block mr-2" size={18} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 bg-neutral-100 rounded-2xl shadow-none md:shadow-large p-0 md:p-12">
        {/* Product Image */}
        <div className="flex flex-col items-center justify-center md:items-start md:justify-start">
          <img
            src={product.images?.[0] || product.image}
            alt={product.name}
            className="w-full max-w-md rounded-xl object-cover mb-8 md:mb-0 md:sticky md:top-24 shadow-none"
            style={{ aspectRatio: '3/4', background: '#171d1a' }}
          />
        </div>

        {/* Product Info */}
        <div className="flex flex-col justify-between h-full">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="mb-8 text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <ArrowLeft size={18} /> Back
            </button>
            
            {/* Product Badges */}
            <div className="flex items-center gap-2 mb-4">
              {product.stock === 0 && (
                <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Out of Stock
                </span>
              )}
              {product.stock > 0 && product.stock < 10 && (
                <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Low Stock
                </span>
              )}
            </div>

            <h1 className="text-4xl font-light text-neutral-900 mb-4 tracking-tight leading-tight">{product.name}</h1>
            
            {/* Price Section */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-neutral-900">${product.price}</span>
              </div>
              <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded-full">{product.category?.name || 'General'}</span>
              {product.platform && (
                <span className="text-xs font-medium text-primary-700 bg-primary-100 px-2 py-1 rounded-full">
                  {product.platform}
                </span>
              )}
              {product.region && (
                <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded-full">
                  {product.region}
                </span>
              )}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={cn(
                      i < Math.floor(product.averageRating || 0) 
                        ? "text-yellow-400 fill-current" 
                        : "text-neutral-300"
                    )}
                  />
                ))}
              </div>
              <span className="text-sm text-neutral-600">({product.reviewCount || 0} reviews)</span>
            </div>

            <div className="border-b border-neutral-200 mb-8"></div>
            
            {/* Description */}
            <p className="text-base text-neutral-700 mb-8 leading-relaxed">{product.description}</p>
            
            {/* Game details */}
            <div className="mb-8">
              <h3 className="font-semibold text-neutral-900 mb-4">Details</h3>
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-neutral-500">Platform</dt>
                <dd className="text-neutral-900 font-medium">{product.platform || '-'}</dd>

                <dt className="text-neutral-500">Region</dt>
                <dd className="text-neutral-900 font-medium">{product.region || '-'}</dd>

                {product.developer && (
                  <>
                    <dt className="text-neutral-500">Developer</dt>
                    <dd className="text-neutral-900 font-medium">{product.developer}</dd>
                  </>
                )}

                {product.publisher && (
                  <>
                    <dt className="text-neutral-500">Publisher</dt>
                    <dd className="text-neutral-900 font-medium">{product.publisher}</dd>
                  </>
                )}

                {product.releaseDate && (
                  <>
                    <dt className="text-neutral-500">Released</dt>
                    <dd className="text-neutral-900 font-medium">
                      {new Date(product.releaseDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        // Release dates are stored at midnight UTC; without this a
                        // negative-offset timezone renders the previous day.
                        timeZone: 'UTC'
                      })}
                    </dd>
                  </>
                )}
              </dl>
              <p className="text-xs text-neutral-500 mt-4">
                Delivered as a redeemable {product.platform || 'store'} key. Check the region before buying.
              </p>
            </div>
          </div>

          {/* Sticky Add to Cart Section */}
          <div className="mt-8 md:mt-0 md:sticky md:bottom-12 bg-neutral-50/80 md:bg-neutral-50/90 md:backdrop-blur-md rounded-xl md:shadow-soft p-6 flex flex-col gap-4 border border-neutral-100">
            {/* Stock Status */}
            <div className="flex items-center gap-4">
              {product.stock > 0 ? (
                <span className="text-xs text-success-700 bg-success-100 px-2 py-1 rounded-full font-medium">
                  In Stock ({product.stock} {product.stock === 1 ? 'key' : 'keys'})
                </span>
              ) : (
                <span className="text-xs text-error-700 bg-error-100 px-2 py-1 rounded-full font-medium">Out of Stock</span>
              )}
              
              {isProductInCart && (
                <span className="text-xs text-primary-700 bg-primary-100 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <CheckCircle size={12} />
                  In Cart ({cartItem?.quantity || 0})
                </span>
              )}
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center gap-4">
              <label htmlFor="quantity" className="text-sm text-neutral-700 font-medium">Qty:</label>
              <div className="flex items-center border border-neutral-200 rounded-lg">
                <button
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                  className={cn(
                    "p-2 transition-colors",
                    quantity <= 1
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <Minus size={16} />
                </button>
                <input
                  id="quantity"
                  type="number"
                  min={1}
                  max={Math.min(10, product?.stock || 10)}
                  value={quantity}
                  onChange={e => handleQuantityChange(Number(e.target.value))}
                  className="w-16 px-3 py-2 text-center border-0 focus:ring-0 focus:outline-none bg-transparent"
                />
                <button
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={quantity >= Math.min(10, product?.stock || 10)}
                  className={cn(
                    "p-2 transition-colors",
                    quantity >= Math.min(10, product?.stock || 10)
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {isProductInCart ? (
                <>
                  <button
                    onClick={() => handleUpdateQuantity(quantity)}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isLoading ? "Updating..." : "Update Cart"}
                  </button>
                  <button
                    onClick={handleRemoveFromCart}
                    disabled={isLoading}
                    className="py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock === 0 || isLoading}
                  className={cn(
                    "w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-lg",
                    product.stock > 0 && !isLoading
                      ? "bg-primary-600 text-white hover:bg-primary-700 shadow-none hover:shadow-md"
                      : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                  )}
                >
                  <ShoppingCart size={22} />
                  {isLoading ? "Adding..." : "Add to Cart"}
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-2 pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between text-sm text-neutral-600">
                <span>Quick Actions:</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/cart')}
                    className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    View Cart
                  </button>
                  <button
                    onClick={() => navigate('/checkout')}
                    className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    Checkout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Products Placeholder */}
      <div className="max-w-6xl mx-auto mt-24">
        <h2 className="text-2xl font-light text-neutral-900 mb-8 tracking-tight">Recommended Products</h2>
        <div className="bg-neutral-100 rounded-xl p-12 text-neutral-400 text-center text-lg">
          (Recommended products carousel coming soon)
        </div>
      </div>

      {/* Floating Cart Preview */}
      {getItemCount() > 0 && showCartPreview && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-neutral-100 rounded-xl shadow-large border border-neutral-200 p-4 max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-neutral-900">Cart Preview</h3>
              <button
                onClick={() => setShowCartPreview(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <ShoppingCart size={20} className="text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900">{getItemCount()} items in cart</p>
                <p className="text-xs text-neutral-600">Ready to checkout</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/cart')}
                className="flex-1 py-2 px-3 text-sm font-medium text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
              >
                View Cart
              </button>
              <button
                onClick={() => navigate('/checkout')}
                className="flex-1 py-2 px-3 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Small Cart Indicator (when preview is dismissed) */}
      {getItemCount() > 0 && !showCartPreview && (
        <div className="fixed top-6 right-6 z-50">
          <button
            onClick={() => setShowCartPreview(true)}
            className="bg-primary-600 text-white rounded-full p-3 shadow-large hover:bg-primary-700 transition-colors"
          >
            <div className="relative">
              <ShoppingCart size={20} />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {getItemCount()}
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
} 