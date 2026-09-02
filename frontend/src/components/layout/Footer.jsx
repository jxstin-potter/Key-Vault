import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import Logo from '../Logo';

// Routes here all already exist elsewhere in the app - the footer is
// deliberately not the place that introduces new destinations.
const LINK_GROUPS = [
  {
    heading: 'Shop',
    links: [
      { label: 'Games', to: '/products' },
      { label: 'Genres', to: '/categories' },
      { label: 'About', to: '/about' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Help Center', to: '/help' },
      { label: 'My Keys', to: '/keys' },
      { label: 'Orders', to: '/orders' },
      { label: 'Contact', to: '/contact' },
    ],
  },
];

const LEGAL_LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Cookies', to: '/cookies' },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-100 text-neutral-800 relative">
      {/* Brand hairline. A plain rule that fades out at both ends - it marks
          the boundary without the glow that used to sit under it. */}
      <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-primary-500/0 via-primary-500/70 to-secondary-500/0" />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="max-w-xs space-y-3">
            <Link to="/" className="group inline-flex items-center space-x-2">
              <Logo className="w-7 h-7 transition-opacity duration-150 group-hover:opacity-80" />
              <span className="text-lg font-bold font-display tracking-wide text-gradient-primary">
                KeyVault
              </span>
            </Link>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Genuine game keys, delivered the moment your payment clears.
            </p>
            <a
              href="mailto:support@keyvault.com"
              className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-primary-400 transition-colors"
            >
              <Mail size={14} />
              support@keyvault.com
            </a>
          </div>

          {/* Quick links */}
          <div className="flex gap-12 sm:gap-16">
            {LINK_GROUPS.map((group) => (
              <div key={group.heading}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-400 mb-3">
                  {group.heading}
                </h3>
                <ul className="space-y-2">
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-6 pt-5 border-t border-neutral-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-neutral-500">
            © {currentYear} KeyVault. All rights reserved.
          </p>
          {/* The back-to-top control on some pages is fixed to the viewport's
              bottom-right and floats over this row; the padding keeps the last
              link out from under it. */}
          <div className="flex items-center gap-5 sm:pr-16">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-xs text-neutral-500 hover:text-primary-400 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
