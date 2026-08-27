import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, KeyRound, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import KeyReveal from '../components/KeyReveal';
import { useCartStore } from '../stores/cartStore';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30000;

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(Date.now());
  const { loadCart } = useCartStore();

  useEffect(() => {
    if (!sessionId) {
      setError('No checkout session was provided.');
      return;
    }

    let cancelled = false;
    let timer;

    // This page only reads. Fulfilment happens in the Stripe webhook, so
    // closing the tab does not cost the customer their keys - we are simply
    // waiting for that webhook to land.
    const poll = async () => {
      try {
        const { data } = await api.get(`/checkout/by-session/${sessionId}`);
        if (cancelled) return;

        setOrder(data.order);

        if (data.order.status === 'COMPLETED') {
          loadCart();
          return;
        }

        if (['FAILED', 'CANCELLED'].includes(data.order.status)) return;

        if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
          setTimedOut(true);
          return;
        }

        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setError('We could not find that order.');
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const keys = (order?.orderItems || []).flatMap((item) =>
    (item.gameKeys || []).map((k) => ({ ...k, product: item.product }))
  );

  const isComplete = order?.status === 'COMPLETED';
  const isFailed = ['FAILED', 'CANCELLED'].includes(order?.status);

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-xl shadow-soft p-8">
          {error ? (
            <div className="text-center">
              <AlertCircle size={48} className="mx-auto text-error-500 mb-4" />
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Something went wrong</h1>
              <p className="text-neutral-600 mb-6">{error}</p>
              <Link to="/orders" className="text-primary-600 hover:text-primary-700 font-medium">
                View your orders
              </Link>
            </div>
          ) : isFailed ? (
            <div className="text-center">
              <AlertCircle size={48} className="mx-auto text-error-500 mb-4" />
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Payment not completed</h1>
              <p className="text-neutral-600 mb-6">
                Your keys were released back to stock. Nothing has been charged.
              </p>
              <Link
                to="/cart"
                className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700"
              >
                Back to cart
              </Link>
            </div>
          ) : isComplete ? (
            <>
              <div className="text-center mb-8">
                <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
                <h1 className="text-2xl font-bold text-neutral-900 mb-2">Payment complete</h1>
                <p className="text-neutral-600">
                  {keys.length} {keys.length === 1 ? 'key is' : 'keys are'} yours. They are also
                  saved in <Link to="/keys" className="text-primary-600 hover:underline">My Keys</Link>.
                </p>
              </div>

              <div className="space-y-5">
                {keys.map((key) => (
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

              <div className="mt-8 pt-6 border-t border-neutral-100 flex gap-3 justify-center">
                <Link to="/keys" className="px-5 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700">
                  My Keys
                </Link>
                <Link to="/products" className="px-5 py-2.5 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50">
                  Keep shopping
                </Link>
              </div>
            </>
          ) : timedOut ? (
            <div className="text-center">
              <KeyRound size={48} className="mx-auto text-neutral-400 mb-4" />
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Still processing</h1>
              <p className="text-neutral-600 mb-6">
                Your payment went through and your keys are being released. This usually takes a
                few seconds - check My Keys shortly.
              </p>
              <Link
                to="/keys"
                className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700"
              >
                Go to My Keys
              </Link>
            </div>
          ) : (
            <div className="text-center py-8">
              <Loader2 size={48} className="mx-auto text-primary-600 animate-spin mb-4" />
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Confirming your payment…</h1>
              <p className="text-neutral-600">Hold on while we release your keys.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
