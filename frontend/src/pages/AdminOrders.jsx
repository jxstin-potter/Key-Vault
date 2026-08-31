import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  XCircle,
  ArrowUpDown,
  Download
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

const orderStatusConfig = {
  PENDING: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock
  },
  PROCESSING: {
    label: 'Processing',
    color: 'bg-blue-100 text-blue-800',
    icon: Package
  },
  SHIPPED: {
    label: 'Shipped',
    color: 'bg-purple-100 text-purple-800',
    icon: Truck
  },
  DELIVERED: {
    label: 'Delivered',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800',
    icon: XCircle
  }
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('createdAt');
  const [selectedOrders, setSelectedOrders] = useState([]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/orders');
      setOrders(response.data.orders || []);
      setFilteredOrders(response.data.orders || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort orders
  useEffect(() => {
    let filtered = orders.filter(order => {
      const matchesSearch = 
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${order.user.firstName} ${order.user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || order.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });

    // Sort orders
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'total':
          return b.total - a.total;
        case 'customer':
          return `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`);
        case 'createdAt':
          return new Date(b.createdAt) - new Date(a.createdAt);
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    setFilteredOrders(filtered);
  }, [orders, searchTerm, selectedStatus, sortBy]);

  const handleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus });
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      toast.success('Order status updated successfully');
    } catch (error) {
      console.error('Failed to update order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    const config = orderStatusConfig[status];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon size={16} />;
  };

  const getStatusColor = (status) => {
    return orderStatusConfig[status]?.color || 'bg-neutral-100 text-neutral-800';
  };

  const getStatusLabel = (status) => {
    return orderStatusConfig[status]?.label || status;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Order Management</h1>
        <p className="text-neutral-600 mt-2">Manage and track all customer orders</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-neutral-100 rounded-xl shadow-soft p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
              <input
                type="text"
                placeholder="Search orders by ID, customer name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="text-neutral-400" size={20} />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="All">All Status</option>
              {Object.keys(orderStatusConfig).map(status => (
                <option key={status} value={status}>{getStatusLabel(status)}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="text-neutral-400" size={20} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="createdAt">Date</option>
              <option value="total">Total</option>
              <option value="customer">Customer</option>
            </select>
          </div>

          {/* Export */}
          <button className="flex items-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <div className="bg-neutral-100 rounded-xl shadow-soft p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600">
              {selectedOrders.length} order(s) selected
            </span>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  selectedOrders.forEach(orderId => {
                    handleUpdateStatus(orderId, e.target.value);
                  });
                  setSelectedOrders([]);
                }}
                className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
              >
                <option value="">Update Status</option>
                {Object.keys(orderStatusConfig).map(status => (
                  <option key={status} value={status}>{getStatusLabel(status)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-neutral-100 rounded-xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-neutral-900">Order ID</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-neutral-900">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-neutral-900">Items</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-neutral-900">Total</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-neutral-900">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-neutral-900">Date</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-neutral-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => handleSelectOrder(order.id)}
                      className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-neutral-900">#{order.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-neutral-900">
                        {order.user.firstName} {order.user.lastName}
                      </div>
                      <div className="text-sm text-neutral-600">{order.user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-neutral-600">
                      {order.orderItems.length} {order.orderItems.length === 1 ? 'item' : 'items'}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {order.orderItems.map(item => item.product.name).join(', ')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-neutral-900">${order.total}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                      getStatusColor(order.status)
                    )}>
                      {getStatusIcon(order.status)}
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-neutral-600">{formatDate(order.createdAt)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {/* View order details */}}
                        className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                        className="text-xs border border-neutral-300 rounded px-2 py-1"
                      >
                        {Object.keys(orderStatusConfig).map(status => (
                          <option key={status} value={status}>{getStatusLabel(status)}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-neutral-400" />
            <h3 className="mt-2 text-sm font-medium text-neutral-900">No orders found</h3>
            <p className="mt-1 text-sm text-neutral-500">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
} 