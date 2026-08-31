import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, ArrowLeft, Loader2, ShoppingBag } from 'lucide-react';
import { keyApi } from '../lib/keyApi';
import { useAuthStore } from '../stores/authStore';
import KeyReveal from '../components/KeyReveal';
import LoginPrompt from '../components/LoginPrompt';
import toast from 'react-hot-toast';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

export default function MyKeys() {
  const { isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [keyCount, setKeyCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        const data = await keyApi.getMyKeys();
        setOrders(data.orders || []);
        setKeyCount(data.keyCount || 0);
      } catch {
        toast.error('Failed to load your keys');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <LoginPrompt
        title="Login to View Your Keys"
        message="Please login to see the game keys you have purchased."
        showCartIcon={false}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            Continue Shopping
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900">My Keys</h1>
          <p className="text-neutral-600 mt-2">
            {keyCount} {keyCount === 1 ? 'key' : 'keys'} across {orders.length}{' '}
            {orders.length === 1 ? 'order' : 'orders'}
          </p>
        </div>

        {isLoading ? (
          <div className="bg-neutral-100 rounded-xl shadow-soft p-12 text-center">
            <Loader2 size={32} className="animate-spin mx-auto text-neutral-400 mb-4" />
            <p className="text-neutral-600">Loading your keys…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-neutral-100 rounded-xl shadow-soft p-12 text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound size={32} className="text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">No keys yet</h2>
            <p className="text-neutral-600 mb-6">
              Keys appear here the moment a purchase completes.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              <ShoppingBag size={20} />
              Browse games
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.orderId} className="bg-neutral-100 rounded-xl shadow-soft p-6">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-100">
                  <div>
                    <p className="text-sm text-neutral-600">Order</p>
                    <p className="font-mono text-sm text-neutral-900">#{order.orderId.slice(-8)}</p>
                  </div>
                  <p className="text-sm text-neutral-600">{formatDate(order.orderedAt)}</p>
                </div>

                <div className="space-y-5">
                  {order.keys.map((key) => (
                    <div key={key.id}>
                      <div className="flex items-center gap-3 mb-2">
                        {key.product.images?.[0] && (
                          <img
                            src={key.product.images[0]}
                            alt={key.product.name}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-900 truncate">{key.product.name}</p>
                          <p className="text-xs text-neutral-500">
                            {key.product.platform} · {key.product.region}
                          </p>
                        </div>
                      </div>
                      <KeyReveal code={key.code} platform={key.product.platform} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
