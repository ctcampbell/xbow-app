/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 50: '#f6f6f4', 100: '#e9e8e3', 700: '#3f3d38', 800: '#2b2a26', 900: '#1a1917' },
        clay: { 50: '#fbf5ef', 100: '#f3e3d3', 500: '#b4703a', 600: '#9a5c2c', 700: '#7c4a24' },
      },
    },
  },
  plugins: [],
};
