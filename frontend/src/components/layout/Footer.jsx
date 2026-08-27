import { Link } from 'react-router-dom';
import { 
  Facebook, 
  Twitter, 
  Instagram, 
  Linkedin, 
  Mail, 
  Phone, 
  MapPin,
  Heart
} from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-white relative">
      {/* Top Gradient Bar */}
      <div className="h-1 w-full bg-gradient-to-r from-primary-500 to-secondary-500 absolute top-0 left-0" />
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">CF</span>
              </div>
              <span className="text-xl font-bold text-gradient-primary">CommerceFlow</span>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Your trusted destination for quality products and exceptional shopping experiences. 
              We're committed to providing the best service to our customers.
            </p>
            <div className="flex space-x-4">
              <a 
                href="#" 
                className="text-neutral-400 hover:text-primary-500 transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={20} />
              </a>
              <a 
                href="#" 
                className="text-neutral-400 hover:text-primary-500 transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={20} />
              </a>
              <a 
                href="#" 
                className="text-neutral-400 hover:text-primary-500 transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={20} />
              </a>
              <a 
                href="#" 
                className="text-neutral-400 hover:text-primary-500 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gradient-primary">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/" 
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  to="/products" 
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  Products
                </Link>
              </li>
              <li>
                <Link 
                  to="/categories" 
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  Categories
                </Link>
              </li>
              <li>
                <Link 
                  to="/about" 
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link 
                  to="/contact" 
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gradient-primary">Customer Service</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/help" 
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link 
                  to="/shipping" 
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link 
                  to="/returns" 
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  Returns & Exchanges
                </Link>
              </li>
              <li>
                <Link 
                  to="/faq" 
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link 
                  to="/size-guide" 
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  Size Guide
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gradient-primary">Contact Us</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Mail size={16} className="text-primary-500" />
                <span className="text-neutral-400 text-sm">support@keyvault.com</span>
              </div>
              <div className="flex items-center space-x-3">
                <Phone size={16} className="text-primary-500" />
                <span className="text-neutral-400 text-sm">+1 (555) 123-4567</span>
              </div>
              <div className="flex items-start space-x-3">
                <MapPin size={16} className="text-primary-500 mt-0.5" />
                <span className="text-neutral-400 text-sm">
                  123 Commerce St<br />
                  Shopping District<br />
                  NY 10001, USA
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-neutral-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-neutral-400 text-sm">
              © {currentYear} CommerceFlow. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-sm">
              <Link 
                to="/privacy" 
                className="text-neutral-400 hover:text-primary-500 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms" 
                className="text-neutral-400 hover:text-primary-500 transition-colors"
              >
                Terms of Service
              </Link>
              <Link 
                to="/cookies" 
                className="text-neutral-400 hover:text-primary-500 transition-colors"
              >
                Cookie Policy
              </Link>
            </div>
          </div>
          
          {/* Made with love */}
          <div className="text-center mt-4">
            <p className="text-neutral-500 text-xs flex items-center justify-center space-x-1">
              <span>Made with</span>
              <span className="inline-block align-middle bg-gradient-to-br from-primary-500 to-secondary-500 text-transparent bg-clip-text">
                <Heart size={12} className="inline-block" />
              </span>
              <span>for modern e-commerce</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
} 