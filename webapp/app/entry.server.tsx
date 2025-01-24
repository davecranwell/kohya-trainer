import { PassThrough } from 'node:stream';
import type { AppLoadContext, EntryContext, HandleDocumentRequestFunction } from '@remix-run/node';
import { createReadableStreamFromReadable } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { renderToPipeableStream } from 'react-dom/server';
import { isbot } from 'isbot';

import { NonceProvider } from './util/nonce.provider';

const streamTimeout = 5_000;

export default async function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext,
    loadContext: AppLoadContext,
) {
    const callbackName = isbot(request.headers.get('user-agent')) ? 'onAllReady' : 'onShellReady';

    const nonce = loadContext.cspNonce?.toString() ?? '';

    return new Promise(async (resolve, reject) => {
        let shellRendered = false;

        const { pipe, abort } = renderToPipeableStream(
            <NonceProvider value={nonce}>
                <RemixServer nonce={nonce} context={remixContext} url={request.url} />
            </NonceProvider>,
            {
                [callbackName]: () => {
                    shellRendered = true;
                    const body = new PassThrough();
                    const stream = createReadableStreamFromReadable(body);

                    responseHeaders.set('Content-Type', 'text/html');

                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: responseStatusCode,
                        }),
                    );
                    pipe(body);
                },
                onShellError(error: unknown) {
                    reject(error);
                },
                onError(error: unknown) {
                    responseStatusCode = 500;
                    // Log streaming rendering errors from inside the shell.  Don't log
                    // errors encountered during initial shell rendering since they'll
                    // reject and get logged in handleDocumentRequest.
                    if (shellRendered) {
                        console.error(error);
                    }
                },
                nonce,
            },
        );

        setTimeout(abort, streamTimeout + 1000);
    });
}
