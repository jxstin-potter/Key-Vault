import { api } from './api';

// Product API service
export const productApi = {
  // Get all products with pagination
  getAllProducts: async (page = 1, limit = 10, filters = {}) => {
    try {
      console.log('🔍 Fetching products from:', api.defaults.baseURL);
      const response = await api.get('/products', {
        params: { page, limit, ...filters }
      });
      console.log('✅ Products response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch products:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        }
      });
      throw error;
    }
  },

  // Get products with pagination (for other pages)
  getProducts: async (params = {}) => {
    try {
      const response = await api.get('/products', { params });
      return Array.isArray(response.data) ? response.data : response.data.products || [];
    } catch (error) {
      console.error('Failed to fetch products:', error);
      throw error;
    }
  },

  // Get product by ID
  getProductById: async (id) => {
    try {
      const response = await api.get(`/products/${id}`);
      return response.data.product || response.data;
    } catch (error) {
      console.error('Failed to fetch product:', error);
      throw error;
    }
  },

  // Get products by category
  getProductsByCategory: async (category) => {
    try {
      const response = await api.get(`/products?category=${encodeURIComponent(category)}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch products by category:', error);
      throw error;
    }
  },

  // Search products
  searchProducts: async (searchTerm) => {
    try {
      const response = await api.get(`/products?search=${encodeURIComponent(searchTerm)}`);
      return response.data;
    } catch (error) {
      console.error('Failed to search products:', error);
      throw error;
    }
  },

  // Get categories
  getCategories: async () => {
    try {
      const response = await api.get('/categories');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw error;
    }
  },

  // Create product (admin only)
  createProduct: async (data) => {
    try {
      const response = await api.post('/products', data);
      return response.data;
    } catch (error) {
      console.error('Failed to create product:', error);
      throw error;
    }
  },

  // Update product (admin only)
  updateProduct: async (productId, data) => {
    try {
      const response = await api.put(`/products/${productId}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update product:', error);
      throw error;
    }
  },

  // Delete single product (admin only)
  deleteProduct: async (productId) => {
    try {
      const response = await api.delete(`/products/${productId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete product:', error);
      throw error;
    }
  },

  // Bulk delete products (admin only)
  bulkDeleteProducts: async (productIds) => {
    try {
      const response = await api.delete('/products/bulk', {
        data: { productIds }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk delete products:', error);
      throw error;
    }
  }
}; 