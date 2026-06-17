/** @type {import('tailwindcss').Config} */
import { colors } from './src/lib/theme';

module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        CropLink: colors
      },
    },
  },
  plugins: [],
};
