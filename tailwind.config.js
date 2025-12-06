/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0ea5e9", // sky-500
          accent: "#f59e0b", // amber-500
          success: "#10b981", // emerald-500
          danger: "#ef4444", // red-500
        },
      },
      boxShadow: {
        elevated:
          "0 2px 10px -2px rgba(0,0,0,0.06), 0 4px 16px -4px rgba(0,0,0,0.06)",
        floating: "0 8px 24px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        250: "250ms",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
