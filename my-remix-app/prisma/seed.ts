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
    console.log('🔑 Created permissions...');

    console.log('👑 Creating roles...');
    await prisma.role.create({
        data: {
            name: 'admin',
            permissions: {
                connect: await prisma.permission.findMany({
                    select: { id: true },
                    where: { access: 'any' },
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
    console.log('👑 Created roles...');

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

    // const kodyImages = await promiseHash({
    // 	kodyUser: img({ filepath: './tests/fixtures/images/user/kody.png' }),
    // 	cuteKoala: img({
    // 		altText: 'an adorable koala cartoon illustration',
    // 		filepath: './tests/fixtures/images/kody-notes/cute-koala.png',
    // 	}),
    // 	koalaEating: img({
    // 		altText: 'a cartoon illustration of a koala in a tree eating',
    // 		filepath: './tests/fixtures/images/kody-notes/koala-eating.png',
    // 	}),
    // 	koalaCuddle: img({
    // 		altText: 'a cartoon illustration of koalas cuddling',
    // 		filepath: './tests/fixtures/images/kody-notes/koala-cuddle.png',
    // 	}),
    // 	mountain: img({
    // 		altText: 'a beautiful mountain covered in snow',
    // 		filepath: './tests/fixtures/images/kody-notes/mountain.png',
    // 	}),
    // 	koalaCoder: img({
    // 		altText: 'a koala coding at the computer',
    // 		filepath: './tests/fixtures/images/kody-notes/koala-coder.png',
    // 	}),
    // 	koalaMentor: img({
    // 		altText:
    // 			'a koala in a friendly and helpful posture. The Koala is standing next to and teaching a woman who is coding on a computer and shows positive signs of learning and understanding what is being explained.',
    // 		filepath: './tests/fixtures/images/kody-notes/koala-mentor.png',
    // 	}),
    // 	koalaSoccer: img({
    // 		altText: 'a cute cartoon koala kicking a soccer ball on a soccer field ',
    // 		filepath: './tests/fixtures/images/kody-notes/koala-soccer.png',
    // 	}),
    // })

    // const githubUser = await insertGitHubUser(MOCK_CODE_GITHUB)

    // await prisma.user.create({
    // 	select: { id: true },
    // 	data: {
    // 		email: 'kody@kcd.dev',
    // 		username: 'kody',
    // 		name: 'Kody',
    // 		image: { create: kodyImages.kodyUser },
    // 		password: { create: createPassword('kodylovesyou') },
    // 		connections: {
    // 			create: { providerName: 'github', providerId: githubUser.profile.id },
    // 		},
    // 		roles: { connect: [{ name: 'admin' }, { name: 'user' }] },
    // 		notes: {
    // 			create: [
    // 				{
    // 					id: 'd27a197e',
    // 					title: 'Basic Koala Facts',
    // 					content:
    // 						'Koalas are found in the eucalyptus forests of eastern Australia. They have grey fur with a cream-coloured chest, and strong, clawed feet, perfect for living in the branches of trees!',
    // 					images: { create: [kodyImages.cuteKoala, kodyImages.koalaEating] },
    // 				},
    // 			],
    // 		},
    // 	},
    // })
    // console.log(`🐨 Created admin user "kody"`)

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
