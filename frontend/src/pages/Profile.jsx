import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { User, Mail, Calendar, Edit, Save, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, updateProfile } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('First name and last name are required');
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateProfile(formData);
      if (result.success) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Profile update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || ''
    });
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900">Profile</h1>
          <p className="text-neutral-600 mt-2">Manage your account information</p>
        </div>

        {/* Profile Card */}
        <div className="bg-neutral-100 rounded-xl shadow-soft p-8">
          {/* Avatar Section */}
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">
                {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-neutral-900">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-neutral-600">{user?.email}</p>
          </div>

          {/* Profile Information */}
          <div className="space-y-6">
            {/* Email (Read-only) */}
            <div className="flex items-center space-x-3 p-4 bg-neutral-50 rounded-lg">
              <Mail className="text-neutral-400" size={20} />
              <div className="flex-1">
                <p className="text-sm text-neutral-600">Email</p>
                <p className="font-medium text-neutral-900">{user?.email}</p>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-center space-x-3 p-4 bg-neutral-50 rounded-lg">
              <Calendar className="text-neutral-400" size={20} />
              <div className="flex-1">
                <p className="text-sm text-neutral-600">Member Since</p>
                <p className="font-medium text-neutral-900">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            {/* Name Fields */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-neutral-50 rounded-lg">
                <User className="text-neutral-400" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-neutral-600">Name</p>
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="px-3 py-1 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="First name"
                      />
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="px-3 py-1 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Last name"
                      />
                    </div>
                  ) : (
                    <p className="font-medium text-neutral-900">
                      {user?.firstName} {user?.lastName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="flex items-center space-x-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  >
                    <X size={16} />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className={cn(
                      "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors",
                      isLoading
                        ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                        : "bg-primary-600 text-white hover:bg-primary-700"
                    )}
                  >
                    <Save size={16} />
                    <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Edit size={16} />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 