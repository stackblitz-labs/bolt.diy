/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.scss",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
			customAccent: {
				'50': '#FFF1F2',
				'100': '#FFE4E6',
				'200': '#FECDD3',
				'300': '#FDA4AF',
				'400': '#FB7185',
				'500': '#F43F5E',
				'600': '#E11D48',
				'700': '#BE123C',
				'800': '#9F1239',
				'900': '#881337',
				'950': '#4C0519'
			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			white: '#FFFFFF',
  			gray: {
  				'50': '#FAFAFA',
  				'100': '#F5F5F5',
  				'200': '#E5E5E5',
  				'300': '#D4D4D4',
  				'400': '#A3A3A3',
  				'500': '#737373',
  				'600': '#525252',
  				'700': '#404040',
  				'800': '#262626',
  				'900': '#171717',
  				'950': '#0A0A0A'
  			},
  			alpha: {
  				white: {
  					'1': '#FFFFFF03',
  					'2': '#FFFFFF05',
  					'3': '#FFFFFF08',
  					'4': '#FFFFFF0A',
  					'5': '#FFFFFF0D',
  					'10': '#FFFFFF1A',
  					'20': '#FFFFFF33',
  					'30': '#FFFFFF4D',
  					'40': '#FFFFFF66',
  					'50': '#FFFFFF80',
  					'60': '#FFFFFF99',
  					'70': '#FFFFFFB3',
  					'80': '#FFFFFFCC',
  					'90': '#FFFFFFE6',
  					'100': '#FFFFFF'
  				},
  				gray: {
  					'1': '#17171703',
  					'2': '#17171705',
  					'3': '#17171708',
  					'4': '#1717170A',
  					'5': '#1717170D',
  					'10': '#1717171A',
  					'20': '#17171733',
  					'30': '#1717174D',
  					'40': '#17171766',
  					'50': '#17171780',
  					'60': '#17171799',
  					'70': '#171717B3',
  					'80': '#171717CC',
  					'90': '#171717E6',
  					'100': '#171717'
  				},
  				red: {
  					'1': '#EF444403',
  					'2': '#EF444405',
  					'3': '#EF444408',
  					'4': '#EF44440A',
  					'5': '#EF44440D',
  					'10': '#EF44441A',
  					'20': '#EF444433',
  					'30': '#EF44444D',
  					'40': '#EF444466',
  					'50': '#EF444480',
  					'60': '#EF444499',
  					'70': '#EF4444B3',
  					'80': '#EF4444CC',
  					'90': '#EF4444E6',
  					'100': '#EF4444'
  				},
				customAccent: {
					'1': '#F43F5E03',
					'2': '#F43F5E05',
					'3': '#F43F5E08',
					'4': '#F43F5E0A',
					'5': '#F43F5E0D',
					'10': '#F43F5E1A',
					'20': '#F43F5E33',
					'30': '#F43F5E4D',
					'40': '#F43F5E66',
					'50': '#F43F5E80',
					'60': '#F43F5E99',
					'70': '#F43F5EB3',
					'80': '#F43F5ECC',
					'90': '#F43F5EE6',
					'100': '#F43F5E'
				}
  			},
  			green: {
  				'50': '#F0FDF4',
  				'100': '#DCFCE7',
  				'200': '#BBF7D0',
  				'300': '#86EFAC',
  				'400': '#4ADE80',
  				'500': '#22C55E',
  				'600': '#16A34A',
  				'700': '#15803D',
  				'800': '#166534',
  				'900': '#14532D',
  				'950': '#052E16'
  			},
  			orange: {
  				'50': '#FFFAEB',
  				'100': '#FEEFC7',
  				'200': '#FEDF89',
  				'300': '#FEC84B',
  				'400': '#FDB022',
  				'500': '#F79009',
  				'600': '#DC6803',
  				'700': '#B54708',
  				'800': '#93370D',
  				'900': '#792E0D'
  			},
			red: {
				'50': '#FEF2F2',
				'100': '#FEE2E2',
				'200': '#FECACA',
				'300': '#FCA5A5',
				'400': '#F87171',
				'500': '#EF4444',
				'600': '#DC2626',
				'700': '#B91C1C',
				'800': '#991B1B',
				'900': '#7F1D1D',
				'950': '#450A0A'
			},
			rose: {
				'50': '#FFF1F2',
				'100': '#FFE4E6',
				'200': '#FECDD3',
				'300': '#FDA4AF',
				'400': '#FB7185',
				'500': '#F43F5E',
				'600': '#E11D48',
				'700': '#BE123C',
				'800': '#9F1239',
				'900': '#881337',
				'950': '#4C0519'
			},
			pink: {
				'50': '#FDF2F8',
				'100': '#FCE7F3',
				'200': '#FBCFE8',
				'300': '#F9A8D4',
				'400': '#F472B6',
				'500': '#EC4899',
				'600': '#DB2777',
				'700': '#BE185D',
				'800': '#9D174D',
				'900': '#831843',
				'950': '#500724'
			},
			bolt: {
  				elements: {
  					borderColor: 'var(--bolt-elements-borderColor)',
  					borderColorActive: 'var(--bolt-elements-borderColorActive)',
  					background: {
  						depth: {
  							'1': 'var(--bolt-elements-bg-depth-1)',
  							'2': 'var(--bolt-elements-bg-depth-2)',
  							'3': 'var(--bolt-elements-bg-depth-3)',
  							'4': 'var(--bolt-elements-bg-depth-4)'
  						}
  					},
  					textPrimary: 'var(--bolt-elements-textPrimary)',
  					textHeading: 'var(--bolt-elements-textHeading)',
  					textSecondary: 'var(--bolt-elements-textSecondary)',
  					textTertiary: 'var(--bolt-elements-textTertiary)',
  					code: {
  						background: 'var(--bolt-elements-code-background)',
  						text: 'var(--bolt-elements-code-text)'
  					},
  					button: {
  						primary: {
  							background: 'var(--bolt-elements-button-primary-background)',
  							backgroundHover: 'var(--bolt-elements-button-primary-backgroundHover)',
  							text: 'var(--bolt-elements-button-primary-text)'
  						},
  						secondary: {
  							background: 'var(--bolt-elements-button-secondary-background)',
  							backgroundHover: 'var(--bolt-elements-button-secondary-backgroundHover)',
  							text: 'var(--bolt-elements-button-secondary-text)'
  						},
  						danger: {
  							background: 'var(--bolt-elements-button-danger-background)',
  							backgroundHover: 'var(--bolt-elements-button-danger-backgroundHover)',
  							text: 'var(--bolt-elements-button-danger-text)'
  						}
  					},
  					item: {
  						contentDefault: 'var(--bolt-elements-item-contentDefault)',
  						contentActive: 'var(--bolt-elements-item-contentActive)',
  						contentAccent: 'var(--bolt-elements-item-contentAccent)',
  						contentDanger: 'var(--bolt-elements-item-contentDanger)',
  						backgroundDefault: 'var(--bolt-elements-item-backgroundDefault)',
  						backgroundActive: 'var(--bolt-elements-item-backgroundActive)',
  						backgroundAccent: 'var(--bolt-elements-item-backgroundAccent)',
  						backgroundDanger: 'var(--bolt-elements-item-backgroundDanger)'
  					},
  					actions: {
  						background: 'var(--bolt-elements-actions-background)',
  						code: {
  							background: 'var(--bolt-elements-actions-code-background)'
  						}
  					},
  					artifacts: {
  						background: 'var(--bolt-elements-artifacts-background)',
  						backgroundHover: 'var(--bolt-elements-artifacts-backgroundHover)',
  						borderColor: 'var(--bolt-elements-artifacts-borderColor)',
  						inlineCode: {
  							background: 'var(--bolt-elements-artifacts-inlineCode-background)',
  							text: 'var(--bolt-elements-artifacts-inlineCode-text)'
  						}
  					},
  					messages: {
  						background: 'var(--bolt-elements-messages-background)',
  						linkColor: 'var(--bolt-elements-messages-linkColor)',
  						code: {
  							background: 'var(--bolt-elements-messages-code-background)'
  						},
  						inlineCode: {
  							background: 'var(--bolt-elements-messages-inlineCode-background)',
  							text: 'var(--bolt-elements-messages-inlineCode-text)'
  						}
  					},
  					icon: {
  						success: 'var(--bolt-elements-icon-success)',
  						error: 'var(--bolt-elements-icon-error)',
  						primary: 'var(--bolt-elements-icon-primary)',
  						secondary: 'var(--bolt-elements-icon-secondary)',
  						tertiary: 'var(--bolt-elements-icon-tertiary)'
  					},
  					preview: {
  						addressBar: {
  							background: 'var(--bolt-elements-preview-addressBar-background)',
  							backgroundHover: 'var(--bolt-elements-preview-addressBar-backgroundHover)',
  							backgroundActive: 'var(--bolt-elements-preview-addressBar-backgroundActive)',
  							text: 'var(--bolt-elements-preview-addressBar-text)',
  							textActive: 'var(--bolt-elements-preview-addressBar-textActive)'
  						}
  					},
  					terminals: {
  						background: 'var(--bolt-elements-terminals-background)',
  						buttonBackground: 'var(--bolt-elements-terminals-buttonBackground)'
  					},
  					dividerColor: 'var(--bolt-elements-dividerColor)',
  					loader: {
  						background: 'var(--bolt-elements-loader-background)',
  						progress: 'var(--bolt-elements-loader-progress)'
  					},
  					prompt: {
  						background: 'var(--bolt-elements-prompt-background)'
  					},
  					sidebar: {
  						dropdownShadow: 'var(--bolt-elements-sidebar-dropdownShadow)',
  						buttonBackgroundDefault: 'var(--bolt-elements-sidebar-buttonBackgroundDefault)',
  						buttonBackgroundHover: 'var(--bolt-elements-sidebar-buttonBackgroundHover)',
  						buttonText: 'var(--bolt-elements-sidebar-buttonText)'
  					},
  					cta: {
  						background: 'var(--bolt-elements-cta-background)',
  						text: 'var(--bolt-elements-cta-text)'
  					}
  				}
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
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
  			'scale-in': {
  				'0%': {
  					transform: 'scale(0)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				}
  			},
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
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'scale-in': 'scale-in 0.2s ease-in-out forwards',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'system-ui',
  				'sans-serif'
  			]
  		}
  	}
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
}