import { Training as PrismaTraining } from '@prisma/client';

export type BaseModel = {
    id: string;
    name: string;
    url: string;
    filename: string;
    type: string;
};

export type Training = PrismaTraining & {
    baseModel: BaseModel;
};
