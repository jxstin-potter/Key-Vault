/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Accent hues with no ramp equivalent. Used sparingly and semantically:
        // orange = urgency/low stock, pink = premium/exclusive, purple = depth.
        // Neon green and cyan are deliberately NOT duplicated here - they are
        // primary-400 and secondary-400, so there is one source of truth.
        gaming: {
          orange: '#FF6600',
          pink: '#FF00AA',
          purple: '#6600FF',
        },
        // Neon spring green. 400 is the hero shade - the one that reads as
        // "neon" on the dark ground, used for text, icons, rings and the CTA
        // gradient. 600 stays dark on purpose: it is the background under
        // white text (`bg-primary-600 text-white`) in badges and pills, and it
        // holds the same 3.3:1 contrast the previous teal had, so retuning the
        // hue costs no legibility.
        primary: {
          50: '#e6fff4',
          100: '#b8ffe2',
          200: '#7dffc9',
          300: '#33ffab',
          400: '#00ff88',
          500: '#00e074',
          600: '#00a15f',
          700: '#007f4b',
          800: '#00663d',
          900: '#005032',
          950: '#002e1c',
        },
        // Bright cyan. Pairs with primary for the green-to-cyan gradient that
        // carries the brand; on its own it marks trust/informational surfaces.
        secondary: {
          50: '#e8fdff',
          100: '#c4f9ff',
          200: '#8ff3ff',
          300: '#4de9ff',
          400: '#00ccff',
          500: '#00b0e6',
          600: '#008fbf',
          700: '#006f96',
          800: '#005876',
          900: '#00485f',
          950: '#002d3d',
        },
        accent: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          950: '#422006',
        },
        // Inverted scale: 50 is the darkest (the page ground) and 950 the
        // lightest (primary text). Retuned from a green-black to the indigo
        // black the brand sits on - 50 is the page ground, 200 the card ground.
        neutral: {
          50: '#0f0f1e',
          100: '#16162a',
          200: '#1a1a2e',
          300: '#262640',
          400: '#3d3d5c',
          500: '#6b6b8a',
          600: '#9c9cb8',
          700: '#bfbfd4',
          800: '#d9d9e6',
          900: '#f2f2f7',
          950: '#fbfbfd',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        pixel: ['"Press Start 2P"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-gentle': 'bounceGentle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'large': '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 2px 10px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 20px rgba(47, 214, 150, 0.35)',
        'glow-purple': '0 0 20px rgba(217, 70, 239, 0.3)',
        'neon-green': '0 0 10px rgba(0, 255, 136, 0.3), 0 0 20px rgba(0, 204, 255, 0.2), inset 0 0 10px rgba(255, 255, 255, 0.1)',
        'neon-green-lg': '0 0 20px rgba(0, 255, 136, 0.6), 0 0 40px rgba(0, 204, 255, 0.4), inset 0 0 10px rgba(255, 255, 255, 0.15)',
        'neon-cyan': '0 0 20px rgba(0, 204, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
} 