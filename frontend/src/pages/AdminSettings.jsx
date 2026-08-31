import { useState } from 'react';
import { 
  Store, 
  User, 
  Shield, 
  Bell, 
  CreditCard, 
  Truck, 
  Palette,
  Save,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('store');
  const [showPassword, setShowPassword] = useState(false);
  
  // Store settings
  const [storeSettings, setStoreSettings] = useState({
    name: 'KeyVault',
    description: 'Genuine game keys, delivered instantly',
    email: 'admin@keyvault.com',
    phone: '+1 (555) 123-4567',
    address: {
      street: '123 Commerce St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA'
    },
    currency: 'USD',
    timezone: 'America/New_York',
    logo: null
  });

  // User settings
  const [userSettings, setUserSettings] = useState({
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@keyvault.com',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordExpiry: 90,
    loginAttempts: 5
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    orderNotifications: true,
    inventoryNotifications: true,
    customerNotifications: true,
    marketingNotifications: false
  });

  // Payment settings
  const [paymentSettings, setPaymentSettings] = useState({
    stripeEnabled: true,
    paypalEnabled: false,
    stripePublishableKey: 'pk_test_...',
    stripeSecretKey: 'sk_test_...',
    paypalClientId: '',
    paypalSecret: ''
  });

  // Shipping settings
  const [shippingSettings, setShippingSettings] = useState({
    freeShippingThreshold: 50,
    defaultShippingRate: 5.99,
    shippingZones: [
      { name: 'Domestic', rate: 5.99, countries: ['US'] },
      { name: 'International', rate: 15.99, countries: ['CA', 'MX', 'UK'] }
    ]
  });

  // Theme settings
  const [themeSettings, setThemeSettings] = useState({
    primaryColor: '#3B82F6',
    secondaryColor: '#8B5CF6',
    accentColor: '#10B981',
    darkMode: false
  });

  const tabs = [
    { id: 'store', name: 'Store Settings', icon: Store },
    { id: 'user', name: 'User Profile', icon: User },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'payment', name: 'Payment', icon: CreditCard },
    { id: 'shipping', name: 'Shipping', icon: Truck },
    { id: 'theme', name: 'Theme', icon: Palette }
  ];

  // Saving is intentionally not wired up. Every tab here used to PUT to
  // /api/admin/settings/*, none of which exist on the backend, so all seven
  // calls 404'd while the button still reported "Settings saved successfully"
  // on the happy path it never reached. Rather than build those endpoints,
  // note that nothing in the application reads any of these values - they are
  // write-only state - so persisting them would store data no code consumes.
  // The form stays browsable; the save path is disabled until the settings
  // actually drive something.

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setStoreSettings(prev => ({
          ...prev,
          logo: e.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const renderStoreSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Store Name
          </label>
          <input
            type="text"
            value={storeSettings.name}
            onChange={(e) => setStoreSettings(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Store Email
          </label>
          <input
            type="email"
            value={storeSettings.email}
            onChange={(e) => setStoreSettings(prev => ({ ...prev, email: e.target.value }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Store Description
        </label>
        <textarea
          value={storeSettings.description}
          onChange={(e) => setStoreSettings(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={storeSettings.phone}
            onChange={(e) => setStoreSettings(prev => ({ ...prev, phone: e.target.value }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Currency
          </label>
          <select
            value={storeSettings.currency}
            onChange={(e) => setStoreSettings(prev => ({ ...prev, currency: e.target.value }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CAD">CAD (C$)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Store Logo
        </label>
        <div className="flex items-center space-x-4">
          {storeSettings.logo && (
            <img src={storeSettings.logo} alt="Store Logo" className="w-16 h-16 object-contain border rounded-lg" />
          )}
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              id="logo-upload"
            />
            <label
              htmlFor="logo-upload"
              className="cursor-pointer inline-flex items-center px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <Upload size={16} className="mr-2" />
              Upload Logo
            </label>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Store Address
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Street Address"
            value={storeSettings.address.street}
            onChange={(e) => setStoreSettings(prev => ({
              ...prev,
              address: { ...prev.address, street: e.target.value }
            }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <input
            type="text"
            placeholder="City"
            value={storeSettings.address.city}
            onChange={(e) => setStoreSettings(prev => ({
              ...prev,
              address: { ...prev.address, city: e.target.value }
            }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <input
            type="text"
            placeholder="State"
            value={storeSettings.address.state}
            onChange={(e) => setStoreSettings(prev => ({
              ...prev,
              address: { ...prev.address, state: e.target.value }
            }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <input
            type="text"
            placeholder="ZIP Code"
            value={storeSettings.address.zipCode}
            onChange={(e) => setStoreSettings(prev => ({
              ...prev,
              address: { ...prev.address, zipCode: e.target.value }
            }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>
    </div>
  );

  const renderUserSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            First Name
          </label>
          <input
            type="text"
            value={userSettings.firstName}
            onChange={(e) => setUserSettings(prev => ({ ...prev, firstName: e.target.value }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Last Name
          </label>
          <input
            type="text"
            value={userSettings.lastName}
            onChange={(e) => setUserSettings(prev => ({ ...prev, lastName: e.target.value }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Email Address
        </label>
        <input
          type="email"
          value={userSettings.email}
          onChange={(e) => setUserSettings(prev => ({ ...prev, email: e.target.value }))}
          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-neutral-900 mb-4">Change Password</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={userSettings.currentPassword}
                onChange={(e) => setUserSettings(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full pl-4 pr-12 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={userSettings.newPassword}
                onChange={(e) => setUserSettings(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={userSettings.confirmPassword}
                onChange={(e) => setUserSettings(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-neutral-900">Two-Factor Authentication</h3>
          <p className="text-sm text-neutral-600">Add an extra layer of security to your account</p>
        </div>
        <button
          onClick={() => setSecuritySettings(prev => ({ ...prev, twoFactorAuth: !prev.twoFactorAuth }))}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            securitySettings.twoFactorAuth ? "bg-primary-600" : "bg-neutral-200"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-neutral-100 transition-transform",
              securitySettings.twoFactorAuth ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Session Timeout (minutes)
        </label>
        <input
          type="number"
          value={securitySettings.sessionTimeout}
          onChange={(e) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Password Expiry (days)
        </label>
        <input
          type="number"
          value={securitySettings.passwordExpiry}
          onChange={(e) => setSecuritySettings(prev => ({ ...prev, passwordExpiry: parseInt(e.target.value) }))}
          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Maximum Login Attempts
        </label>
        <input
          type="number"
          value={securitySettings.loginAttempts}
          onChange={(e) => setSecuritySettings(prev => ({ ...prev, loginAttempts: parseInt(e.target.value) }))}
          className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      {Object.entries(notificationSettings).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-neutral-900">
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </h3>
            <p className="text-sm text-neutral-600">
              Receive notifications for {key.toLowerCase().replace(/([A-Z])/g, ' $1')}
            </p>
          </div>
          <button
            onClick={() => setNotificationSettings(prev => ({ ...prev, [key]: !value }))}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              value ? "bg-primary-600" : "bg-neutral-200"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-neutral-100 transition-transform",
                value ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      ))}
    </div>
  );

  const renderPaymentSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-neutral-900">Stripe Payments</h3>
          <p className="text-sm text-neutral-600">Enable Stripe payment processing</p>
        </div>
        <button
          onClick={() => setPaymentSettings(prev => ({ ...prev, stripeEnabled: !prev.stripeEnabled }))}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            paymentSettings.stripeEnabled ? "bg-primary-600" : "bg-neutral-200"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-neutral-100 transition-transform",
              paymentSettings.stripeEnabled ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {paymentSettings.stripeEnabled && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Stripe Publishable Key
            </label>
            <input
              type="text"
              value={paymentSettings.stripePublishableKey}
              onChange={(e) => setPaymentSettings(prev => ({ ...prev, stripePublishableKey: e.target.value }))}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Stripe Secret Key
            </label>
            <input
              type="password"
              value={paymentSettings.stripeSecretKey}
              onChange={(e) => setPaymentSettings(prev => ({ ...prev, stripeSecretKey: e.target.value }))}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-neutral-900">PayPal Payments</h3>
          <p className="text-sm text-neutral-600">Enable PayPal payment processing</p>
        </div>
        <button
          onClick={() => setPaymentSettings(prev => ({ ...prev, paypalEnabled: !prev.paypalEnabled }))}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            paymentSettings.paypalEnabled ? "bg-primary-600" : "bg-neutral-200"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-neutral-100 transition-transform",
              paymentSettings.paypalEnabled ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>
    </div>
  );

  const renderShippingSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Free Shipping Threshold ($)
          </label>
          <input
            type="number"
            value={shippingSettings.freeShippingThreshold}
            onChange={(e) => setShippingSettings(prev => ({ ...prev, freeShippingThreshold: parseFloat(e.target.value) }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Default Shipping Rate ($)
          </label>
          <input
            type="number"
            value={shippingSettings.defaultShippingRate}
            onChange={(e) => setShippingSettings(prev => ({ ...prev, defaultShippingRate: parseFloat(e.target.value) }))}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-neutral-900 mb-4">Shipping Zones</h3>
        <div className="space-y-4">
          {shippingSettings.shippingZones.map((zone, index) => (
            <div key={index} className="flex items-center space-x-4 p-4 border border-neutral-200 rounded-lg">
              <div className="flex-1">
                <input
                  type="text"
                  value={zone.name}
                  onChange={(e) => {
                    const newZones = [...shippingSettings.shippingZones];
                    newZones[index].name = e.target.value;
                    setShippingSettings(prev => ({ ...prev, shippingZones: newZones }));
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Zone Name"
                />
              </div>
              <div className="w-24">
                <input
                  type="number"
                  value={zone.rate}
                  onChange={(e) => {
                    const newZones = [...shippingSettings.shippingZones];
                    newZones[index].rate = parseFloat(e.target.value);
                    setShippingSettings(prev => ({ ...prev, shippingZones: newZones }));
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Rate"
                />
              </div>
              <button
                onClick={() => {
                  const newZones = shippingSettings.shippingZones.filter((_, i) => i !== index);
                  setShippingSettings(prev => ({ ...prev, shippingZones: newZones }));
                }}
                className="p-2 text-error-600 hover:bg-error-50 rounded-lg"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const newZones = [...shippingSettings.shippingZones, { name: '', rate: 0, countries: [] }];
              setShippingSettings(prev => ({ ...prev, shippingZones: newZones }));
            }}
            className="w-full py-2 border-2 border-dashed border-neutral-300 rounded-lg text-neutral-600 hover:border-neutral-400 hover:text-neutral-700"
          >
            + Add Shipping Zone
          </button>
        </div>
      </div>
    </div>
  );

  const renderThemeSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Primary Color
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={themeSettings.primaryColor}
              onChange={(e) => setThemeSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
              className="w-12 h-12 border border-neutral-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={themeSettings.primaryColor}
              onChange={(e) => setThemeSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Secondary Color
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={themeSettings.secondaryColor}
              onChange={(e) => setThemeSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
              className="w-12 h-12 border border-neutral-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={themeSettings.secondaryColor}
              onChange={(e) => setThemeSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Accent Color
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={themeSettings.accentColor}
              onChange={(e) => setThemeSettings(prev => ({ ...prev, accentColor: e.target.value }))}
              className="w-12 h-12 border border-neutral-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={themeSettings.accentColor}
              onChange={(e) => setThemeSettings(prev => ({ ...prev, accentColor: e.target.value }))}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-neutral-900">Dark Mode</h3>
          <p className="text-sm text-neutral-600">Enable dark theme for the admin interface</p>
        </div>
        <button
          onClick={() => setThemeSettings(prev => ({ ...prev, darkMode: !prev.darkMode }))}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            themeSettings.darkMode ? "bg-primary-600" : "bg-neutral-200"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-neutral-100 transition-transform",
              themeSettings.darkMode ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'store':
        return renderStoreSettings();
      case 'user':
        return renderUserSettings();
      case 'security':
        return renderSecuritySettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'payment':
        return renderPaymentSettings();
      case 'shipping':
        return renderShippingSettings();
      case 'theme':
        return renderThemeSettings();
      default:
        return renderStoreSettings();
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-neutral-600 mt-2">Manage your store configuration and preferences</p>
      </div>

      <div className="bg-neutral-100 rounded-xl shadow-soft overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-neutral-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    activeTab === tab.id
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                  )}
                >
                  <Icon size={16} />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {renderContent()}

          {/* Saving is disabled - see the note on handleSave above. */}
          <div className="mt-8 pt-6 border-t border-neutral-200">
            <div className="flex items-start gap-3 mb-4 p-4 rounded-lg border border-warning-500/30 bg-warning-500/10">
              <AlertTriangle size={18} className="text-warning-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-neutral-900">Settings are read-only for now</p>
                <p className="text-sm text-neutral-600 mt-1">
                  These controls are not connected to storage yet, so changes are not kept.
                  Nothing in the store reads them.
                </p>
              </div>
            </div>
            <button
              disabled
              title="Saving is not implemented yet"
              className="flex items-center space-x-2 px-6 py-3 rounded-lg font-medium bg-neutral-200 text-neutral-500 cursor-not-allowed"
            >
              <Save size={16} />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 