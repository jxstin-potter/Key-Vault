import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  XCircle, 
  MapPin, 
  Calendar,
  DollarSign,
  RefreshCw,
  Eye
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

// Linear fulfilment progression. CANCELLED is terminal and sits outside it.
const STATUS_PROGRESSION = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      const response = await api.get('/orders');
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadOrders(false);
    toast.success('Orders refreshed');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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
      <div className="min-h-screen bg-neutral-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-soft p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-neutral-200 rounded mb-4"></div>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-neutral-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                to="/products" 
                className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors mb-4"
              >
                <ArrowLeft size={20} />
                Back to Shopping
              </Link>
              <h1 className="text-3xl font-bold text-neutral-900">My Orders</h1>
              <p className="text-neutral-600 mt-2">
                Track your orders and view order history
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(isRefreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-soft p-12 text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package size={32} className="text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">No orders yet</h2>
            <p className="text-neutral-600 mb-6">You haven't placed any orders yet. Start shopping to see your orders here.</p>
            <Link 
              to="/products" 
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              <Package size={20} />
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Orders List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-soft p-6">
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">Order History</h2>
                <div className="space-y-4">
                  {orders.map(order => (
                    <div 
                      key={order.id} 
                      className={cn(
                        "border border-neutral-200 rounded-lg p-4 cursor-pointer transition-colors",
                        selectedOrder?.id === order.id 
                          ? "border-primary-300 bg-primary-50" 
                          : "hover:bg-neutral-50"
                      )}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-neutral-600">#{order.id.slice(-8)}</span>
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1",
                            getStatusColor(order.status)
                          )}>
                            {getStatusIcon(order.status)}
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <span className="text-sm text-neutral-600">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-neutral-900">
                            {order.orderItems.length} {order.orderItems.length === 1 ? 'item' : 'items'}
                          </p>
                          <p className="text-sm text-neutral-600">
                            {order.shippingAddress.city}, {order.shippingAddress.state}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-neutral-900">
                            ${parseFloat(order.total).toFixed(2)}
                          </p>
                          <p className="text-sm text-neutral-600">
                            {order.orderItems.length} {order.orderItems.length === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Details */}
            <div className="lg:col-span-1">
              {selectedOrder ? (
                <div className="bg-white rounded-xl shadow-soft p-6 sticky top-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-neutral-900">Order Details</h3>
                    <span className="font-mono text-sm text-neutral-600">#{selectedOrder.id.slice(-8)}</span>
                  </div>
                  
                  {/* Order Status Timeline */}
                  <div className="mb-6">
                    <h4 className="font-medium text-neutral-900 mb-4">Order Status</h4>
                    <div className="space-y-3">
                      {Object.entries(orderStatusConfig).map(([status, config]) => {
                        const Icon = config.icon;
                        const isActive = selectedOrder.status === status;
                        const orderIdx = STATUS_PROGRESSION.indexOf(selectedOrder.status);
                        const rowIdx = STATUS_PROGRESSION.indexOf(status);
                        const isCompleted = selectedOrder.status === 'CANCELLED'
                          ? status === 'CANCELLED'
                          : rowIdx !== -1 && orderIdx !== -1 && rowIdx <= orderIdx;
                        
                        return (
                          <div key={status} className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center",
                              isCompleted ? config.color : "bg-neutral-200"
                            )}>
                              <Icon size={16} className={isCompleted ? "text-white" : "text-neutral-400"} />
                            </div>
                            <div className="flex-1">
                              <p className={cn(
                                "text-sm font-medium",
                                isActive ? "text-neutral-900" : "text-neutral-600"
                              )}>
                                {config.label}
                              </p>
                              {isActive && (
                                <p className="text-xs text-neutral-500">Current status</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Order Info */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <p className="text-sm text-neutral-600">Order ID</p>
                      <p className="font-mono text-sm font-medium text-neutral-900">#{selectedOrder.id.slice(-8)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-600">Order Date</p>
                      <p className="font-medium text-neutral-900">{formatDate(selectedOrder.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-600">Status</p>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-1",
                        getStatusColor(selectedOrder.status)
                      )}>
                        {getStatusIcon(selectedOrder.status)}
                        {getStatusLabel(selectedOrder.status)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-600">Total</p>
                      <p className="text-xl font-bold text-neutral-900">${parseFloat(selectedOrder.total).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="mb-6">
                    <h4 className="font-medium text-neutral-900 mb-3">Shipping Address</h4>
                    <div className="text-sm text-neutral-600 space-y-1">
                      <p>{selectedOrder.shippingAddress.street}</p>
                      <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.zipCode}</p>
                      <p>{selectedOrder.shippingAddress.country}</p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <h4 className="font-medium text-neutral-900 mb-3">Items</h4>
                    <div className="space-y-3">
                      {selectedOrder.orderItems.map(item => (
                        <div key={item.id} className="flex items-center gap-3">
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-12 h-12 object-cover rounded-lg border border-neutral-200"
                          />
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-neutral-900 truncate">{item.product.name}</h5>
                            <p className="text-sm text-neutral-600">Qty: {item.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-neutral-900">
                              ${parseFloat(item.price).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-soft p-6 sticky top-8">
                  <div className="text-center text-neutral-500">
                    <Package size={48} className="mx-auto mb-4 text-neutral-300" />
                    <p className="text-sm">Select an order to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 