import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Helpers en lib/ pueden emitir nombres de clase dinámicos (ej.
    // heatmapClasses en src/lib/ventas/format.ts retorna strings como
    // "bg-teal-100" según el delta). Tailwind necesita escanear estos
    // archivos para que las clases sobrevivan el purge.
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "brandit-black": "#231F20",
        "brandit-orange": "#F15A29",
        "brandit-blue": "#B6C9D7",
        "brandit-gray": "#58595B",
        cream: "#FFFFFF",
      },
      fontFamily: {
        outfit: ["var(--font-outfit)", "system-ui", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
