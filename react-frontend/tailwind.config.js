/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'modern': ['Inter', 'sans-serif'],
        'orbitron': ['Orbitron', 'monospace'],
      },
      animation: {
        'gradient': 'gradient 15s ease infinite',
        'gradient-fast': 'gradient 8s ease infinite',
        'gradient-text': 'gradient 3s ease infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.33)' },
          '40%, 50%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'scale(1.2)' },
        }
      },
      backgroundImage: {
        'cyber-gradient': 'linear-gradient(45deg, transparent, rgba(6, 182, 212, 0.1), transparent)',
        'cyber-border': 'linear-gradient(45deg, rgba(6, 182, 212, 0.1) 0%, transparent 25%, transparent 75%, rgba(168, 85, 247, 0.1) 100%)',
        'hologram': 'linear-gradient(45deg, rgba(6, 182, 212, 0.1) 0%, rgba(168, 85, 247, 0.1) 25%, rgba(6, 182, 212, 0.1) 50%, rgba(168, 85, 247, 0.1) 75%, rgba(6, 182, 212, 0.1) 100%)',
        'gradient-text': 'linear-gradient(135deg, #06b6d4, #a855f7, #06b6d4)',
        'data-grid': 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)',
        'radial-overlay': 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%)',
      },
      backgroundSize: {
        'gradient-size': '400% 400%',
        'grid-size': '20px 20px',
        'text-gradient': '200% 200%',
      },
      backdropBlur: {
        'glass': '12px',
      },
      boxShadow: {
        'neon': '0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor, 0 0 20px currentColor',
        'glow': '0 0 20px rgba(6, 182, 212, 0.5), 0 0 40px rgba(6, 182, 212, 0.3), 0 0 60px rgba(6, 182, 212, 0.1)',
        'text': '0 2px 4px rgba(0, 0, 0, 0.1)',
        'text-lg': '0 4px 8px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [
    function({ addUtilities, addComponents }) {
      addComponents({
        '.glass': {
          '@apply bg-white/10 backdrop-blur-glass border border-white/20': {},
        },
        '.glass-dark': {
          '@apply bg-black/20 backdrop-blur-glass border border-white/10': {},
        },
        '.cyber-border': {
          position: 'relative',
          background: 'linear-gradient(45deg, transparent, rgba(6, 182, 212, 0.1), transparent)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            background: 'linear-gradient(45deg, rgba(6, 182, 212, 0.1) 0%, transparent 25%, transparent 75%, rgba(168, 85, 247, 0.1) 100%)',
            borderRadius: 'inherit',
            padding: '1px',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
          },
        },
        '.neon-text': {
          textShadow: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor, 0 0 20px currentColor',
        },
        '.hologram': {
          '@apply bg-hologram bg-gradient-size animate-gradient-fast': {},
        },
        '.data-grid': {
          '@apply bg-data-grid bg-grid-size': {},
        },
        '.gradient-text': {
          '@apply bg-gradient-text bg-text-gradient bg-clip-text text-transparent animate-gradient-text': {},
        },
        '.body-gradient': {
          '@apply bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 min-h-screen font-modern antialiased': {},
          backgroundAttachment: 'fixed',
          backgroundSize: '400% 400%',
          animation: 'gradient 15s ease infinite',
        },
        '.body-overlay': {
          '&::before': {
            content: '""',
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%)',
            pointerEvents: 'none',
            zIndex: '-1',
          },
        },
      });
      
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.glow-on-hover': {
          '@apply transition-all duration-300': {},
          '&:hover': {
            '@apply shadow-glow -translate-y-0.5': {},
          },
        },
        '.text-shadow': {
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        },
        '.text-shadow-lg': {
          textShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        },
      });
    },
  ],
}