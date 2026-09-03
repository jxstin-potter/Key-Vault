import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Minus, Plus, Trash2, ArrowLeft, ShoppingBag } from 'lucide-react';
import { cn } from '../lib/utils';
import LoginPrompt from '../components/LoginPrompt';

export default function Cart() {
  const { isAuthenticated } = useAuthStore();
  const {
    items,
    removeFromCart,
    updateQuantity,
    getTotal,
    getItemCount,
    loadCart,
    isLoading
  } = useCartStore();

  useEffect(() => {
    if (isAuthenticated) {
      loadCart();
    }
  }, [isAuthenticated, loadCart]);

  const handleQuantityChange = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    await updateQuantity(itemId, newQuantity);
  };

  const handleRemoveItem = async (itemId) => {
    await removeFromCart(itemId);
  };

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginPrompt 
        title="Login to View Your Cart"
        message="Please login to view and manage your shopping cart. Your cart items will be saved once you're logged in."
        showCartIcon={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/products" 
            className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            Continue Shopping
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900">Your Cart</h1>
          <p className="text-neutral-600 mt-2">
            {getItemCount()} {getItemCount() === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>

        {items.length === 0 ? (
          <div className="bg-neutral-100 rounded-xl shadow-soft p-12 text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={32} className="text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">Your cart is empty</h2>
            <p className="text-neutral-600 mb-6">Looks like you haven't added any items to your cart yet.</p>
            <Link 
              to="/products" 
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              <ShoppingBag size={20} />
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-neutral-100 rounded-xl shadow-soft p-6">
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">Cart Items</h2>
                <div className="space-y-4">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-4 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        <img 
                          src={item.product.images[0] || item.product.image} 
                          alt={item.product.name} 
                          className="w-20 h-20 object-cover rounded-lg border border-neutral-200" 
                        />
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral-900 truncate">{item.product.name}</h3>
                        <p className="text-neutral-600 text-sm">${item.product.price}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded-full">
                            {item.product.category?.name || 'General'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1 || isLoading}
                          className={cn(
                            "p-1 rounded-md transition-colors",
                            item.quantity <= 1 || isLoading
                              ? "text-neutral-300 cursor-not-allowed"
                              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                          )}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-12 text-center font-medium text-neutral-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          disabled={isLoading}
                          className={cn(
                            "p-1 rounded-md transition-colors",
                            isLoading
                              ? "text-neutral-300 cursor-not-allowed"
                              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                          )}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      
                      {/* Price */}
                      <div className="text-right min-w-0">
                        <div className="font-bold text-neutral-900">
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </div>
                        {item.quantity > 1 && (
                          <div className="text-sm text-neutral-500">
                            ${item.product.price} each
                          </div>
                        )}
                      </div>
                      
                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isLoading}
                        className={cn(
                          "p-2 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors",
                          isLoading && "cursor-not-allowed"
                        )}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-neutral-100 rounded-xl shadow-soft p-6 sticky top-8">
                <h3 className="text-xl font-semibold text-neutral-900 mb-6">Order Summary</h3>
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal ({getItemCount()} {getItemCount() === 1 ? 'key' : 'keys'})</span>
                    <span>${getTotal().toFixed(2)}</span>
                  </div>
                  <div className="border-t border-neutral-200 pt-4">
                    <div className="flex justify-between text-lg font-bold text-neutral-900">
                      <span>Total</span>
                      <span>${getTotal().toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-neutral-500 mt-1">Digital delivery, no shipping</p>
                  </div>
                </div>

                <Link
                  to="/checkout"
                  className={cn(
                    "w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-semibold text-center transition-colors",
                    isLoading
                      ? "bg-neutral-300 cursor-not-allowed"
                      : "hover:bg-primary-700"
                  )}
                >
                  {isLoading ? "Processing..." : "Proceed to Checkout"}
                </Link>
                
                <div className="mt-4 text-center">
                  <Link 
                    to="/products" 
                    className="text-sm text-neutral-600 hover:text-primary-600 transition-colors"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 