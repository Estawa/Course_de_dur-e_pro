/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        piste: {
          50: '#f2f7f4',
          100: '#dfece3',
          200: '#b9d8c4',
          300: '#8bbd9d',
          400: '#5b9c76',
          500: '#3c7f5a',
          600: '#2b6446',
          700: '#234f39',
          800: '#1b4332',
          900: '#0b1f17'
        },
        cendre: '#c8ba9a',
        alerte: '#b5482f'
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif']
      }
    }
  },
  plugins: []
}
