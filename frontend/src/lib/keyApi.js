import { api } from './api';

// Game key API service
export const keyApi = {
  // The signed-in user's purchased keys, grouped by order
  getMyKeys: async () => {
    try {
      const response = await api.get('/keys/mine');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch your keys:', error);
      throw error;
    }
  },

  // Per-product key counts by status (admin only)
  getInventory: async () => {
    try {
      const response = await api.get('/keys/inventory');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch key inventory:', error);
      throw error;
    }
  },

  // Every key belonging to one product (admin only)
  getKeysForProduct: async (productId) => {
    try {
      const response = await api.get(`/keys/product/${productId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch keys for product:', error);
      throw error;
    }
  },

  // Add a batch of codes to a product (admin only)
  bulkUploadKeys: async (productId, codes) => {
    try {
      const response = await api.post('/keys/bulk', { productId, codes });
      return response.data;
    } catch (error) {
      console.error('Failed to upload keys:', error);
      throw error;
    }
  },

  // Remove a single unsold key (admin only)
  deleteKey: async (keyId) => {
    try {
      const response = await api.delete(`/keys/${keyId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete key:', error);
      throw error;
    }
  }
};

// Split a pasted blob into candidate key codes. Accepts one code per line or
// CSV, in which case the first column is taken as the code.
export function parseKeyCodes(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.split(',')[0].trim())
    .filter(Boolean);
}
