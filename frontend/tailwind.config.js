/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ufc: {
          red: '#D20A0A',
          gold: '#C79B2E',
          dark: '#0A0A0A',
          card: '#1A1A1A',
          border: '#2A2A2A',
          text: '#E5E5E5',
          muted: '#888888',
        },
      },
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
