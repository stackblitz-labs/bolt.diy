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
  			'3xs': '320px',
  			'2xs': '375px',
  			'xs': '475px',
  			'sm': '640px',
  			'md': '768px',
  			'lg': '1024px',
  			'xl': '1280px',
  			'2xl': '1400px',
  			'3xl': '1536px',
  			'4xl': '1920px',
  			'5xl': '2560px',
  			'6xl': '3840px',
  			'7xl': '5120px'
  		}
  	},
  	extend: {
  		spacing: {
  			'0': '0',
  			'px': '1px',
  			'0.5': '2px',
  			'1': '4px',
  			'1.5': '6px',
  			'2': '8px',
  			'2.5': '10px',
  			'3': '12px',
  			'3.5': '14px',
  			'4': '16px',
  			'5': '20px',
  			'6': '24px',
  			'7': '28px',
  			'8': '32px',
  			'9': '36px',
  			'10': '40px',
  			'11': '44px',
  			'12': '48px',
  			'14': '56px',
  			'16': '64px',
  			'20': '80px',
  			'24': '96px',
  			'28': '112px',
  			'32': '128px',
  			'36': '144px',
  			'40': '160px',
  			'44': '176px',
  			'48': '192px',
  			'52': '208px',
  			'56': '224px',
  			'60': '240px',
  			'64': '256px',
  			'72': '288px',
  			'80': '320px',
  			'96': '384px'
  		},
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
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			white: '#FFFFFF',
  			black: '#000000',
  			transparent: 'transparent',
  			slate: {
  				'50': '#FFF1F3',
  				'100': '#FFE4E8',
  				'200': '#FDCED8',
  				'300': '#FCA5B7',
  				'400': '#F97391',
  				'500': '#F02D5E',
  				'600': '#DE2059',
  				'700': '#BC144A',
  				'800': '#9D1445',
  				'900': '#861541',
  				'950': '#4B061F'
  			},
  			gray: {
  				'50': '#F9FAFB',
  				'100': '#F3F4F6',
  				'200': '#E5E7EB',
  				'300': '#D1D5DB',
  				'400': '#9CA3AF',
  				'500': '#6B7280',
  				'600': '#4B5563',
  				'700': '#374151',
  				'800': '#1F2937',
  				'900': '#111827',
  				'950': '#030712'
  			},
  			zinc: {
  				'50': '#FAFAFA',
  				'100': '#F4F4F5',
  				'200': '#E4E4E7',
  				'300': '#D4D4D8',
  				'400': '#A1A1AA',
  				'500': '#71717A',
  				'600': '#52525B',
  				'700': '#3F3F46',
  				'800': '#27272A',
  				'900': '#18181B',
  				'950': '#09090B'
  			},
  			neutral: {
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
  			stone: {
  				'50': '#FAFAF9',
  				'100': '#F5F5F4',
  				'200': '#E7E5E4',
  				'300': '#D6D3D1',
  				'400': '#A8A29E',
  				'500': '#78716C',
  				'600': '#57534E',
  				'700': '#444030',
  				'800': '#292524',
  				'900': '#1C1917',
  				'950': '#0C0A09'
  			},
  			red: {
  				'50': '#FDF4F3',
  				'100': '#FCE7E7',
  				'200': '#F8D3D4',
  				'300': '#EA8286',
  				'400': '#EA8286',
  				'500': '#DC4C55',
  				'600': '#C93545',
  				'700': '#A92739',
  				'800': '#8E2335',
  				'900': '#7A2133',
  				'950': '#430E17'
  			},
  			orange: {
  				'50': '#FEF9EC',
  				'100': '#FBEECA',
  				'200': '#F6DC91',
  				'300': '#F2C457',
  				'400': '#EEAE31',
  				'500': '#E89221',
  				'600': '#CD6B12',
  				'700': '#AA4B13',
  				'800': '#8A3B16',
  				'900': '#723115',
  				'950': '#411707'
  			},
  			amber: {
  				'50': '#FFFBEB',
  				'100': '#FEF3C7',
  				'200': '#FDE68A',
  				'300': '#FCD34D',
  				'400': '#FBBF24',
  				'500': '#F59E0B',
  				'600': '#D97706',
  				'700': '#B45309',
  				'800': '#92400E',
  				'900': '#78350F',
  				'950': '#451A03'
  			},
  			yellow: {
  				'50': '#FEFCE8',
  				'100': '#FEF9C3',
  				'200': '#FEF08A',
  				'300': '#FDE047',
  				'400': '#FACC15',
  				'500': '#EAB308',
  				'600': '#CA8A04',
  				'700': '#A16207',
  				'800': '#854D0E',
  				'900': '#713F12',
  				'950': '#422006'
  			},
  			lime: {
  				'50': '#F7FEE7',
  				'100': '#ECFCCB',
  				'200': '#D9F99D',
  				'300': '#BEF264',
  				'400': '#A3E635',
  				'500': '#84CC16',
  				'600': '#65A30D',
  				'700': '#4D7C0F',
  				'800': '#3F6212',
  				'900': '#365314',
  				'950': '#1A2E05'
  			},
  			green: {
  				'50': '#F0FDF5',
  				'100': '#DCFCE7',
  				'200': '#BBF7D0',
  				'300': '#86EFAC',
  				'400': '#4ADE80',
  				'500': '#22C55E',
  				'600': '#16A34A',
  				'700': '#15803D',
  				'800': '#166534',
  				'900': '#14532D',
  				'950': '#062D19'
  			},
  			emerald: {
  				'50': '#ECFDF5',
  				'100': '#D1FAE5',
  				'200': '#A7F3D0',
  				'300': '#6EE7B7',
  				'400': '#34D399',
  				'500': '#10B981',
  				'600': '#059669',
  				'700': '#047857',
  				'800': '#065F46',
  				'900': '#064E3B',
  				'950': '#022C22'
  			},
  			teal: {
  				'50': '#F0FDFA',
  				'100': '#CCFBF1',
  				'200': '#99F6E4',
  				'300': '#5EEAD4',
  				'400': '#2DD4BF',
  				'500': '#14B8A6',
  				'600': '#0D9488',
  				'700': '#0F766E',
  				'800': '#115E59',
  				'900': '#134E4A',
  				'950': '#042F2E'
  			},
  			cyan: {
  				'50': '#ECFEFF',
  				'100': '#CFFAFE',
  				'200': '#A5F3FC',
  				'300': '#67E8F9',
  				'400': '#22D3EE',
  				'500': '#06B6D4',
  				'600': '#0891B2',
  				'700': '#0E7490',
  				'800': '#155E75',
  				'900': '#164E63',
  				'950': '#083344'
  			},
  			sky: {
  				'50': '#F0F9FF',
  				'100': '#E0F2FE',
  				'200': '#BAE6FD',
  				'300': '#7DD3FC',
  				'400': '#38BDF8',
  				'500': '#0EA5E9',
  				'600': '#0284C7',
  				'700': '#0369A1',
  				'800': '#075985',
  				'900': '#0C4A6E',
  				'950': '#082F49'
  			},
  			blue: {
  				'50': '#ECF3FF',
  				'100': '#DCE9FF',
  				'200': '#C0D6FF',
  				'300': '#9ABAFF',
  				'400': '#7191FF',
  				'500': '#506AFF',
  				'600': '#313FFA',
  				'700': '#252EDD',
  				'800': '#242EC3',
  				'900': '#232C8C',
  				'950': '#151951'
  			},
  			indigo: {
  				'50': '#EEF2FF',
  				'100': '#E0E7FF',
  				'200': '#C7D2FE',
  				'300': '#A5B4FC',
  				'400': '#818CF8',
  				'500': '#6366F1',
  				'600': '#4F46E5',
  				'700': '#4338CA',
  				'800': '#3730A3',
  				'900': '#312E81',
  				'950': '#1E1B4B'
  			},
  			violet: {
  				'50': '#F5F3FF',
  				'100': '#EDE9FE',
  				'200': '#DDD6FE',
  				'300': '#C4B5FD',
  				'400': '#A78BFA',
  				'500': '#8B5CF6',
  				'600': '#7C3AED',
  				'700': '#6D28D9',
  				'800': '#5B21B6',
  				'900': '#4C1D95',
  				'950': '#1E1B4B'
  			},
  			purple: {
  				'50': '#FAF5FF',
  				'100': '#F3E8FF',
  				'200': '#E9D5FF',
  				'300': '#D8B4FE',
  				'400': '#C084FC',
  				'500': '#A855F7',
  				'600': '#9333EA',
  				'700': '#7E22CE',
  				'800': '#6B21A8',
  				'900': '#581C87',
  				'950': '#3B0764'
  			},
  			fuchsia: {
  				'50': '#FDF4FF',
  				'100': '#FAE8FF',
  				'200': '#F5D0FE',
  				'300': '#F0ABFC',
  				'400': '#E879F9',
  				'500': '#D946EF',
  				'600': '#C026D3',
  				'700': '#A21CAF',
  				'800': '#86198F',
  				'900': '#701A75',
  				'950': '#4A044E'
  			},
  			pink: {
  				'50': '#FDF2FA',
  				'100': '#FCE7F6',
  				'200': '#FBCFEE',
  				'300': '#F9A8E0',
  				'400': '#F571C9',
  				'500': '#ED47B1',
  				'600': '#DC2691',
  				'700': '#CE197E',
  				'800': '#9E1660',
  				'900': '#841753',
  				'950': '#50072E'
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
				},
				black: {
					'5': '#0A0A0A 95%',
					'10': '#0A0A0A 90%',
					'20': '#0A0A0A 80%',
					'30': '#0A0A0A 70%',
					'40': '#0A0A0A 60%',
					'50': '#0A0A0A 50%',
					'60': '#0A0A0A 40%',
					'70': '#0A0A0A 30%',
					'80': '#0A0A0A 20%',
					'90': '#0A0A0A 10%'
				}
			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
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
  			none: '0',
  			xs: 'var(--radius-xs)',
  			sm: 'var(--radius-sm)',
  			md: 'var(--radius-md)',
  			lg: 'var(--radius-lg)',
  			xl: 'var(--radius-xl)',
  			'2xl': 'var(--radius-2xl)',
  			'3xl': 'var(--radius-3xl)',
  			'4xl': 'var(--radius-4xl)',
  			full: '9999px'
  		},
  		borderWidth: {
  			DEFAULT: '1px',
  			'0': '0',
  			'2': '2px',
  			'3': '3px',
  			'4': '4px',
  			'5': '5px',
  			'6': '6px',
  			'7': '6px',
  			'8': '8px'
  		},
  		strokeWidth: {
  			'0': '0',
  			'1': '1',
  			'1.33': '1.33',
  			'1.5': '1.5',
  			'1.67': '1.67',
  			'2': '2',
  			'3': '3',
  			'4': '4',
  			'5': '5',
  			'6': '6',
  			'7': '7',
  			'8': '8'
  		},
  		opacity: {
  			'0': '0',
  			'5': '0.05',
  			'10': '0.1',
  			'15': '0.15',
  			'20': '0.2',
  			'25': '0.25',
  			'30': '0.3',
  			'35': '0.35',
  			'40': '0.4',
  			'45': '0.45',
  			'50': '0.5',
  			'55': '0.55',
  			'60': '0.6',
  			'65': '0.65',
  			'70': '0.7',
  			'75': '0.75',
  			'80': '0.8',
  			'85': '0.85',
  			'90': '0.9',
  			'95': '0.95',
  			'100': '1'
  		},
  		lineHeight: {
  			'1': '4px',
  			'2': '8px',
  			'3': '12px',
  			'4': '16px',
  			'5': '20px',
  			'6': '24px',
  			'7': '28px',
  			'8': '32px',
  			'9': '36px',
  			'10': '40px',
  			'11': '44px',
  			'12': '48px',
  			'13': '52px',
  			'14': '56px',
  			'15': '60px',
  			'16': '64px',
  			'17': '68px',
  			'18': '72px',
  			'19': '76px',
  			'20': '80px'
  		},
  		screens: {
  			'3xs': '320px',
  			'2xs': '375px',
  			'xs': '475px',
  			'sm': '640px',
  			'md': '768px',
  			'lg': '1024px',
  			'xl': '1280px',
  			'2xl': '1536px',
  			'3xl': '1920px',
  			'4xl': '2560px',
  			'5xl': '3840px',
  			'6xl': '5120px',
  			'7xl': '7680px'
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
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'scale-in': 'scale-in 0.2s ease-in-out forwards'
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
