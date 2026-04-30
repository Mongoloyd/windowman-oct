import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        heading: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        obsidian: "hsl(var(--color-obsidian))",
        surface: {
          DEFAULT: "hsl(var(--color-surface))",
          border: "hsl(var(--color-surface-border))",
        },
        cobalt: {
          DEFAULT: "hsl(var(--color-cobalt))",
          dim: "hsl(var(--color-cobalt-dim))",
        },
        "vivid-orange": "hsl(var(--color-vivid-orange))",
        gold: {
          DEFAULT: "hsl(var(--color-gold-accent))",
        },
        emerald: {
          DEFAULT: "hsl(var(--color-emerald))",
        },
        danger: {
          DEFAULT: "hsl(var(--color-danger))",
        },
        caution: {
          DEFAULT: "hsl(var(--color-caution))",
        },
        navy: {
          DEFAULT: "hsl(var(--color-obsidian))",
        },
        dossier: {
          surface: "#0f1419",
          elevated: "#1a1f2e",
          border: "#2a2f3e",
          accent: "#3b82f6",
          "txt-primary": "#f1f5f9",
          "txt-secondary": "#94a3b8",
          "txt-muted": "#64748b",
          danger: "#ff4444",
          success: "#00ff88",
          warning: "#ffaa00",
          info: "#44aaff",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontSize: {
        'wm-label': ['18px', { lineHeight: '1.3', fontWeight: '700' }],
        'wm-body-soft': ['15px', { lineHeight: '1.6', fontWeight: '400' }],
      },
      borderRadius: {
        lg: "var(--radius-card)",
        md: "var(--radius-btn)",
        sm: "var(--radius-input)",
      },
      keyframes: {
        "header-slide-down": {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "shutter-flash": {
          "0%": { opacity: "0" },
          "10%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "glint": {
          "0%": { left: "-100%", opacity: "0" },
          "40%": { opacity: "1" },
          "100%": { left: "150%", opacity: "0" },
        },
        "status-pulse": {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "0.08" },
        },
        "holo-pulse": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "hero-drift": {
          "0%, 100%": { transform: "scale(1.08) translate(0, 0)" },
          "25%": { transform: "scale(1.08) translate(-10px, 5px)" },
          "50%": { transform: "scale(1.08) translate(5px, -8px)" },
          "75%": { transform: "scale(1.08) translate(8px, 3px)" },
        },
        "blob-drift-1": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "33%": { transform: "translate(30px, 20px)" },
          "66%": { transform: "translate(-20px, 10px)" },
        },
        "blob-drift-2": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "33%": { transform: "translate(-25px, 15px)" },
          "66%": { transform: "translate(15px, -20px)" },
        },
        "blob-drift-3": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "33%": { transform: "translate(20px, -15px)" },
          "66%": { transform: "translate(-15px, 25px)" },
        },
        "blob-drift-4": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "33%": { transform: "translate(-20px, -10px)" },
          "66%": { transform: "translate(25px, 15px)" },
        },
        "float-soft": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-3px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.15s ease-out",
        "accordion-up": "accordion-up 0.15s ease-out",
        "header-slide-down": "header-slide-down 0.15s ease-out",
        "pulse-dot": "pulse-dot 2s infinite",
        "shutter-flash": "shutter-flash 0.3s ease-out",
        "glint": "glint 2.5s ease-in-out infinite",
        "status-pulse": "status-pulse 2s ease-in-out infinite",
        "holo-pulse": "holo-pulse 4s ease infinite",
        "hero-drift": "hero-drift 15s ease-in-out infinite",
        "blob-drift-1": "blob-drift-1 25s ease-in-out infinite",
        "blob-drift-2": "blob-drift-2 30s ease-in-out infinite",
        "blob-drift-3": "blob-drift-3 28s ease-in-out infinite",
        "blob-drift-4": "blob-drift-4 22s ease-in-out infinite",
        "float-soft": "float-soft 5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
