/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1C1F23',
        surface: '#24282D',
        paper: '#F7F7F5',
        line: '#D8D6D0',
        orange: {
          DEFAULT: '#FF5A1F',
          dark: '#E04A14',
        },
        site: {
          DEFAULT: '#1E5AA8',
          dark: '#164580',
        },
        approved: '#1F8A4C',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,31,35,0.06), 0 1px 8px rgba(28,31,35,0.04)',
      },
    },
  },
  plugins: [],
};
