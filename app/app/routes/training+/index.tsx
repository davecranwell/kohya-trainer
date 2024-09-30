import { type LoaderFunctionArgs } from '@remix-run/node';
import { requireUserWithPermission } from '#app/utils/permissions.server.ts';

export async function loader({ request, params }: LoaderFunctionArgs) {
    await requireUserWithPermission(request, 'create:training:own');
    return null;
}

export default function TrainingRoute() {
    return <div>chooooooose</div>;
}
