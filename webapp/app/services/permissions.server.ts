import { data } from 'react-router';

import { authenticator, requireAuthenticated } from './auth.server';
import prisma from '../../prisma/db.server';
import { type PermissionString, parsePermissionString } from './user.server';

export async function requireUserWithPermission(request: Request, permission: PermissionString) {
    const authenticatedUser = await requireAuthenticated(request);

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
        throw data(`Unauthorized`, { status: 403 });
    }

    return user.id;
}

export async function requireUserWithRole(request: Request, name: string) {
    const { id: userId } = await requireAuthenticated(request);

    const user = await prisma.user.findFirst({
        select: { id: true },
        where: { id: userId, roles: { some: { name } } },
    });

    if (!user) {
        throw data(
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
