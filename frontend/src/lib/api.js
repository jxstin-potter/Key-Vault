import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

// Environment variable for API URL.
//
// Vite inlines this at build time, so a production bundle built without
// VITE_API_URL set can never recover at runtime. The previous fallback was a
// literal placeholder host (your-backend-url.onrender.com) - the store came up
// looking fine and then failed every request with an opaque network error,
// giving no hint that the build was simply misconfigured. Failing loudly here
// costs one obvious console error instead of an afternoon of debugging.
const isDevelopment = import.meta.env.DEV;
const apiUrl =
  import.meta.env.VITE_API_URL || (isDevelopment ? 'http://localhost:5000/api' : null);

if (!apiUrl) {
  throw new Error(
    'VITE_API_URL is not set. A production build needs it to reach the API - ' +
      'set it in the Vercel project settings and redeploy.'
  );
}

// The API is hosted on Render's free tier, which spins the instance down
// after inactivity. A cold start regularly takes 30-60s, so a short timeout
// makes the first visit after an idle period look like an empty store.
const REQUEST_TIMEOUT_MS = 45000;

// Create axios instance
export const api = axios.create({
  baseURL: apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Cold-start signalling
//
// The API sleeps on Render's free tier and takes 30-60s to wake. During that
// window every request simply hangs, and a first-time visitor sees an empty
// store with a spinner and concludes the site is broken - which is a terrible
// first impression for something whose whole point is that it works.
//
// Rather than guess up front, this watches actual request latency: if anything
// is still in flight after a few seconds, subscribers are told the backend is
// probably waking, and told again when it lands. A warm server never crosses
// the threshold, so the message only appears when it is true.
// ---------------------------------------------------------------------------
const COLD_START_HINT_MS = 3500;

let inFlight = 0;
let hintTimer = null;
const wakingListeners = new Set();

const emitWaking = (isWaking) => {
  for (const listener of wakingListeners) listener(isWaking);
};

/** Subscribe to cold-start state. Returns an unsubscribe function. */
export function onBackendWaking(listener) {
  wakingListeners.add(listener);
  return () => wakingListeners.delete(listener);
}

function requestStarted() {
  inFlight += 1;
  if (inFlight === 1 && !hintTimer) {
    hintTimer = setTimeout(() => emitWaking(true), COLD_START_HINT_MS);
  }
}

function requestSettled() {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight === 0) {
    clearTimeout(hintTimer);
    hintTimer = null;
    emitWaking(false);
  }
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    requestStarted();
    // Add auth token if available
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    requestSettled();
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    requestSettled();
    return response;
  },
  (error) => {
    requestSettled();
    const { response } = error;

    if (response?.status === 401) {
      const authStore = useAuthStore.getState();
      authStore.logout();
      
      // Don't show toast for logout (it's already handled in logout)
      if (response.config.url !== '/auth/logout') {
        toast.error('Session expired. Please login again.');
      }
    }

    // Handle server errors.
    //
    // 503 is excluded on purpose. It is the one 5xx the API returns
    // deliberately - "this feature is not configured" - and callers that can
    // hit it give a far more useful message than a generic one. Toasting here
    // as well stacked two errors on screen, with the vaguer one covering the
    // specific one (checkout showed "Payments are not configured yet" behind
    // "Server error. Please try again later.").
    if (response?.status >= 500 && response.status !== 503) {
      toast.error('Server error. Please try again later.');
    }

    // Handle validation errors
    if (response?.status === 422) {
      const errors = response.data.errors;
      if (errors && Array.isArray(errors)) {
        errors.forEach(error => {
          toast.error(error.msg || 'Validation error');
        });
      }
    }

    return Promise.reject(error);
  }
);

// API helper functions
export const apiHelpers = {
  // Handle API errors
  handleError: (error) => {
    const message = error.response?.data?.message || 'Something went wrong';
    toast.error(message);
    return { success: false, error: message };
  },

  // Handle API success
  handleSuccess: (data, message = 'Success') => {
    toast.success(message);
    return { success: true, data };
  },
};

// Export default api instance
export default api; 