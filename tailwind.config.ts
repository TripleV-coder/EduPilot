import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			display: [
  				'var(--font-display)',
  				'system-ui',
  				'sans-serif'
  			],
  			body: [
  				'var(--font-body)',
  				'system-ui',
  				'sans-serif'
  			],
  			ui: [
  				'var(--font-ui)',
  				'system-ui',
  				'sans-serif'
  			],
  			sans: [
  				'var(--font-body)',
  				'system-ui',
  				'sans-serif'
  			],
  			heading: [
  				'var(--font-display)',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-mono)',
  				'monospace'
  			]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				'50': 'hsl(var(--primary-50))',
  				'100': 'hsl(var(--primary-100))',
  				'200': 'hsl(var(--primary-200))',
  				'300': 'hsl(var(--primary-300))',
  				'400': 'hsl(var(--primary-400))',
  				'500': 'hsl(var(--primary-500))',
  				'600': 'hsl(var(--primary-600))',
  				'700': 'hsl(var(--primary-700))',
  				'800': 'hsl(var(--primary-800))',
  				'900': 'hsl(var(--primary-900))',
  				'950': 'hsl(var(--primary-950))',
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				'50': 'hsl(var(--secondary-50))',
  				'100': 'hsl(var(--secondary-100))',
  				'200': 'hsl(var(--secondary-200))',
  				'300': 'hsl(var(--secondary-300))',
  				'400': 'hsl(var(--secondary-400))',
  				'500': 'hsl(var(--secondary-500))',
  				'600': 'hsl(var(--secondary-600))',
  				'700': 'hsl(var(--secondary-700))',
  				'800': 'hsl(var(--secondary-800))',
  				'900': 'hsl(var(--secondary-900))',
  				'950': 'hsl(var(--secondary-950))',
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			accent: {
  				'50': 'hsl(var(--accent-50))',
  				'100': 'hsl(var(--accent-100))',
  				'200': 'hsl(var(--accent-200))',
  				'300': 'hsl(var(--accent-300))',
  				'400': 'hsl(var(--accent-400))',
  				'500': 'hsl(var(--accent-500))',
  				'600': 'hsl(var(--accent-600))',
  				'700': 'hsl(var(--accent-700))',
  				'800': 'hsl(var(--accent-800))',
  				'900': 'hsl(var(--accent-900))',
  				'950': 'hsl(var(--accent-950))',
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			surface: {
  				ground: 'hsl(var(--surface-ground))',
  				base: 'hsl(var(--surface-base))',
  				elevated: 'hsl(var(--surface-elevated))',
  				overlay: 'hsl(var(--surface-overlay))',
  				hover: 'hsl(var(--surface-hover))',
  				active: 'hsl(var(--surface-active))'
  			},
  			text: {
  				primary: 'hsl(var(--text-primary))',
  				secondary: 'hsl(var(--text-secondary))',
  				tertiary: 'hsl(var(--text-tertiary))',
  				placeholder: 'hsl(var(--text-placeholder))',
  				disabled: 'hsl(var(--text-disabled))',
  				inverse: 'hsl(var(--text-inverse))'
  			},
  			slate: {
  				'50': 'hsl(var(--slate-50))',
  				'100': 'hsl(var(--slate-100))',
  				'200': 'hsl(var(--slate-200))',
  				'300': 'hsl(var(--slate-300))',
  				'400': 'hsl(var(--slate-400))',
  				'500': 'hsl(var(--slate-500))',
  				'600': 'hsl(var(--slate-600))',
  				'700': 'hsl(var(--slate-700))',
  				'800': 'hsl(var(--slate-800))',
  				'900': 'hsl(var(--slate-900))',
  				'950': 'hsl(var(--slate-950))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				light: 'hsl(var(--success-light))',
  				border: 'hsl(var(--success-border))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				light: 'hsl(var(--warning-light))',
  				border: 'hsl(var(--warning-border))'
  			},
  			error: {
  				DEFAULT: 'hsl(var(--error))',
  				light: 'hsl(var(--error-light))',
  				border: 'hsl(var(--error-border))'
  			},
  			info: {
  				DEFAULT: 'hsl(var(--info))',
  				light: 'hsl(var(--info-light))',
  				border: 'hsl(var(--info-border))'
  			},
  			explorer: {
  				bg: 'hsl(var(--explorer-bg))',
  				'bg-elevated': 'hsl(var(--explorer-bg-elevated))',
  				'bg-hover': 'hsl(var(--explorer-bg-hover))',
  				surface: 'hsl(var(--explorer-surface))',
  				'surface-elevated': 'hsl(var(--explorer-surface-elevated))',
  				accent: 'hsl(var(--explorer-accent))',
  				'accent-dim': 'hsl(var(--explorer-accent-dim))',
  				'accent-glow': 'hsl(var(--explorer-accent-glow))',
  				'accent-muted': 'hsl(var(--explorer-accent-muted))',
  				'accent-secondary': 'hsl(var(--explorer-accent-secondary))',
  				foreground: 'hsl(var(--explorer-foreground))',
  				'foreground-secondary': 'hsl(var(--explorer-foreground-secondary))',
  				muted: 'hsl(var(--explorer-muted))',
  				'muted-strong': 'hsl(var(--explorer-muted-strong))',
  				border: 'hsl(var(--explorer-border))',
  				'border-subtle': 'hsl(var(--explorer-border-subtle))',
  				'border-luminous': 'hsl(var(--explorer-border-luminous))'
  			},
  			'success-bg': 'hsl(var(--success-bg))',
  			'success-border': 'hsl(var(--success-border))',
  			'warning-bg': 'hsl(var(--warning-bg))',
  			'warning-border': 'hsl(var(--warning-border))',
  			'error-bg': 'hsl(var(--error-bg))',
  			'error-border': 'hsl(var(--error-border))',
  			'info-bg': 'hsl(var(--info-bg))',
  			'info-border': 'hsl(var(--info-border))'
  		},
  		borderRadius: {
  			xs: 'var(--radius-xs)',
  			sm: 'var(--radius-sm)',
  			md: 'var(--radius-md)',
  			lg: 'var(--radius-lg)',
  			xl: 'var(--radius-xl)',
  			'2xl': 'var(--radius-2xl)',
  			'3xl': 'var(--radius-3xl)',
  			full: 'var(--radius-full)'
  		},
  		boxShadow: {
  			xs: 'var(--shadow-xs)',
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
  			'2xl': 'var(--shadow-2xl)',
  			'glow-primary': 'var(--shadow-glow-primary)',
  			'glow-secondary': 'var(--shadow-glow-secondary)',
  			'glow-accent': 'var(--shadow-glow-accent)',
  			'glow-sm': 'var(--shadow-glow-primary)',
  			'glow-md': 'var(--shadow-glow-secondary)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'fade-in': {
  				from: {
  					opacity: '0'
  				},
  				to: {
  					opacity: '1'
  				}
  			},
  			'fade-in-up': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(20px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'fade-in-down': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(-20px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'slide-in-left': {
  				from: {
  					opacity: '0',
  					transform: 'translateX(-20px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateX(0)'
  				}
  			},
  			'slide-in-right': {
  				from: {
  					opacity: '0',
  					transform: 'translateX(20px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateX(0)'
  				}
  			},
  			'scale-in': {
  				from: {
  					opacity: '0',
  					transform: 'scale(0.95)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'scale(1)'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-8px)'
  				}
  			},
  			'float-slow': {
  				'0%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-12px)'
  				}
  			},
  			pulse: {
  				'0%, 100%': {
  					opacity: '1'
  				},
  				'50%': {
  					opacity: '0.6'
  				}
  			},
  			'pulse-glow': {
  				'0%, 100%': {
  					boxShadow: '0 0 20px hsl(var(--primary-500) / 0.3)'
  				},
  				'50%': {
  					boxShadow: '0 0 30px hsl(var(--primary-500) / 0.5)'
  				}
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			},
  			'spin-slow': {
  				from: {
  					transform: 'rotate(0deg)'
  				},
  				to: {
  					transform: 'rotate(360deg)'
  				}
  			},
  			bounce: {
  				'0%, 100%': {
  					transform: 'translateY(-5%)'
  				},
  				'50%': {
  					transform: 'translateY(0)'
  				}
  			},
  			wiggle: {
  				'0%, 100%': {
  					transform: 'rotate(-3deg)'
  				},
  				'50%': {
  					transform: 'rotate(3deg)'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 0.3s ease-out',
  			'fade-in-up': 'fade-in-up 0.5s var(--ease-expo-out)',
  			'fade-in-down': 'fade-in-down 0.5s var(--ease-expo-out)',
  			'slide-in-left': 'slide-in-left 0.5s var(--ease-expo-out)',
  			'slide-in-right': 'slide-in-right 0.5s var(--ease-expo-out)',
  			'scale-in': 'scale-in 0.3s var(--ease-expo-out)',
  			float: 'float 4s ease-in-out infinite',
  			'float-slow': 'float-slow 6s ease-in-out infinite',
  			pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  			'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
  			shimmer: 'shimmer 2s linear infinite',
  			'spin-slow': 'spin-slow 8s linear infinite',
  			bounce: 'bounce 1s infinite',
  			wiggle: 'wiggle 0.5s ease-in-out'
  		},
  		transitionTimingFunction: {
  			smooth: 'var(--ease-smooth)',
  			out: 'var(--ease-out)',
  			in: 'var(--ease-in)',
  			bounce: 'var(--ease-bounce)',
  			'expo-out': 'var(--ease-expo-out)'
  		},
  		transitionDuration: {
  			instant: 'var(--duration-instant)',
  			fast: 'var(--duration-fast)',
  			normal: 'var(--duration-normal)',
  			slow: 'var(--duration-slow)',
  			slower: 'var(--duration-slower)'
  		},
  		backdropBlur: {
  			glass: 'var(--glass-blur)',
  			'glass-strong': 'var(--glass-blur-strong)'
  		},
  		zIndex: {
  			dropdown: 'var(--z-dropdown)',
  			sticky: 'var(--z-sticky)',
  			fixed: 'var(--z-fixed)',
  			'modal-backdrop': 'var(--z-modal-backdrop)',
  			modal: 'var(--z-modal)',
  			popover: 'var(--z-popover)',
  			tooltip: 'var(--z-tooltip)',
  			toast: 'var(--z-toast)'
  		},
  		spacing: {
  			'18': '4.5rem',
  			'88': '22rem',
  			'128': '32rem'
  		}
  	}
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- config CommonJS
  plugins: [require("tailwindcss-animate")],
};

export default config;
