import { json } from '@remix-run/node'; // or cloudflare/deno
import type { MetaFunction } from '@remix-run/node';
import { type LoaderFunctionArgs } from '@remix-run/node';

import prisma from '../services/db.server';

export async function loader({ request }: LoaderFunctionArgs) {
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
        console.error(error);
        return json({ error: 'Database connection failed' }, { status: 200 });
    }

    return json({ message: 'OK' });
}
