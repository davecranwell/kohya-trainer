import { type Config } from 'tailwindcss';
import animatePlugin from 'tailwindcss-animate';
import radixPlugin from 'tailwindcss-radix';
import defaultTheme from 'tailwindcss/defaultTheme';
import colors from 'tailwindcss/colors';

export default {
    content: ['./app/**/*.{ts,tsx,jsx,js}'],
    theme: {
        extend: {
            colors: {
                gray: colors.gray,
            },
        },
    },
    daisyui: {
        themes: ['nord'],
    },
    // darkMode: 'class',
    // theme: {
    //     fontFamily: {
    //         sans: ['Nunito', ...defaultTheme.fontFamily.sans],
    //     },
    //     colors: {
    //         ...colors,
    //         primary: {
    //             DEFAULT: '#407eb7',
    //             10: '#f3f6fb',
    //             50: '#f3f7fc',
    //             100: '#e7eef7',
    //             200: '#c9dbee',
    //             300: '#9abedf',
    //             400: '#649bcc',
    //             500: '#407eb7',
    //             600: '#2f649a',
    //             700: '#27507d',
    //             800: '#244568',
    //             900: '#223b58',
    //         },
    //         neutral: colors.stone,
    //     },
    //     extend: {},
    // },
    plugins: [require('@tailwindcss/typography'), require('daisyui'), animatePlugin, radixPlugin, require('@tailwindcss/forms')],
} satisfies Config;
