import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, 
  Package, 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  DollarSign,
  Plus,
  Settings,
  LogOut,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const [analyticsRes, ordersRes, productsRes] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/orders?limit=5'),
          api.get('/analytics/products')
        ]);
        
        setAnalytics(analyticsRes.data.overview);
        setRecentOrders(ordersRes.data.orders || []);
        setTopProducts(productsRes.data.products?.productPerformance?.slice(0, 4) || []);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-success-100 text-success-800';
      case 'processing': return 'bg-warning-100 text-warning-800';
      case 'shipped': return 'bg-primary-100 text-primary-800';
      case 'pending': return 'bg-neutral-100 text-neutral-800';
      default: return 'bg-neutral-100 text-neutral-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-neutral-600 mt-2">Welcome back, {user?.firstName || 'Admin'}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 w-full">
        <div className="bg-neutral-100 rounded-xl p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total Revenue</p>
              <p className="text-2xl font-bold text-neutral-900">${analytics?.totalRevenue?.toLocaleString() || '0'}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-primary-600" size={24} />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <ArrowUpRight className={cn("w-4 h-4", analytics?.revenueGrowth > 0 ? "text-success-500" : "text-error-500")} />
            <span className={cn("text-sm font-medium ml-1", analytics?.revenueGrowth > 0 ? "text-success-600" : "text-error-600")}>
              {Math.abs(analytics?.revenueGrowth || 0)}%
            </span>
            <span className="text-sm text-neutral-500 ml-1">vs last month</span>
          </div>
        </div>

        <div className="bg-neutral-100 rounded-xl p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total Orders</p>
              <p className="text-2xl font-bold text-neutral-900">{analytics?.totalOrders || '0'}</p>
            </div>
            <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="text-secondary-600" size={24} />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <ArrowDownRight className={cn("w-4 h-4", analytics?.orderGrowth > 0 ? "text-success-500" : "text-error-500")} />
            <span className={cn("text-sm font-medium ml-1", analytics?.orderGrowth > 0 ? "text-success-600" : "text-error-600")}>
              {Math.abs(analytics?.orderGrowth || 0)}%
            </span>
            <span className="text-sm text-neutral-500 ml-1">vs last month</span>
          </div>
        </div>

        <div className="bg-neutral-100 rounded-xl p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total Products</p>
              <p className="text-2xl font-bold text-neutral-900">{analytics?.totalProducts || '0'}</p>
            </div>
            <div className="w-12 h-12 bg-accent-100 rounded-lg flex items-center justify-center">
              <Package className="text-accent-600" size={24} />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <ArrowUpRight className={cn("w-4 h-4", analytics?.productsChange > 0 ? "text-success-500" : "text-error-500")} />
            <span className={cn("text-sm font-medium ml-1", analytics?.productsChange > 0 ? "text-success-600" : "text-error-600")}>
              {Math.abs(analytics?.productsChange || 0)}%
            </span>
            <span className="text-sm text-neutral-500 ml-1">vs last month</span>
          </div>
        </div>

        <div className="bg-neutral-100 rounded-xl p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total Customers</p>
              <p className="text-2xl font-bold text-neutral-900">{analytics?.totalUsers || '0'}</p>
            </div>
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
              <Users className="text-success-600" size={24} />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <ArrowUpRight className={cn("w-4 h-4", analytics?.customersChange > 0 ? "text-success-500" : "text-error-500")} />
            <span className={cn("text-sm font-medium ml-1", analytics?.customersChange > 0 ? "text-success-600" : "text-error-600")}>
              {Math.abs(analytics?.customersChange || 0)}%
            </span>
            <span className="text-sm text-neutral-500 ml-1">vs last month</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 w-full">
        <Link
          to="/admin/products"
          className="bg-neutral-100 rounded-xl p-6 shadow-soft hover:shadow-medium transition-all duration-200 group"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
              <Package className="text-primary-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Manage Products</h3>
              <p className="text-sm text-neutral-600">Add, edit, or remove products</p>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/orders"
          className="bg-neutral-100 rounded-xl p-6 shadow-soft hover:shadow-medium transition-all duration-200 group"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center group-hover:bg-secondary-200 transition-colors">
              <ShoppingCart className="text-secondary-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Manage Orders</h3>
              <p className="text-sm text-neutral-600">View and update order status</p>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/customers"
          className="bg-neutral-100 rounded-xl p-6 shadow-soft hover:shadow-medium transition-all duration-200 group"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center group-hover:bg-success-200 transition-colors">
              <Users className="text-success-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Manage Customers</h3>
              <p className="text-sm text-neutral-600">View customer information</p>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/settings"
          className="bg-neutral-100 rounded-xl p-6 shadow-soft hover:shadow-medium transition-all duration-200 group"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-accent-100 rounded-lg flex items-center justify-center group-hover:bg-accent-200 transition-colors">
              <Settings className="text-accent-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Settings</h3>
              <p className="text-sm text-neutral-600">Configure store settings</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
        {/* Recent Orders */}
        <div className="bg-neutral-100 rounded-xl shadow-soft p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-neutral-900">Recent Orders</h2>
            <Link
              to="/admin/orders"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                <div>
                  <p className="font-medium text-neutral-900">
                    {order.user?.firstName} {order.user?.lastName}
                  </p>
                  <p className="text-sm text-neutral-600">${order.total}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={cn("px-2 py-1 rounded-full text-xs font-medium", getStatusColor(order.status))}>
                    {order.status}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-neutral-100 rounded-xl shadow-soft p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-neutral-900">Top Products</h2>
            <Link
              to="/admin/products"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div key={product.id || index} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                <div>
                  <p className="font-medium text-neutral-900">{product.name}</p>
                  <p className="text-sm text-neutral-600">{product.totalSold || 0} sales</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-neutral-900">${(product.totalRevenue || 0).toLocaleString()}</p>
                  <p className="text-sm text-neutral-600">Revenue</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 