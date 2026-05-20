/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gainz: {
          bg: '#f0ece4',
          primary: '#2d5a27',
          primaryLight: '#a8d08a',
          dark: '#1a1a1a',
          accentRed: '#e63b2e',
          accentRedBg: '#fff0f0',
        }
      },
    },
  },
  plugins: [],
};