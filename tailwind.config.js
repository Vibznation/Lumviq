/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        midnight: {
          50: '#f0f4f9',
          100: '#dbe4f0',
          200: '#b7c9e0',
          300: '#8ea9cc',
          400: '#5c81ae',
          500: '#3a5f8f',
          600: '#284672',
          700: '#1c335a',
          800: '#132444',
          900: '#0b1830',
          950: '#060f1e',
        },
        teal: {
          50: '#eafffb',
          100: '#c7fff4',
          200: '#93ffe9',
          300: '#54f7db',
          400: '#1fe2c8',
          500: '#0dc4ae',
          600: '#089d8c',
          700: '#0b7d71',
          800: '#0f635b',
          900: '#11514c',
        },
        gold: {
          50: '#fdf8ec',
          100: '#faedc8',
          200: '#f5da91',
          300: '#efc258',
          400: '#eaab30',
          500: '#dc8f1c',
          600: '#bd6f16',
          700: '#975116',
          800: '#7c4118',
          900: '#693718',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
