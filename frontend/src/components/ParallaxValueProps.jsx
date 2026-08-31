import { Zap, ShieldCheck, Globe, Lock, Tag, Headphones, Gamepad2, Star } from 'lucide-react';

const valueProps = [
  {
    icon: Zap,
    title: 'Instant Delivery',
    desc: 'Your key appears the moment payment clears.'
  },
  {
    icon: ShieldCheck,
    title: 'Genuine Keys',
    desc: 'Every code is sourced legitimately and activation-checked.'
  },
  {
    icon: Gamepad2,
    title: 'Every Major Platform',
    desc: 'Steam, Epic, GOG, Xbox, PlayStation and more.'
  },
  {
    icon: Lock,
    title: 'Secure Checkout',
    desc: 'Payments handled end to end by Stripe.'
  },
  {
    icon: Globe,
    title: 'Region Shown Up Front',
    desc: 'No surprises - the region is on every listing.'
  },
  {
    icon: Tag,
    title: 'Competitive Prices',
    desc: 'Deals across the catalogue, all year round.'
  },
  {
    icon: Headphones,
    title: '24/7 Support',
    desc: 'Trouble redeeming? We are here any time.'
  },
  {
    icon: Star,
    title: 'Verified Reviews',
    desc: 'Ratings from players who actually bought the game.'
  }
];

export default function ParallaxValueProps() {
  return (
    <section
      className="relative w-full py-20 bg-fixed bg-center bg-cover"
      style={{
        backgroundImage:
          'linear-gradient(rgba(14,18,16,0.92),rgba(14,18,16,0.92)), url(https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=1200&q=80)'
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-light text-neutral-900 mb-12 text-center tracking-tight">
          Why KeyVault?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {valueProps.map(({ icon, title, desc }) => {
            const IconComponent = icon;
            return (
              <div
                key={title}
                className="flex flex-col items-center bg-neutral-50/80 rounded-xl shadow-soft p-6 text-center backdrop-blur-md border border-neutral-100"
              >
                <IconComponent className="mb-4 text-primary-600" size={36} />
                <h3 className="font-semibold text-neutral-900 mb-2 text-lg">{title}</h3>
                <p className="text-neutral-600 text-sm">{desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
