import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireUserId } from '#app/utils/auth.server.ts';
import { TrainingEditor } from './__training-editor.tsx';

export { action } from './__training-editor.server.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
    await requireUserId(request);
    return json({});
}

export default TrainingEditor;
