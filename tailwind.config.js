/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#111113',
          800: '#19191c',
          700: '#242428',
          600: '#34343a',
          500: '#505058',
        }
      }
    },
  },
  plugins: [],
}
