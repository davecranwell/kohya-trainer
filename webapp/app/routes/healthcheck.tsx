import { data } from 'react-router'; // or cloudflare/deno
import type { MetaFunction } from 'react-router';
import { type LoaderFunctionArgs } from 'react-router';

import prisma from '../../prisma/db.server';

export async function loader({ request }: LoaderFunctionArgs) {
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
        console.error(error);
        return data({ error: 'Database connection failed' }, { status: 200 });
    }

    return { message: 'OK' };
}
