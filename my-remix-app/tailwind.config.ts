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
        },
        colors: {
            ...colors,
            primary: {
                DEFAULT: colors.indigo[600],
                faded: colors.indigo[500],
            },
            secondary: {
                DEFAULT: colors.gray[200],
            },
        },
    },
    plugins: [],
} satisfies Config;
