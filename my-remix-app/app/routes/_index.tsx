import type { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
    return [{ title: 'Hi' }, { name: 'description', content: 'And welcome' }];
};

export default function Index() {
    return <div>hi2</div>;
}
