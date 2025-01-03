import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { parse } from 'jsonc-parser';

declare module '@remix-run/node' {
    interface Future {
        v3_singleFetch: true;
    }
}

export default defineConfig({
    plugins: [
        remix({
            future: {
                v3_fetcherPersist: true,
                v3_relativeSplatPath: true,
                v3_throwAbortReason: true,
                v3_singleFetch: false, // this is bad because it creates a script tag that doesn't have the required nonce
                v3_lazyRouteDiscovery: true,
            },
        }),
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
