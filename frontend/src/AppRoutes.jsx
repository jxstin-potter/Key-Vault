import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { setNavigate } from './lib/navigation';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import AdminLayout from './components/layout/AdminLayout';
import AuthGuard from './components/AuthGuard';
import AdminGuard from './components/AdminGuard';
import Home from './pages/Home';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminProducts from './pages/AdminProducts';
import AdminOrders from './pages/AdminOrders';
import AdminCustomers from './pages/AdminCustomers';
import AdminSettings from './pages/AdminSettings';
import AdminAnalytics from './pages/AdminAnalytics';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { useEffect } from 'react';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import CheckoutSuccess from './pages/CheckoutSuccess';
import MyKeys from './pages/MyKeys';
import Orders from './pages/Orders';
import Profile from './pages/Profile';

export default function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);

  return (
    <div
      className="w-full bg-neutral-50"
    >
      {!location.pathname.startsWith('/admin') && <Header />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={
            <AuthGuard>
              <Checkout />
            </AuthGuard>
          } />
          <Route path="/checkout/success" element={
            <AuthGuard>
              <CheckoutSuccess />
            </AuthGuard>
          } />
          <Route path="/keys" element={<MyKeys />} />
          <Route path="/orders" element={
            <AuthGuard>
              <Orders />
            </AuthGuard>
          } />
          <Route path="/profile" element={
            <AuthGuard>
              <Profile />
            </AuthGuard>
          } />
          
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <AdminGuard>
              <AdminLayout />
            </AdminGuard>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </main>
      {!location.pathname.startsWith('/admin') && <Footer />}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#374151',
            boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.15)',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            fontSize: '14px',
            fontWeight: '500',
          },
          success: {
            style: {
              background: '#10B981',
              color: '#fff',
              border: '1px solid #059669',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#10B981',
            },
          },
          error: {
            style: {
              background: '#EF4444',
              color: '#fff',
              border: '1px solid #DC2626',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#EF4444',
            },
          },
        }}
      />
    </div>
  );
} 