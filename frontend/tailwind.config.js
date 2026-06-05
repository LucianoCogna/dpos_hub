/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f6ecff',
          100: '#eed2ff',
          200: '#d8abff',
          300: '#c285ff',
          400: '#ab62ff',
          500: '#9945ff',
          600: '#8629ff',
          700: '#7000f5',
          800: '#5900c2',
          900: '#430090',
        },
      },
    },
  },
  plugins: [],
};
