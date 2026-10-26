/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cDark: '#121212',
        cGold: '#f9cb55',
        cGray: '#c1c1c1',
        cLight: '#f8f8f8',
      },
      fontFamily: {
        poppins: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Gang of Three"', 'Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
