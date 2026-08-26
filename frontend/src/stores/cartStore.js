import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createElement } from 'react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from './authStore';
import { navigateTo } from '../lib/navigation';

// Clicking the "added to cart" toast takes you to the cart
function showAddedToCartToast() {
  toast.success((t) =>
    createElement(
      'span',
      {
        onClick: () => {
          toast.dismiss(t.id);
          navigateTo('/cart');
        },
        style: { cursor: 'pointer' }
      },
      'Added to cart — view cart →'
    )
  );
}

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      // Load cart from server
      loadCart: async () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) return;

        set({ isLoading: true });
        try {
          const response = await api.get('/cart');
          set({ 
            items: response.data.items || [],
            isLoading: false 
          });
        } catch (error) {
          set({ isLoading: false });
        }
      },

      // Add item to cart
      addToCart: async (productId, quantity = 1) => {
        const { isAuthenticated } = useAuthStore.getState();
        
        if (!isAuthenticated) {
          toast.error('Please login to add items to cart');
          return { success: false, error: 'Please login to add items to cart' };
        }

        set({ isLoading: true });
        try {
          const response = await api.post('/cart/add', { productId: String(productId), quantity });
          
          await get().loadCart();
          showAddedToCartToast();
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Failed to add to cart';
          toast.error(message);
          return { success: false, error: message };
        }
      },

      // Update cart item quantity
      updateQuantity: async (itemId, quantity) => {
        set({ isLoading: true });
        try {
          await api.put(`/cart/update/${itemId}`, { quantity });
          await get().loadCart();
          toast.success('Cart updated!');
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Failed to update cart';
          toast.error(message);
          return { success: false, error: message };
        }
      },

      // Remove item from cart
      removeFromCart: async (itemId) => {
        set({ isLoading: true });
        try {
          await api.delete(`/cart/remove/${itemId}`);
          await get().loadCart();
          toast.success('Item removed from cart');
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Failed to remove item';
          toast.error(message);
          return { success: false, error: message };
        }
      },

      // Clear cart
      clearCart: async () => {
        set({ isLoading: true });
        try {
          await api.delete('/cart/clear');
          set({ items: [], isLoading: false });
          toast.success('Cart cleared');
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Failed to clear cart';
          toast.error(message);
          return { success: false, error: message };
        }
      },

      // Get cart total
      getTotal: () => {
        const { items } = get();
        return items.reduce((total, item) => {
          return total + (item.product.price * item.quantity);
        }, 0);
      },

      // Get cart item count
      getItemCount: () => {
        const { items } = get();
        return items.reduce((count, item) => count + item.quantity, 0);
      },

      // Check if product is in cart
      isInCart: (productId) => {
        const { items } = get();
        return items.some(item => item.product.id === productId);
      },

      // Get cart item by product ID
      getCartItem: (productId) => {
        const { items } = get();
        return items.find(item => item.product.id === productId);
      },

      // Sync cart with server (called on auth state change)
      syncCart: async () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (isAuthenticated) {
          await get().loadCart();
        } else {
          set({ items: [] });
        }
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
); 