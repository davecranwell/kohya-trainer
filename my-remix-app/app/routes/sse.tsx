import { LoaderFunction } from '@remix-run/node';
import { eventStream } from "remix-utils/sse/server";

import { emitter } from "~/utils/emitter.server";

export const loader:LoaderFunction = async ({ request }) => {
  return eventStream(request.signal, function setup(send) {
    const handleMessage = (message: string) => {
      send({ event: "progress", data: message });
    };

    emitter.on("progress", handleMessage);

    return () => {
      emitter.off("progress", handleMessage);
    };
  });
}