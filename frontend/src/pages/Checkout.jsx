import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Loader2, ShoppingBag, KeyRound } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function Checkout() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { items, getTotal, getItemCount, loadCart } = useCartStore();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const subtotal = getTotal();
  const itemCount = getItemCount();

  const handlePay = async () => {
    setIsRedirecting(true);
    try {
      // The server rebuilds the basket from the database and prices it there;
      // nothing about the amount is sent from the browser.
      const { data } = await api.post('/checkout/session');
      window.location.href = data.url;
    } catch (error) {
      const status = error.response?.status;
      const message =
        status === 503
          ? 'Payments are not configured yet. Please try again later.'
          : error.response?.data?.message || 'Could not start checkout';
      toast.error(message);
      setIsRedirecting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-neutral-100 rounded-xl shadow-soft p-12 text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={32} className="text-neutral-400" />
            </div>
            <h1 className="text-xl font-semibold text-neutral-900 mb-2">Your cart is empty</h1>
            <p className="text-neutral-600 mb-6">Add a game before checking out.</p>
            <button
              onClick={() => navigate('/products')}
              className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700"
            >
              Browse games
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-2xl mx-auto w-full">
        <Link
          to="/cart"
          className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors mb-4"
        >
          <ArrowLeft size={20} />
          Back to cart
        </Link>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Checkout</h1>
        <p className="text-neutral-600 mb-8">
          Digital keys - nothing ships, so there is no address to enter.
        </p>

        <div className="bg-neutral-100 rounded-xl shadow-soft p-6 mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Order summary</h2>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4">
                <img
                  src={item.product.images?.[0]}
                  alt={item.product.name}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 truncate">{item.product.name}</p>
                  <p className="text-sm text-neutral-600">
                    {item.quantity} {item.quantity === 1 ? 'key' : 'keys'}
                  </p>
                </div>
                <p className="font-medium text-neutral-900">
                  ${(Number(item.product.price) * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between">
            <span className="font-semibold text-neutral-900">
              Total ({itemCount} {itemCount === 1 ? 'key' : 'keys'})
            </span>
            <span className="text-xl font-bold text-neutral-900">${subtotal.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handlePay}
          disabled={isRedirecting}
          className={cn(
            'w-full py-4 rounded-lg font-medium text-lg flex items-center justify-center gap-2 transition-colors',
            isRedirecting
              ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          )}
        >
          {isRedirecting ? <Loader2 size={20} className="animate-spin" /> : <Lock size={20} />}
          {isRedirecting ? 'Taking you to Stripe…' : `Pay $${subtotal.toFixed(2)}`}
        </button>

        <div className="mt-4 space-y-2 text-center">
          <p className="text-sm text-neutral-600 flex items-center justify-center gap-2">
            <Lock size={14} /> Secure checkout powered by Stripe
          </p>
          <p className="text-sm text-neutral-600 flex items-center justify-center gap-2">
            <KeyRound size={14} /> Keys are delivered instantly once payment clears
          </p>
        </div>
      </div>
    </div>
  );
}
