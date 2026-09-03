/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        夜空: '#0b1120',
        面板: '#111a2e',
        边框: '#22304d',
        主辉: '#38bdf8',
        次辉: '#a78bfa',
        正文: '#e2e8f0',
        暗文: '#94a3b8',
      },
    },
  },
  plugins: [],
}
