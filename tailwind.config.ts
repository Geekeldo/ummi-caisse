import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary: teal (corps du logo Ummi) ──
        brand: {
          50:  '#F0F4F3',
          100: '#D9E3E1',
          200: '#B5C9C5',
          300: '#8AABA5',
          400: '#5E8981',
          500: '#3F5E5A',
          600: '#334E4A',
          700: '#273D3A',
          800: '#1D2D2B',
          900: '#121C1B',
        },
        // ── Accent: or / beige (cadre du logo Ummi) ──
        coffee: {
          50:  '#FAF5EC',
          100: '#F2E6CE',
          200: '#E5CD9C',
          300: '#D4B074',
          400: '#C49A58',
          500: '#B8956A',
          600: '#8F7249',
          700: '#6B5537',
          800: '#473825',
          900: '#241C13',
        },
        danger: { 50: '#FDF0F0', 100: '#F9D4D4', 400: '#E06666', 500: '#C44B4B', 600: '#A33333', 700: '#7A2626' },
        warning: { 50: '#FFF8E8', 100: '#FFECC0', 400: '#EFB630', 500: '#D4930D', 600: '#A87200', 700: '#7D5500' },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      animation: {
        'fade-up': 'fadeUp 0.3s ease-out both',
        'slide-in': 'slideIn 0.25s ease-out both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-6px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
