import bcrypt from 'bcryptjs';

import prisma from '#/prisma/db.server';

import { getSessionExpirationDate } from '~/services/session.server';

import type { User } from './auth.server';

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
};

export const createAccount = async (data: { email: string; name?: string; password?: string }) => {
    const result = await prisma.user.findFirst({ where: { email: data.email } });

    if (result) {
        throw new Error('An account with this email already exists');
    }

    const newUser = {
        name: data.name || undefined,
        email: data.email,
        createdAt: new Date(),
        roles: {
            connect: {
                name: 'user',
            },
        },
        // An empty password is allowed for provider users whos password we don't know
        ...(data?.password &&
            data.password.length > 0 && {
                password: {
                    create: {
                        hash: await hashPassword(data.password),
                    },
                },
            }),
    };

    const user = await prisma.user.create({ data: newUser, select: { id: true } });

    if (!user || !user.id) {
        throw new Error('Unable to register a new user');
    }

    return user;
};

export const findAccountByEmail = async (email: string) => {
    const result = await prisma.user.findFirst({ where: { email } });

    return result;
};

// export async function login(email: string, password: string) {
//     const user = await verifyEmailPassword(email, password);

//     if (!user) throw new Error('Invalid email or password');

//     const session = await prisma.session.create({
//         select: { id: true, expirationDate: true, userId: true },
//         data: {
//             expirationDate: getSessionExpirationDate(),
//             userId: user.id,
//         },
//     });

//     return session;
// }

export async function verifyEmailPassword(email: string, password: string): Promise<Omit<User, 'password'>> {
    const userWithPassword = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, password: { select: { hash: true } } },
    });

    if (!userWithPassword || !userWithPassword.password) {
        throw new Error('No user found with those credentials');
    }

    const isValid = await bcrypt.compare(password, userWithPassword.password.hash);

    if (!isValid) {
        throw new Error('No user found with those credentials');
    }

    return { id: userWithPassword.id } as User;
}

// Only used for provider users whos passwords we don't know
export async function findOrCreateProviderUser(data: { email: string; name: string }) {
    const user = await findAccountByEmail(data.email);

    if (user) {
        return user;
    }

    return await createAccount({ email: data.email, name: data.name });
}
