import { Link } from 'react-router-dom';
import { User, ShoppingCart, ArrowRight } from 'lucide-react';

export default function LoginPrompt({ 
  title = "Login Required", 
  message = "Please login to access this feature",
  showCartIcon = false 
}) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          {showCartIcon ? <ShoppingCart className="text-white" size={32} /> : <User className="text-white" size={32} />}
        </div>
        
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">{title}</h2>
        <p className="text-neutral-600 mb-8 leading-relaxed">{message}</p>
        
        <div className="space-y-3">
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium rounded-lg hover:from-primary-700 hover:to-secondary-700 transition-all duration-200 shadow-medium hover:shadow-large transform hover:-translate-y-0.5"
          >
            Login to Your Account
            <ArrowRight className="ml-2" size={18} />
          </Link>
          
          <p className="text-sm text-neutral-500">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              Sign up here
            </Link>
          </p>
        </div>
        
        {/* Test Account Info */}
        <div className="mt-8 p-4 bg-neutral-50 rounded-lg">
          <p className="text-sm text-neutral-600 mb-2">Test Account:</p>
          <p className="text-xs text-neutral-500">
            Email: user@keyvault.com<br />
            Password: user123
          </p>
        </div>
      </div>
    </div>
  );
} 