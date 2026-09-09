/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: "#14171A",
        panel: "#1C2023",
        panelHi: "#22272A",
        hairline: "#2C3237",
        parchment: "#EDEAE2",
        muted: "#9AA0A6",
        live: "#E8A33D",
        engaged: "#4FB6A6",
        low: "#C0654F",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
