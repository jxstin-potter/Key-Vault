import { Link } from 'react-router-dom';

/**
 * Browse-by-platform entry point.
 *
 * Platform is one of the two axes this catalogue is organised around (the
 * other is genre, which already has its own page), but it was reachable only
 * from inside the Games filter sidebar. Every comparable store surfaces
 * platform as a top-level browse route, because "I want a Steam key" is a
 * common way to arrive.
 *
 * Colours are each storefront's own brand colour, so the strip is scannable
 * without icons - we have no brand-icon library installed.
 */
// Steam, Epic and PlayStation ship genuinely dark brand colours, which sit
// almost on top of the page ground (#0e1210) - Epic measured 1.01:1 against
// it, effectively invisible. These are each brand's lighter official shade,
// which stays recognisable while actually reading as a tile.
const PLATFORMS = [
  { name: 'STEAM', label: 'Steam', color: '#2a475e' },
  { name: 'EPIC', label: 'Epic Games', color: '#313131' },
  { name: 'GOG', label: 'GOG', color: '#8c2ce0' },
  { name: 'XBOX', label: 'Xbox', color: '#107c10' },
  { name: 'PLAYSTATION', label: 'PlayStation', color: '#0070d1' },
  { name: 'NINTENDO', label: 'Nintendo', color: '#e60012' }
];

export default function PlatformStrip() {
  return (
    <section className="w-full py-12 bg-neutral-50 border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight mb-6">
          Shop by platform
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PLATFORMS.map((p) => (
            <Link
              key={p.name}
              to={`/products?platform=${p.name}`}
              className="group relative overflow-hidden rounded-xl border border-neutral-300 p-4 h-24 flex items-end transition-transform duration-200 hover:-translate-y-0.5"
              style={{ backgroundColor: p.color }}
            >
              <span className="relative z-10 text-white font-semibold text-sm">{p.label}</span>
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
