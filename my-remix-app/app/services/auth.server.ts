import { Authenticator } from 'remix-auth';
import { FormStrategy } from 'remix-auth-form';

import { sessionStorage } from '~/services/session.server';

type User = {
    id: string;
    email: string;
};

// Create an instance of the authenticator, pass a generic with what
// strategies will return and will store in the session
export const authenticator = new Authenticator<User>(sessionStorage);

authenticator.use(
    new FormStrategy(async ({ form, context }) => {
        // Here you can use `form` to access and input values from the form.
        // and also use `context` to access more things from the server
        let email = form.get('email');
        let password = form.get('password');

        // You can validate the inputs however you want
        invariant(typeof email === 'string', 'username must be a string');
        invariant(email.length > 0, 'username must not be empty');

        invariant(typeof password === 'string', 'password must be a string');
        invariant(password.length > 0, 'password must not be empty');

        // And if you have a password you should hash it
        let hashedPassword = await hash(password);

        // And finally, you can find, or create, the user
        let user = await findOrCreateUser(email, hashedPassword);

        // And return the user as the Authenticator expects it
        return user;
    }),
);

// // get the user data or redirect to /login if it failed
// let user = await authenticator.isAuthenticated(request, {
//   failureRedirect: "/login",
// });

// // if the user is authenticated, redirect to /dashboard
// await authenticator.isAuthenticated(request, {
//   successRedirect: "/dashboard",
// });

// // get the user or null, and do different things in your loader/action based on
// // the result
// let user = await authenticator.isAuthenticated(request);
// if (user) {
//   // here the user is authenticated
// } else {
//   // here the user is not authenticated
// }
