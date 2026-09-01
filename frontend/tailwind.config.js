/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Signal blue. 400 is the hero shade - links, icons, rings, and
        // anything that needs to read as interactive against the dark ground.
        // 600 is the button and pill background under white text; at 5.4:1 it
        // clears AA for normal text, which the earlier green ramps could only
        // manage at the large-text threshold.
        primary: {
          50: '#edf7fe',
          100: '#d3ecfd',
          200: '#ade0fb',
          300: '#85d0f8',
          400: '#66c0f4',
          500: '#3f9fdb',
          600: '#1570a8',
          700: '#115a87',
          800: '#0f4a6f',
          900: '#0e3c5a',
          950: '#082638',
        },
        // Not a second brand colour - it exists so the brand gradient has
        // somewhere to travel. Kept in the same cool family as primary so a
        // gradient reads as depth rather than as two competing hues.
        secondary: {
          50: '#eef9fb',
          100: '#d0f0f6',
          200: '#a5e3ee',
          300: '#6fcfe2',
          400: '#3bb6d0',
          500: '#2596b0',
          600: '#1b7890',
          700: '#175f72',
          800: '#154e5e',
          900: '#14404d',
          950: '#0a2733',
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
        // lightest (primary text). Cool blue-grey rather than a true neutral -
        // the slight blue cast is most of what separates a storefront that
        // looks considered from one that looks like unstyled dark mode. 50 is
        // the page ground, 200 the card ground, 300 the borders.
        neutral: {
          50: '#171a21',
          100: '#1b2838',
          200: '#21344a',
          300: '#2a475e',
          400: '#3d5a75',
          500: '#6a8ba8',
          600: '#93aec5',
          700: '#b8cbdb',
          800: '#d5e2eb',
          900: '#eef3f7',
          950: '#f8fafc',
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
      // One family across the whole UI, with weight and tracking carrying the
      // hierarchy. Steam does the same, and a single neo-grotesque reads as
      // more considered here than a display face paired against a text face.
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
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
        // Depth on a dark ground has to come from real shadow plus a hairline
        // of light along the top edge; a shadow alone just muddies. Kept
        // restrained - the earlier neon glows read as a games console, which
        // is the opposite of the intent here.
        'raised': '0 1px 0 0 rgba(255, 255, 255, 0.06) inset, 0 2px 8px rgba(0, 0, 0, 0.4)',
        'raised-lg': '0 1px 0 0 rgba(255, 255, 255, 0.08) inset, 0 8px 24px rgba(0, 0, 0, 0.55)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
} 