import prisma from '~/services/db.server';

import { createPassword } from './db-utils';

async function seed() {
    console.log('🌱 Seeding...');

    console.log('🔑 Creating permissions...');
    const entities = ['user', 'training'];
    const actions = ['create', 'read', 'update', 'delete'];
    const accesses = ['own', 'any'] as const;

    let permissionsToCreate = [];
    for (const entity of entities) {
        for (const action of actions) {
            for (const access of accesses) {
                permissionsToCreate.push({ entity, action, access });
            }
        }
    }
    await prisma.permission.createMany({ data: permissionsToCreate });
    console.log('🔑 Created permissions');

    console.log('👑 Creating roles...');
    await prisma.role.create({
        data: {
            name: 'admin',
            permissions: {
                connect: await prisma.permission.findMany({
                    select: { id: true },
                    // NB: "any" does not trump "own" so an admin needs to have both explicitly
                    where: { OR: [{ access: 'any' }, { access: 'own' }] },
                }),
            },
        },
    });
    await prisma.role.create({
        data: {
            name: 'user',
            permissions: {
                connect: await prisma.permission.findMany({
                    select: { id: true },
                    where: { access: 'own' },
                }),
            },
        },
    });
    console.log('👑 Created roles');

    console.log(`👤 Creating users...`);
    await prisma.user.create({
        data: {
            email: 'dave@davecranwell.com',
            password: { create: createPassword('password') },
            name: 'Dave Cranwell',
            roles: { connect: [{ name: 'admin' }] },
        },
    });
    console.log(`👤 Created users`);

    console.log(`🌱 Database has been seeded`);
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
