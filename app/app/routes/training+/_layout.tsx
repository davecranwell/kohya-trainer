import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { NavLink, Outlet, useLoaderData } from '@remix-run/react';

import { prisma } from '#app/utils/db.server.ts';
import { requireUserWithPermission } from '#app/utils/permissions.server.ts';

export const handle = {
    pageHeading: 'Training',
};

// export async function loader({ request }: LoaderFunctionArgs) {
//     const userId = await requireUserWithPermission(request, 'create:training:own');

//     const trainings = await prisma.training.findMany({
//         select: {
//             id: true,
//             name: true,
//         },
//         where: {
//             ownerId: userId,
//         },
//     });

//     return json({ trainings });
// }

export default function TrainingPage() {
    // const data = useLoaderData<typeof loader>();

    return (
        <div>
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <section aria-labelledby="products-heading" className="pb-24 pt-6">
                    <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">
                        <div className="lg:block">
                            {/* <NavLink
                                to="/training/new"
                                className="flex items-center justify-center rounded-md border border-transparent bg-primary px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700">
                                New training
                            </NavLink> */}
                        </div>

                        <div className="lg:col-span-3">
                            <Outlet />
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
