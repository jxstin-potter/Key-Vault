import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  RefreshCw,
} from "lucide-react";
import { api } from "../lib/api";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

const StatCard = ({ title, value, icon, change, color = "blue" }) => {
  const IconComponent = icon;
  return (
    <div className="bg-neutral-100 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-600">{title}</p>
          <p className="text-2xl font-bold text-neutral-900">{value}</p>
          {change !== undefined && (
            <p
              className={`text-sm ${change >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {change >= 0 ? "+" : ""}
              {change}% from last month
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full bg-${color}-100`}>
          {IconComponent && (
            <IconComponent className={`w-6 h-6 text-${color}-600`} />
          )}
        </div>
      </div>
    </div>
  );
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales Analytics" },
  { key: "users", label: "User Analytics" },
  { key: "products", label: "Product Analytics" },
];

const AdminAnalytics = () => {
  const [activeTab, setActiveTab] = useState("overview");
  // Overview analytics state
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  // Sales analytics state
  const [sales, setSales] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState(null);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [category, setCategory] = useState("");
  const [productId, setProductId] = useState("");
  const [categories, setCategories] = useState([]);
  const [productsList, setProductsList] = useState([]);

  // Users analytics state
  const [users, setUsers] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);

  // Products analytics state
  const [products, setProducts] = useState(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);

  // Fetch categories and products for filters
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          api.get("/categories"),
          api.get("/products"),
        ]);
        setCategories(catRes.data.categories || catRes.data || []);
        setProductsList(prodRes.data.products || prodRes.data || []);
      } catch {
        // ignore
      }
    };
    fetchMeta();
  }, []);

  // Fetch sales analytics
  const fetchSales = async (params = {}) => {
    try {
      setSalesLoading(true);
      const res = await api.get("/analytics/sales", { params });
      setSales(res.data.sales);
      setSalesError(null);
    } catch {
      setSalesError("Failed to fetch sales analytics");
    } finally {
      setSalesLoading(false);
    }
  };

  // Fetch users analytics
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await api.get("/analytics/users");
      setUsers(res.data.users);
      setUsersError(null);
    } catch {
      setUsersError("Failed to fetch user analytics");
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch overview analytics
  const fetchOverview = async () => {
    try {
      setOverviewLoading(true);
      const res = await api.get("/analytics/overview");
      setOverview(res.data.overview);
      setOverviewError(null);
    } catch {
      setOverviewError("Failed to fetch overview analytics");
    } finally {
      setOverviewLoading(false);
    }
  };

  // Fetch products analytics
  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      const res = await api.get("/analytics/products");
      setProducts(res.data.products);
      setProductsError(null);
    } catch {
      setProductsError("Failed to fetch product analytics");
    } finally {
      setProductsLoading(false);
    }
  };

  // Initial and filter-triggered fetch
  useEffect(() => {
    const params = {};
    if (dateRange.start) params.start = dateRange.start;
    if (dateRange.end) params.end = dateRange.end;
    if (category) params.category = category;
    if (productId) params.productId = productId;
    fetchSales(params);
  }, [dateRange, category, productId]);

  // Initial fetch for overview
  useEffect(() => {
    fetchOverview();
  }, []);

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === "users" && !users) {
      fetchUsers();
    } else if (activeTab === "products" && !products) {
      fetchProducts();
    }
  }, [activeTab, users, products]);

  // Export CSV
  const handleExportCSV = async () => {
    const params = {};
    if (dateRange.start) params.start = dateRange.start;
    if (dateRange.end) params.end = dateRange.end;
    if (category) params.category = category;
    if (productId) params.productId = productId;
    params.exportCsv = 1;
    const query = new URLSearchParams(params).toString();
    window.open(`/api/analytics/sales?${query}`, "_blank");
  };

  // Format helpers
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };
  const formatNumber = (num) => new Intl.NumberFormat("en-US").format(num);

  // UI for filters
  const Filters = (
    <div className="flex flex-wrap gap-4 items-end mb-4">
      <div>
        <label htmlFor="start-date" className="block text-xs font-medium text-neutral-600 mb-1">Start Date</label>
        <input id="start-date"
          type="date"
          className="border rounded px-2 py-1"
          value={dateRange.start}
          onChange={(e) =>
            setDateRange((r) => ({ ...r, start: e.target.value }))
          }
        />
      </div>
      <div>
        <label htmlFor="end-date" className="block text-xs font-medium text-neutral-600 mb-1">End Date</label>
        <input id="end-date"
          type="date"
          className="border rounded px-2 py-1"
          value={dateRange.end}
          onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
        />
      </div>
      <div>
        <label htmlFor="category" className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
        <select id="category"
          className="border rounded px-2 py-1"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="product" className="block text-xs font-medium text-neutral-600 mb-1">Product</label>
        <select id="product"
          className="border rounded px-2 py-1"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">All</option>
          {productsList.map((prod) => (
            <option key={prod.id} value={prod.id}>
              {prod.name}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleExportCSV}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        Export CSV
      </button>
    </div>
  );

  // Tab content
  let tabContent = null;
  if (activeTab === "overview") {
    tabContent = (
      <div>
        {overviewLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : overviewError ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{overviewError}</p>
            <button
              onClick={fetchOverview}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : overview ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <StatCard
                title="Total Orders"
                value={formatNumber(overview.totalOrders)}
                icon={ShoppingCart}
                change={overview.orderGrowth}
                color="blue"
              />
              <StatCard
                title="Total Revenue"
                value={formatCurrency(overview.totalRevenue)}
                icon={DollarSign}
                change={overview.revenueGrowth}
                color="green"
              />
              <StatCard
                title="Total Users"
                value={formatNumber(overview.totalUsers)}
                icon={Users}
                color="purple"
              />
              <StatCard
                title="Active Products"
                value={formatNumber(overview.totalProducts)}
                icon={Package}
                color="orange"
              />
            </div>

            {/* Top Products */}
            <div className="bg-neutral-100 rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Top Selling Products
              </h3>
              <div className="space-y-3">
                {overview.topProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-neutral-100 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">
                          {product.name}
                        </p>
                        <p className="text-sm text-neutral-600">
                          {product.category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-neutral-900">
                        {formatNumber(product.totalSold)} sold
                      </p>
                      <p className="text-sm text-neutral-600">
                        {formatCurrency(product.price)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-neutral-100 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Recent Orders
              </h3>
              <div className="space-y-3">
                {overview.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-neutral-100 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-neutral-900">
                        {order.user.firstName} {order.user.lastName}
                      </p>
                      <p className="text-sm text-neutral-600">
                        {order.user.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-neutral-900">
                        {formatCurrency(order.total)}
                      </p>
                      <p className="text-sm text-neutral-600">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div>No overview data available</div>
        )}
      </div>
    );
  } else if (activeTab === "sales") {
    tabContent = (
      <div>
        {Filters}
        {salesLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : salesError ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{salesError}</p>
            <button
              onClick={() => fetchSales()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : sales ? (
          <>
            {/* Daily Sales Chart */}
            <div className="bg-neutral-100 rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Daily Sales
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sales.dailySales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={formatCurrency} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3B82F6"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#10B981"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Product Sales Chart */}
            <div className="bg-neutral-100 rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Product Sales
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sales.productSales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="productName" />
                  <YAxis />
                  <Tooltip formatter={formatNumber} />
                  <Legend />
                  <Bar dataKey="quantity" fill="#3B82F6" name="Units Sold" />
                  <Bar dataKey="revenue" fill="#10B981" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div>No sales data available</div>
        )}
      </div>
    );
  } else if (activeTab === "users") {
    tabContent = (
      <div>
        {usersLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : usersError ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{usersError}</p>
            <button
              onClick={fetchUsers}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : users ? (
          <>
            {/* User Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <StatCard
                title="Total Users"
                value={formatNumber(users.totalUsers)}
                icon={Users}
                color="blue"
              />
              <StatCard
                title="Active Users"
                value={formatNumber(users.activeUsers)}
                icon={Users}
                color="green"
              />
              <StatCard
                title="User Growth"
                value={`${users.userGrowth.length} days`}
                icon={Users}
                color="purple"
              />
            </div>

            {/* User Growth Chart */}
            <div className="bg-neutral-100 rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                User Growth Over Time
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={users.userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={formatNumber} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="newUsers"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: "#3B82F6", strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top Customers */}
            <div className="bg-neutral-100 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Top Customers
              </h3>
              <div className="space-y-3">
                {users.topCustomers.map((customer, index) => (
                  <div
                    key={customer.id || index}
                    className="flex items-center justify-between p-3 bg-neutral-100 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {customer.firstName?.charAt(0) ||
                            customer.email?.charAt(0) ||
                            "U"}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <p className="text-sm text-neutral-600">
                          {customer.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-neutral-900">
                        {formatCurrency(customer.totalSpent)}
                      </p>
                      <p className="text-sm text-neutral-600">
                        {customer.orderCount} orders
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div>No user data available</div>
        )}
      </div>
    );
  } else if (activeTab === "products") {
    tabContent = (
      <div>
        {productsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : productsError ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{productsError}</p>
            <button
              onClick={fetchProducts}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : products ? (
          <>
            {/* Product Performance Chart */}
            <div className="bg-neutral-100 rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Top Selling Products
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={products.productPerformance.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={formatNumber} />
                  <Legend />
                  <Bar dataKey="totalSold" fill="#3B82F6" name="Units Sold" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Performance */}
            <div className="bg-neutral-100 rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Category Performance
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={products.categoryPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip formatter={formatCurrency} />
                  <Legend />
                  <Bar dataKey="totalRevenue" fill="#10B981" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Low Stock Alert */}
            <div className="bg-neutral-100 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Low Stock Alert
              </h3>
              <div className="space-y-3">
                {products.lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
                  >
                    <div>
                      <p className="font-medium text-neutral-900">
                        {product.name}
                      </p>
                      <p className="text-sm text-neutral-600">
                        {product.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-red-600">
                        {product.stock} in stock
                      </p>
                      <p className="text-sm text-neutral-600">
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                  </div>
                ))}
                {products.lowStockProducts.length === 0 && (
                  <p className="text-neutral-500 text-center py-4">
                    No low stock products
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div>No product data available</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Analytics Dashboard
          </h1>
          <p className="text-neutral-600">
            Monitor your store's performance and insights
          </p>
        </div>
        <button
          onClick={() => fetchSales()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      {/* Tabs */}
      <div className="flex gap-2 border-b mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-600 text-blue-700" : "border-transparent text-neutral-600 hover:text-blue-700"}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Tab Content */}
      {tabContent}
    </div>
  );
};

export default AdminAnalytics;
