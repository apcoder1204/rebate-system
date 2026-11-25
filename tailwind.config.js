/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
    './Pages/**/*.{ts,tsx,js,jsx}',
    './Components/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './Context/**/*.{ts,tsx,js,jsx}',
    './Layout.{ts,tsx,js,jsx}',
    './ErrorBoundary.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
};

