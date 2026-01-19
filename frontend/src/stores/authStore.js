import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      // Initialize auth from localStorage
      initializeAuth: () => {
        const { token } = get();
        if (token) {
          set({ isLoading: true });
          // Verify token is still valid
          api.get('/auth/me')
            .then(response => {
              set({ 
                user: response.data.user, 
                isAuthenticated: true,
                isLoading: false
              });
            })
            .catch(() => {
              // Token is invalid, clear auth
              get().logout();
            });
        } else {
          set({ isLoading: false });
        }
      },

      // Login
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, token } = response.data;
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false
          });

          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          toast.success('Welcome back!');
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Login failed';
          toast.error(message);
          return { success: false, error: message };
        }
      },

      // Register
      register: async (userData) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/register', userData);
          const { user, token } = response.data;
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false
          });

          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          toast.success('Account created successfully!');
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Registration failed';
          toast.error(message);
          return { success: false, error: message };
        }
      },

      // Logout
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false
        });
        
        // Remove auth header
        delete api.defaults.headers.common['Authorization'];
        
        toast.success('Logged out successfully');
      },

      // Update profile
      updateProfile: async (profileData) => {
        try {
          const response = await api.put('/auth/profile', profileData);
          const { user } = response.data;
          
          set({ user });
          toast.success('Profile updated successfully!');
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.message || 'Failed to update profile';
          toast.error(message);
          return { success: false, error: message };
        }
      },

      // Get current user
      getCurrentUser: async () => {
        try {
          const response = await api.get('/auth/me');
          const { user } = response.data;
          set({ user });
          return user;
        } catch (error) {
          return null;
        }
      },

      // Check if user is admin
      isAdmin: () => {
        const { user } = get();
        return user?.role === 'ADMIN';
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
); 