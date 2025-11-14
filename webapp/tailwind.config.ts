import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

export default {
    content: ['./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: [
                    'Inter',
                    'ui-sans-serif',
                    'system-ui',
                    'sans-serif',
                    'Apple Color Emoji',
                    'Segoe UI Emoji',
                    'Segoe UI Symbol',
                    'Noto Color Emoji',
                ],
            },
            fontSize: {
                '2xs': '0.625rem',
            },
            animation: {
                pulse: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                bounce: 'bounce 1s infinite',
            },
            keyframes: {
                pulse: {
                    '0%, 100%': {
                        opacity: '1',
                    },
                    '50%': {
                        opacity: '.5',
                    },
                },
            },
            colors: {
                text: '#fafafa',
                stroke: '#27272a',
                primary: {
                    light: '#a78bfa', // violet-400
                    DEFAULT: '#8b5cf6', // violet-500
                    dark: '#7c3aed', // violet-600
                    superdark: '#1a0e2e', // violet-900
                },
                accent1: {
                    light: '#67e8f9', // cyan-300
                    DEFAULT: '#22d3ee', // cyan-400
                    dark: '#06b6d4', // cyan-500
                },
                accent2: {
                    light: '#fcd34d', // amber-300
                    DEFAULT: '#f59e0b', // amber-500
                    dark: '#d97706', // amber-600
                },
                semantic: {
                    success: {
                        light: '#86efac', // green-300
                        DEFAULT: '#22c55e', // green-500
                        dark: '#16a34a', // green-600
                    },
                    info: {
                        light: '#93c5fd', // blue-300
                        DEFAULT: '#3b82f6', // blue-500
                        dark: '#2563eb', // blue-600
                    },
                    warning: {
                        light: '#fdba74', // orange-300
                        DEFAULT: '#f97316', // orange-500
                        dark: '#ea580c', // orange-600
                    },
                    error: {
                        light: '#fca5a5', // red-300
                        DEFAULT: '#ef4444', // red-500
                        dark: '#dc2626', // red-600
                    },
                },
            },
        },
    },
    plugins: [require('tailwindcss-aria-attributes')],
} satisfies Config;
