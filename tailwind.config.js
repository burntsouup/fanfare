/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Inter"', 'system-ui', 'sans-serif']
      },
      colors: {
        ink: '#0e0b1a',
        paper: '#fbf7ff',
        accent: '#ff5fa8',
        accent2: '#7c5cff'
      }
    }
  },
  plugins: []
}
