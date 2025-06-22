export const designTokens = {
	colors: {
		brand: {
			primary: "#2563eb", // Professional blue
			secondary: "#7c3aed", // Premium purple
			accent: "#06b6d4", // Cyan for highlights
		},
		semantic: {
			success: "#10b981",
			warning: "#f59e0b",
			error: "#ef4444",
			info: "#3b82f6",
		},
		neutral: {
			50: "#fafafa",
			100: "#f4f4f5",
			200: "#e4e4e7",
			300: "#d4d4d8",
			400: "#a1a1aa",
			500: "#71717a",
			600: "#52525b",
			700: "#3f3f46",
			800: "#27272a",
			900: "#18181b",
			950: "#09090b",
		},
	},
	typography: {
		fonts: {
			sans: "Inter, system-ui, -apple-system, sans-serif",
			mono: "JetBrains Mono, Consolas, monospace",
		},
		sizes: {
			xs: "0.75rem",
			sm: "0.875rem",
			base: "1rem",
			lg: "1.125rem",
			xl: "1.25rem",
			"2xl": "1.5rem",
			"3xl": "1.875rem",
			"4xl": "2.25rem",
			"5xl": "3rem",
		},
		weights: {
			normal: 400,
			medium: 500,
			semibold: 600,
			bold: 700,
		},
	},
	spacing: {
		xs: "0.25rem",
		sm: "0.5rem",
		md: "1rem",
		lg: "1.5rem",
		xl: "2rem",
		"2xl": "3rem",
		"3xl": "4rem",
	},
	borderRadius: {
		none: "0",
		sm: "0.25rem",
		base: "0.375rem",
		md: "0.5rem",
		lg: "0.75rem",
		xl: "1rem",
		"2xl": "1.5rem",
		full: "9999px",
	},
	shadows: {
		sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
		base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
		md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
		lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
		xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
		"2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
		inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
	},
	animation: {
		duration: {
			fast: "150ms",
			base: "200ms",
			slow: "300ms",
			slower: "500ms",
		},
		easing: {
			linear: "linear",
			in: "cubic-bezier(0.4, 0, 1, 1)",
			out: "cubic-bezier(0, 0, 0.2, 1)",
			inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
		},
	},
} as const;

export type DesignTokens = typeof designTokens;