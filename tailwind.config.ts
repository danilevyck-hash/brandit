import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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
    },
  },
  plugins: [],
};
export default config;
