/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        graviton: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffd',
          300: '#7cc5fb',
          400: '#36a8f7',
          500: '#0c8de8',
          600: '#006fc6',
          700: '#0159a1',
          800: '#064b85',
          900: '#0b3f6e',
          950: '#072849',
        },
        aws: {
          orange: '#FF9900',
          squid: '#232F3E',
          dark: '#161E2D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
