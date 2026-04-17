import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8B4513',    // Brown for pastries
        secondary: '#D4AF37',  // Gold
      },
    },
  },
  plugins: [],
}
export default config
