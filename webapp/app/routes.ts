import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';
// import { flatRoutes } from '@react-router/fs-routes';
// import { remixRoutesOptionAdapter } from '@react-router/remix-routes-option-adapter';

// export default flatRoutes() satisfies RouteConfig;

export default [
    index('./routes/_index.tsx'),
    ...prefix('training', [
        index('./routes/training.tsx'),
        layout('./routes/training_.$id.tsx', [route('/:id', './routes/training_.$id_.upload.tsx')]),
    ]),
    route('/logout', './routes/logout.tsx'),
    route('/login', './routes/login.tsx'),
    route('/sign-up', './routes/sign-up.tsx'),
    // route('/training/:id', 'training.tsx', {
    //     children: [route('/', 'training_.$id.tsx'), route('/upload', 'training_.$id.upload.tsx')],
    // }),
] satisfies RouteConfig;
