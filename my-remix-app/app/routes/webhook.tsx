import crypto from 'crypto';
import { type ActionFunctionArgs, json } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
    const signature = request.headers.get('x-webhook-signature');
    const payload = JSON.stringify(request.body);

    // Compute HMAC to verify
    const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET!);
    const computedSignature = hmac.update(payload).digest('hex');

    if (signature !== computedSignature) {
        return json({ error: 'Forbidden' }, { status: 403 });
    }

    // Conditions in which hooks are sent:
    // 1. Image upload is complete - no progress data
    // 2. Model is downloaded - no progress data
    // 3. Training is any percentage complete - returns a progress percentage
    // 4. Training is complete (most successful model is uploaded to S3)
}
