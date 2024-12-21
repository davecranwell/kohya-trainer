import fs from 'node:fs';
import { type PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export function createPassword(password: string) {
    return {
        hash: bcrypt.hashSync(password, 10),
    };
}

export async function cleanupDb(prisma: PrismaClient) {
    const tables = await prisma.$queryRaw<
        { name: string }[]
    >`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations';`;

    try {
        // Disable FK constraints to avoid relation conflicts during deletion
        await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);
        await prisma.$transaction([
            // Delete all rows from each table, preserving table structures
            ...tables.map(({ name }) => prisma.$executeRawUnsafe(`DELETE from "${name}"`)),
        ]);
    } catch (error) {
        console.error('Error cleaning up database:', error);
    } finally {
        await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
    }
}
