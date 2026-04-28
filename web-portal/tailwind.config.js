/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg':        '#0A0E1A',
        'dark-bg2':       '#0D1117',
        'dark-surface':   '#111827',
        'dark-surface2':  '#1F2937',
        'light-bg':       '#F8FAFF',
        'light-bg2':      '#EFF2F8',
        'light-surface':  '#FFFFFF',
        'light-surface2': '#F1F5F9',
        'accent-cyan':    '#00D4FF',
        'accent-blue':    '#0066FF',
        'accent-purple':  '#7C3AED',
        'accent-purple2': '#A855F7',
        'ns-success':     '#10B981',
        'ns-warning':     '#F59E0B',
        'ns-danger':      '#EF4444',
      },
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in':   'fadeIn 0.4s ease-out forwards',
        'slide-in':  'slideIn 0.35s ease-out forwards',
        'slide-up':  'slideUp 0.3s ease-out forwards',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0, transform: 'translateY(8px)' },  to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn:  { from: { opacity: 0, transform: 'translateX(24px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        slideUp:  { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.12), 0 4px 20px rgba(0,0,0,0.08)',
        'card-dark':  '0 1px 3px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.4)',
        'glow-cyan':  '0 0 24px rgba(0,212,255,0.18)',
        'glow-blue':  '0 0 24px rgba(0,102,255,0.2)',
        'focus':      '0 0 0 3px rgba(0,212,255,0.3)',
        'focus-light':'0 0 0 3px rgba(0,102,255,0.2)',
      },
    },
  },
  plugins: [],
}
