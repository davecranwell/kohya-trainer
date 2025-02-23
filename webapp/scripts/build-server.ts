import * as esbuild from 'esbuild';
import { parse } from 'jsonc-parser';
import fs from 'node:fs/promises';

// JSONC plugin to handle JSON with comments
// Required because some config files (like tsconfig.json) may contain comments
const jsoncPlugin: esbuild.Plugin = {
    name: 'jsonc',
    setup(build) {
        build.onLoad({ filter: /\.jsonc$/ }, async (args) => {
            const content = await fs.readFile(args.path, 'utf8');
            const parsed = parse(content);
            return {
                contents: JSON.stringify(parsed),
                loader: 'json',
            };
        });
    },
};

async function buildServer() {
    try {
        await esbuild.build({
            entryPoints: ['server/index.ts'],
            outfile: 'build/index.cjs',
            platform: 'node',
            target: 'node22',
            format: 'cjs',
            bundle: true,
            plugins: [jsoncPlugin],
            external: ['lightningcss', 'esbuild'],
            define: {
                'process.env.NODE_ENV': '"production"',
            },
        });
        console.log('Server build completed successfully');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

buildServer();
