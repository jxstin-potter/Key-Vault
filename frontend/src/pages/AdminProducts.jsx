import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  KeyRound,
  Package,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { productApi } from '../lib/productApi';
import { keyApi } from '../lib/keyApi';
import ProductFormModal from '../components/admin/ProductFormModal';
import KeyUploadModal from '../components/admin/KeyUploadModal';
import toast from 'react-hot-toast';

// Convert API product data to admin format
const convertToAdminFormat = (products) => {
  return products.map(product => ({
    id: product.id,
    name: product.name,
    price: parseFloat(product.price),
    stock: product.stock,
    category: product.category?.name || 'Uncategorized',
    status: product.isActive ? "active" : "inactive",
    image: product.images[0] || '',
    description: product.description,
    createdAt: new Date(product.createdAt).toISOString().split('T')[0],
    averageRating: product.averageRating || 0,
    reviewCount: product.reviewCount || 0,
    raw: product
  }));
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [keyModalProduct, setKeyModalProduct] = useState(null);
  const [inventory, setInventory] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = () => setRefreshToken((n) => n + 1);

  // Fetch products and categories on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [productsData, categoriesData, inventoryData] = await Promise.all([
          productApi.getAllProducts(1, 200),
          productApi.getCategories(),
          keyApi.getInventory().catch(() => ({ inventory: {} }))
        ]);

        const adminProducts = convertToAdminFormat(Array.isArray(productsData) ? productsData : productsData.products || []);
        setProducts(adminProducts);
        const categoryArray = Array.isArray(categoriesData)
          ? categoriesData
          : categoriesData.categories;
        setCategories(categoryArray);
        setInventory(inventoryData.inventory || {});
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [refreshToken]);

  // Filter and sort products
  useEffect(() => {
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      const matchesStatus = selectedStatus === 'All' || product.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.price - b.price;
        case 'stock':
          return a.stock - b.stock;
        case 'createdAt':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'rating':
          return b.averageRating - a.averageRating;
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredProducts(filtered);
  }, [products, searchTerm, selectedCategory, selectedStatus, sortBy]);

  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product.raw);
    setIsFormOpen(true);
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await productApi.deleteProduct(productId);
        toast.success('Product deleted successfully');
        setProducts(prev => prev.filter(p => p.id !== productId));
      } catch (error) {
        console.error('Failed to delete product:', error);
        toast.error('Failed to delete product');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select products to delete');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedProducts.length} products?`)) {
      try {
        await productApi.bulkDeleteProducts(selectedProducts);
        toast.success(`${selectedProducts.length} products deleted successfully`);
        setProducts(prev => prev.filter(p => !selectedProducts.includes(p.id)));
        setSelectedProducts([]);
      } catch (error) {
        console.error('Failed to delete products:', error);
        toast.error('Failed to delete products');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} />
          <h2 className="text-xl font-semibold text-neutral-900">Loading products...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
        <div className="flex items-center justify-between">
          <div>
          <h1 className="text-2xl font-bold text-neutral-900">Products</h1>
          <p className="text-neutral-600">Manage your product catalog</p>
            </div>
            <button
              onClick={handleAddProduct}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} />
          Add Product
            </button>
        </div>

        {/* Filters and Search */}
      <div className="bg-neutral-100 rounded-xl shadow-soft p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Filter */}
          <div className="lg:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
              <option value="All">All Categories</option>
                {categories.map(category => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
          <div className="lg:w-48">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
              <option value="All">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Sort */}
          <div className="lg:w-48">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
              <option value="name">Sort by Name</option>
              <option value="price">Sort by Price</option>
              <option value="stock">Sort by Stock</option>
              <option value="createdAt">Sort by Date</option>
              <option value="rating">Sort by Rating</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedProducts.length > 0 && (
        <div className="bg-neutral-100 rounded-xl shadow-soft p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">
                {selectedProducts.length} product(s) selected
              </span>
                <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-3 py-1 bg-error-500 text-white rounded-lg hover:bg-error-600 transition-colors text-sm"
                >
                  <Trash2 size={16} />
                Delete Selected
                </button>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-neutral-100 rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-neutral-50">
                <tr>
                <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={handleSelectAll}
                    className="rounded border-neutral-300"
                    />
                  </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                      className="rounded border-neutral-300"
                      />
                    </td>
                    <td className="px-6 py-4">
                    <div className="flex items-center">
                        <img
                          src={product.image}
                          alt={product.name}
                        className="w-10 h-10 rounded-lg object-cover mr-3"
                        />
                        <div>
                        <div className="text-sm font-medium text-neutral-900">{product.name}</div>
                        <div className="text-sm text-neutral-500">ID: {product.id.slice(0, 8)}...</div>
                      </div>
                      </div>
                    </td>
                  <td className="px-6 py-4 text-sm text-neutral-900">{product.category}</td>
                  <td className="px-6 py-4 text-sm text-neutral-900">${product.price}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={cn(
                      "font-medium",
                      product.stock === 0 ? "text-error-600" : "text-neutral-900"
                    )}>
                      {product.stock === 0 ? "Out of stock" : product.stock + " keys"}
                    </span>
                    {inventory[product.id]?.sold > 0 && (
                      <span className="block text-xs text-neutral-500">
                        {inventory[product.id].sold} sold
                      </span>
                    )}
                  </td>
                    <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      product.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    )}>
                      {product.status === "active" ? (
                        <>
                          <CheckCircle size={12} className="mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle size={12} className="mr-1" />
                          Inactive
                        </>
                      )}
                      </span>
                    </td>
                  <td className="px-6 py-4 text-sm text-neutral-900">
                    {product.averageRating > 0 ? (
                      <div className="flex items-center">
                        <span className="text-yellow-500">★</span>
                        <span className="ml-1">{product.averageRating}</span>
                        <span className="text-neutral-500 ml-1">({product.reviewCount})</span>
                      </div>
                    ) : (
                      <span className="text-neutral-400">No reviews</span>
                    )}
                    </td>
                    <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        <button
                          onClick={() => setKeyModalProduct(product)}
                        className="p-1 text-neutral-400 hover:text-primary-600 transition-colors"
                        title="Manage keys"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          onClick={() => handleEditProduct(product)}
                        className="p-1 text-neutral-400 hover:text-primary-600 transition-colors"
                        title="Edit game"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                        className="p-1 text-neutral-400 hover:text-error-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        {/* Empty state */}
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
            <Package size={48} className="mx-auto text-neutral-400 mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No products found</h3>
            <p className="text-neutral-600">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>

      {/* Results count */}
      <div className="text-sm text-neutral-600">
        Showing {filteredProducts.length} of {products.length} games
      </div>

      <ProductFormModal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={refresh}
        product={editingProduct}
        categories={categories}
      />

      <KeyUploadModal
        open={Boolean(keyModalProduct)}
        onClose={() => setKeyModalProduct(null)}
        onChanged={refresh}
        product={keyModalProduct}
      />
    </div>
  );
} 