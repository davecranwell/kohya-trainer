import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';
// import { flatRoutes } from '@react-router/fs-routes';
// import { remixRoutesOptionAdapter } from '@react-router/remix-routes-option-adapter';

// export default flatRoutes() satisfies RouteConfig;

export default [
    index('./routes/_index.tsx'),
    route('/training', './routes/training.tsx'),
    route('/training/new', './routes/training_.new.tsx'),
    route('/training/:id/', './routes/training_.$id.tsx', [
        index('./routes/training_.$id_.upload.tsx'),
        route('imagegroup/:groupId', './routes/training_.$id_.imagegroup.$groupId.tsx'),
    ]),

    route('/training/:id/createimagegroup', './routes/training_.$id.createimagegroup.tsx'),
    route('/logout', './routes/logout.tsx'),
    route('/login', './routes/login.tsx'),
    route('/sign-up', './routes/sign-up.tsx'),
    route('/api/training', './routes/api.training.tsx'),
    route('/api/trainingimage/:id', './routes/api.trainingimage.$id.tsx'),
    route('/api/uploadurls/:id', './routes/api.uploadurls.$id.tsx'),
    // route('/training/:id', 'training.tsx', {
    //     children: [route('/', 'training_.$id.tsx'), route('/upload', 'training_.$id.upload.tsx')],
    // }),
] satisfies RouteConfig;
