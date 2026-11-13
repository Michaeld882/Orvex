/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06080d',
          900: '#0a0d14',
          850: '#0e121b',
          800: '#121724',
          700: '#1a2132',
          600: '#252e44',
          500: '#3a4560',
        },
        mist: {
          100: '#eef2fa',
          300: '#b4bdd2',
          400: '#8c97b1',
          500: '#667290',
        },
        volt: {
          300: '#dcff7a',
          400: '#c8f53c',
          500: '#a8d41f',
        },
        arc: {
          300: '#7af0d6',
          400: '#34e3c0',
          500: '#12b99a',
        },
        ion: {
          400: '#6aa7ff',
          500: '#4a86e8',
        },
        ember: {
          400: '#ffb454',
        },
        flare: {
          400: '#ff6b7a',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'DM Sans', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(200,245,60,0.25), 0 8px 40px -8px rgba(200,245,60,0.35)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -16px rgba(0,0,0,0.6)',
      },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        floaty: 'floaty 7s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
