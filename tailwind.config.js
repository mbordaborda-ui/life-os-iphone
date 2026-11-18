/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#090909',
          900: '#0d0d0d',
          850: '#111111',
          800: '#171717',
          750: '#1c1c1c',
          700: '#242424',
          600: '#343434',
        },
        lime: {
          DEFAULT: '#b8f36b',
          soft: '#c9f895',
          dim: '#7fae3a',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Inter',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        '2.5xl': '1.25rem',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px) scale(.997)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'row-in': {
          from: { opacity: '0', transform: 'translateY(7px) scale(.99)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(.96) translateY(-4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'modal-in': {
          from: { opacity: '0', transform: 'translateY(10px) scale(.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(14px) scale(.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'progress-grow': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        'check-pop': {
          '0%': { opacity: '0', transform: 'scale(.55) rotate(-12deg)' },
          '65%': { opacity: '1', transform: 'scale(1.16) rotate(2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '.55' },
          '50%': { opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        'scan': {
          from: { transform: 'translateX(-120%)' },
          to: { transform: 'translateX(120%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .26s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .16s ease-out both',
        'row-in': 'row-in .3s cubic-bezier(.22,1,.36,1) both',
        'pop-in': 'pop-in .18s cubic-bezier(.22,1,.36,1) both',
        'sheet-in': 'sheet-in .3s cubic-bezier(.22,1,.36,1) both',
        'modal-in': 'modal-in .24s cubic-bezier(.22,1,.36,1) both',
        'toast-in': 'toast-in .24s cubic-bezier(.22,1,.36,1) both',
        'progress-grow': 'progress-grow .6s cubic-bezier(.22,1,.36,1) both',
        'check-pop': 'check-pop .32s cubic-bezier(.34,1.56,.64,1) both',
        'pulse-soft': 'pulse-soft 2.8s ease-in-out infinite',
        'float': 'float 5s ease-in-out infinite',
        'scan': 'scan 4.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
