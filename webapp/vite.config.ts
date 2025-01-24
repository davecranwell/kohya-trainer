import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { parse } from 'jsonc-parser';

export default defineConfig({
    plugins: [
        reactRouter(),
        tsconfigPaths(),
        {
            name: 'vite-plugin-jsonc',
            transform(code, id) {
                if (id.endsWith('.jsonc')) {
                    const parsed = parse(code);
                    return {
                        code: `export default ${JSON.stringify(parsed)}`,
                        map: null, // No source map for JSONC
                    };
                }
                return null;
            },
        },
    ],
});
