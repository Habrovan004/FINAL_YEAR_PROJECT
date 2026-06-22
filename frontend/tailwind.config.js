/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e' },
        lavender: { 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd' },
        mint: { 100: '#dcfce7', 200: '#bbf7d0' },
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}
