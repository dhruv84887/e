import forms from '@tailwindcss/forms'

/** @type {import('tailwindcss').Config} */
export default { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#252622', muted: '#777970', paper: '#f7f7f4', sage: '#dfe6dc' }, fontFamily: { sans: ['DM Sans', 'sans-serif'], display: ['Manrope', 'sans-serif'] }, boxShadow: { soft: '0 10px 35px rgba(25,28,23,.06)' } } }, plugins: [forms] }
