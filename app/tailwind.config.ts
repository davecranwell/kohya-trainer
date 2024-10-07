import { type Config } from 'tailwindcss';
import animatePlugin from 'tailwindcss-animate';
import radixPlugin from 'tailwindcss-radix';
import defaultTheme from 'tailwindcss/defaultTheme';
import colors from 'tailwindcss/colors';

export default {
    content: ['./app/**/*.{ts,tsx,jsx,js}'],
    theme: {},
    plugins: [require('@tailwindcss/typography'), animatePlugin, radixPlugin, require('@tailwindcss/forms')],
} satisfies Config;
