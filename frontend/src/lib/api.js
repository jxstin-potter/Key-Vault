import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

// Environment variable for API URL
const isDevelopment = import.meta.env.DEV;
const apiUrl = import.meta.env.VITE_API_URL || (isDevelopment ? 'http://localhost:5000/api' : 'https://your-backend-url.onrender.com/api');

// Create axios instance
export const api = axios.create({
  baseURL: apiUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const { response } = error;

    if (response?.status === 401) {
      const authStore = useAuthStore.getState();
      authStore.logout();
      
      // Don't show toast for logout (it's already handled in logout)
      if (response.config.url !== '/auth/logout') {
        toast.error('Session expired. Please login again.');
      }
    }

    // Handle server errors
    if (response?.status >= 500) {
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