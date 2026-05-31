/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        sakura: {
          50: "#FFF5F7",
          100: "#FFDCE5",
          200: "#FFB7C5",
          300: "#FF8FAA",
          400: "#FF6B8E",
          500: "#E84574",
        },
        sky: {
          200: "#B4E3F9",
          300: "#87CEEB",
          400: "#5CB8E4",
        },
        lavender: {
          100: "#F3EEFA",
          200: "#E6E6FA",
          300: "#C5A3FF",
          400: "#9F6EFF",
        },
        "anime-bg": {
          DEFAULT: "#0d0f1a",
          panel: "rgba(18, 20, 36, 0.85)",
          card: "rgba(30, 32, 55, 0.7)",
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', "sans-serif"],
        rounded: ['"M PLUS Rounded 1c"', "sans-serif"],
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite alternate",
        "sakura-fall": "sakuraFall 8s linear infinite",
        sparkle: "sparkle 0.6s ease-out forwards",
        "bounce-in": "bounceIn 0.5s cubic-bezier(0.68,-0.55,0.27,1.55)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        glow: {
          from: { boxShadow: "0 0 4px #FFB7C5, 0 0 8px #FFB7C580" },
          to: { boxShadow: "0 0 8px #FFB7C5, 0 0 20px #FFB7C580" },
        },
        sakuraFall: {
          "0%": { transform: "translateY(-20px) rotate(0deg)", opacity: "0" },
          "10%": { opacity: "1" },
          "100%": {
            transform: "translateY(600px) rotate(360deg)",
            opacity: "0",
          },
        },
        sparkle: {
          "0%": { transform: "scale(0)", opacity: "1" },
          "50%": { transform: "scale(1.3)", opacity: "0.8" },
          "100%": { transform: "scale(0)", opacity: "0" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "60%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
