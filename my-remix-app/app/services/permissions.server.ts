import { json } from '@remix-run/node';

import { authenticator } from './auth.server';
import prisma from './db.server';
import { type PermissionString, parsePermissionString } from './user.server';

export async function requireUserWithPermission(request: Request, permission: PermissionString) {
    const authenticatedUser = await authenticator.isAuthenticated(request, {
        failureRedirect: '/login',
    });

    const permissionData = parsePermissionString(permission);

    const user = await prisma.user.findFirst({
        select: { id: true },
        where: {
            id: authenticatedUser.id,
            roles: {
                some: {
                    permissions: {
                        some: {
                            ...permissionData,
                            access: permissionData.access ? { in: permissionData.access } : undefined,
                        },
                    },
                },
            },
        },
    });

    if (!user) {
        throw json(`Unauthorized`, { status: 403 });
    }

    return user.id;
}

export async function requireUserWithRole(request: Request, name: string) {
    const { id: userId } = await authenticator.isAuthenticated(request, {
        failureRedirect: '/login',
    });

    const user = await prisma.user.findFirst({
        select: { id: true },
        where: { id: userId, roles: { some: { name } } },
    });

    if (!user) {
        throw json(
            {
                error: 'Unauthorized',
                requiredRole: name,
                message: `Unauthorized: required role: ${name}`,
            },
            { status: 403 },
        );
    }

    return user.id;
}
