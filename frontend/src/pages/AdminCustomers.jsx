import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  ShoppingBag,
  DollarSign,
  Star,
  MoreVertical,
  Download,
  ArrowUpDown,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('createdAt');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/users');
      setCustomers(response.data.users || []);
      setFilteredCustomers(response.data.users || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort customers
  useEffect(() => {
    let filtered = customers.filter(customer => {
      const matchesSearch = 
        `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm));
      const matchesStatus = selectedStatus === 'All' || customer.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });

    // Sort customers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        case 'totalSpent':
          return (b.totalSpent || 0) - (a.totalSpent || 0);
        case 'totalOrders':
          return (b.totalOrders || 0) - (a.totalOrders || 0);
        case 'createdAt':
          return new Date(b.createdAt) - new Date(a.createdAt);
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    setFilteredCustomers(filtered);
  }, [customers, searchTerm, selectedStatus, sortBy]);

  const handleViewCustomer = (customer) => {
    setSelectedCustomer(customer);
    setShowCustomerModal(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status) => {
    return status === 'active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-neutral-100 text-neutral-800';
  };

  const getCustomerValue = (totalSpent) => {
    if (totalSpent >= 1000) return { label: 'VIP', color: 'bg-purple-100 text-purple-800' };
    if (totalSpent >= 500) return { label: 'Premium', color: 'bg-blue-100 text-blue-800' };
    if (totalSpent >= 200) return { label: 'Regular', color: 'bg-green-100 text-green-800' };
    return { label: 'New', color: 'bg-yellow-100 text-yellow-800' };
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
        <h1 className="text-2xl font-bold text-neutral-900">Customer Management</h1>
        <p className="text-neutral-600 mt-2">View and manage your customer base</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-neutral-100 rounded-xl p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total Customers</p>
              <p className="text-2xl font-bold text-neutral-900">{customers.length}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Mail className="text-primary-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-neutral-100 rounded-xl p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Active Customers</p>
              <p className="text-2xl font-bold text-neutral-900">
                {customers.filter(c => c.status === 'active').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
              <Star className="text-success-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-neutral-100 rounded-xl p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Total Revenue</p>
              <p className="text-2xl font-bold text-neutral-900">
                {formatCurrency(customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0))}
              </p>
            </div>
            <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-secondary-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-neutral-100 rounded-xl p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Avg Order Value</p>
              <p className="text-2xl font-bold text-neutral-900">
                {(() => {
                  const totalSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
                  const totalOrders = customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0);
                  return formatCurrency(totalOrders > 0 ? totalSpent / totalOrders : 0);
                })()}
              </p>
            </div>
            <div className="w-12 h-12 bg-accent-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="text-accent-600" size={24} />
            </div>
          </div>
        </div>
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
                placeholder="Search customers by name or email..."
                aria-label="Search customers"
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
              aria-label="Filter customers by status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="All">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="text-neutral-400" size={20} />
            <select
              aria-label="Sort customers"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="createdAt">Date Joined</option>
              <option value="name">Name</option>
              <option value="totalSpent">Total Spent</option>
              <option value="totalOrders">Total Orders</option>
            </select>
          </div>

          {/* Export */}
          <button className="flex items-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => {
          const customerValue = getCustomerValue(customer.totalSpent);
          return (
            <div key={customer.id} className="bg-neutral-100 rounded-xl shadow-soft p-6 hover:shadow-medium transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-neutral-900">
                    {customer.firstName} {customer.lastName}
                  </h3>
                  <p className="text-sm text-neutral-600">{customer.email}</p>
                </div>
                <button
                  onClick={() => handleViewCustomer(customer)}
                  className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <MoreVertical size={16} />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Phone size={14} />
                  <span>{customer.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <MapPin size={14} />
                  <span>Location not available</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Calendar size={14} />
                  <span>Joined {formatDate(customer.createdAt)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="text-center">
                  <p className="text-lg font-semibold text-neutral-900">{customer.totalOrders}</p>
                  <p className="text-xs text-neutral-600">Orders</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-neutral-900">{formatCurrency(customer.totalSpent)}</p>
                  <p className="text-xs text-neutral-600">Total Spent</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-neutral-900">
                    {formatCurrency(
                      (customer.totalOrders && customer.totalOrders > 0) 
                        ? customer.totalSpent / customer.totalOrders 
                        : 0
                    )}
                  </p>
                  <p className="text-xs text-neutral-600">Avg Order</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className={cn(
                  "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                  getStatusColor(customer.status)
                )}>
                  {customer.status === 'active' ? 'Active' : 'Inactive'}
                </span>
                <span className={cn(
                  "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                  customerValue.color
                )}>
                  {customerValue.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <Mail className="mx-auto h-12 w-12 text-neutral-400" />
          <h3 className="mt-2 text-sm font-medium text-neutral-900">No customers found</h3>
          <p className="mt-1 text-sm text-neutral-500">Try adjusting your search or filter criteria.</p>
        </div>
      )}

      {/* Customer Detail Modal */}
      {showCustomerModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-neutral-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-neutral-100 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-neutral-100 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-neutral-900">
                    Customer Details
                  </h3>
                  <button
                    onClick={() => setShowCustomerModal(false)}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-neutral-900">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h4>
                    <p className="text-sm text-neutral-600">{selectedCustomer.email}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-neutral-900">Phone</p>
                      <p className="text-neutral-600">{selectedCustomer.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">Status</p>
                      <span className={cn(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                        getStatusColor(selectedCustomer.status)
                      )}>
                        {selectedCustomer.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="font-medium text-neutral-900 mb-2">Role</p>
                    <p className="text-sm text-neutral-600 capitalize">{selectedCustomer.role.toLowerCase()}</p>
                  </div>

                  <div>
                    <p className="font-medium text-neutral-900 mb-2">Statistics</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-neutral-600">Total Orders</p>
                        <p className="font-medium">{selectedCustomer.totalOrders || 0}</p>
                      </div>
                      <div>
                        <p className="text-neutral-600">Total Spent</p>
                        <p className="font-medium">{formatCurrency(selectedCustomer.totalSpent || 0)}</p>
                      </div>
                      <div>
                        <p className="text-neutral-600">Reviews</p>
                        <p className="font-medium">{selectedCustomer.reviewCount || 0}</p>
                          </div>
                      <div>
                        <p className="text-neutral-600">Member Since</p>
                        <p className="font-medium">{formatDate(selectedCustomer.createdAt)}</p>
                        </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 