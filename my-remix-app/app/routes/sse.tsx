import { json, unstable_parseMultipartFormData, ActionFunctionArgs, LoaderFunction } from '@remix-run/node';
import { eventStream } from "remix-utils/sse/server";
import { emitter } from "~/utils/emitter.server"; // Import your event emitter

export const loader:LoaderFunction = async ({ request }) => {
  return eventStream(request.signal, function setup(send) {
    const handleMessage = (message: string) => {
      send({ event: "new-message", data: message });
    };

    emitter.on("message", handleMessage);

    return () => {
      emitter.off("message", handleMessage);
    };
  });
}