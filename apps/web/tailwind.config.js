/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design System Tokens
        primary:         "#00d4ff",
        "primary-light": "#7dd3fc",
        "primary-dark":  "#0284c7",
        secondary:       "#7c3aed",
        accent:          "#f59e0b",
        success:         "#10b981",
        danger:          "#ef4444",
        warning:         "#f59e0b",

        // Surfaces
        bg:         "#020b18",
        surface:    "#061628",
        "surface-2":"#0a1f35",
        "surface-3":"#0d2540",

        // Text
        "text-main":  "#e2e8f0",
        "text-muted": "#64748b",
        "text-hi":    "#94a3b8",

        // Brand aliases (backwards compatibility)
        brand: {
          black:        "#020b18",
          gold:         "#00d4ff",
          "gold-light": "#7dd3fc",
          "gold-dark":  "#0284c7",
          red:          "#ef4444",
          "red-dark":   "#9f0519",
          blue:         "#00d4ff",
          "blue-dark":  "#0284c7",
          primary:      "#00d4ff",
          background:   "#020b18",
          surface:      "#061628",
          "surface-high":"#0a1f35",
          "text-main":  "#e2e8f0",
          "text-muted": "#64748b",
          tertiary:     "#7c3aed",
        },
      },

      fontFamily: {
        sans:  ['Inter', 'Space Grotesk', 'system-ui', 'sans-serif'],
        head:  ['Space Grotesk', 'Inter', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      backgroundImage: {
        "gradient-primary":   "linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)",
        "gradient-secondary": "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
        "gradient-aurora":    "linear-gradient(135deg, #00d4ff, #7c3aed, #f59e0b, #00d4ff)",
        "gradient-dark":      "linear-gradient(135deg, #0a1f35 0%, #020b18 100%)",
        "gradient-card":      "linear-gradient(135deg, rgba(13,37,64,0.8), rgba(6,22,40,0.9))",
        "gradient-glass":     "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)",
        "gradient-gold":      "linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)",
        "gradient-dark-shine":"linear-gradient(135deg, #0a1f35 0%, #020b18 100%)",
        "glass-gradient":     "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)",
      },

      borderColor: {
        DEFAULT: "rgba(0,212,255,0.12)",
      },

      boxShadow: {
        "cyan":    "0 0 30px rgba(0,212,255,0.25)",
        "purple":  "0 0 30px rgba(124,58,237,0.25)",
        "gold":    "0 0 30px rgba(245,158,11,0.25)",
        "premium": "0 20px 60px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)",
        "card":    "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,255,0.04)",
        "card-hover": "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,255,0.12), 0 0 60px rgba(0,212,255,0.06)",
        "nav-active": "0 0 20px rgba(0,212,255,0.3)",
        "btn":     "0 4px 20px rgba(0,212,255,0.35), 0 0 0 1px rgba(0,212,255,0.3)",
        "btn-hover":"0 8px 30px rgba(0,212,255,0.5)",
        "modal":   "0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,255,0.08)",
      },

      animation: {
        "float":       "float 5s ease-in-out infinite",
        "float-slow":  "floatSlow 7s ease-in-out infinite",
        "glow":        "glow-pulse 3s ease-in-out infinite",
        "aurora":      "aurora 6s ease infinite",
        "shimmer":     "shimmer 2.5s ease-in-out infinite",
        "spin-slow":   "spin-slow 20s linear infinite",
        "spin-rev":    "spin-slow-reverse 28s linear infinite",
        "slide-up":    "slide-up 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
        "slide-down":  "slide-down 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        "scale-in":    "scale-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        "fade-in":     "fade-in 0.4s ease both",
        "breathe":     "breathe 4s ease-in-out infinite",
        "ping-slow":   "ping-slow 2s cubic-bezier(0,0,0.2,1) infinite",
        "gradient-x":  "gradient-x 3s ease infinite",
        "border-travel":"border-travel 3s linear infinite",
      },

      keyframes: {
        "float": {
          "0%,100%": { transform: "translateY(0px) rotate(0deg)" },
          "33%":     { transform: "translateY(-12px) rotate(1deg)" },
          "66%":     { transform: "translateY(6px) rotate(-1deg)" },
        },
        "floatSlow": {
          "0%,100%": { transform: "translateY(0px)" },
          "50%":     { transform: "translateY(-20px)" },
        },
        "glow-pulse": {
          "0%,100%": { boxShadow: "0 0 20px rgba(0,212,255,0.2)" },
          "50%":     { boxShadow: "0 0 40px rgba(0,212,255,0.5)" },
        },
        "aurora": {
          "0%":   { backgroundPosition: "0% 50%" },
          "50%":  { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "shimmer": {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
        "spin-slow":         { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
        "spin-slow-reverse": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(-360deg)" } },
        "slide-up":   { from: { opacity: "0", transform: "translateY(24px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-down": { from: { opacity: "0", transform: "translateY(-12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "scale-in":   { from: { opacity: "0", transform: "scale(0.92)" }, to: { opacity: "1", transform: "scale(1)" } },
        "fade-in":    { from: { opacity: "0" }, to: { opacity: "1" } },
        "breathe":    { "0%,100%": { transform: "scale(1)", opacity: "0.6" }, "50%": { transform: "scale(1.08)", opacity: "1" } },
        "ping-slow":  { "0%": { transform: "scale(1)", opacity: "0.8" }, "100%": { transform: "scale(2.5)", opacity: "0" } },
        "gradient-x": {
          "0%,100%": { backgroundSize: "200% 200%", backgroundPosition: "left center" },
          "50%":     { backgroundSize: "200% 200%", backgroundPosition: "right center" },
        },
        "border-travel": {
          "0%":   { backgroundPosition: "0% 0%" },
          "100%": { backgroundPosition: "300% 0%" },
        },
      },

      transitionTimingFunction: {
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },

      backdropBlur: {
        "xs": "4px",
        "sm": "8px",
        "md": "16px",
        "lg": "32px",
        "xl": "48px",
      },
    },
  },
  plugins: [],
};
