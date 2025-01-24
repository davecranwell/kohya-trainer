import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => {
    return [{ title: 'Hi' }, { name: 'description', content: 'And welcome' }];
};

export default function Index() {
    return <div>hi test</div>;
}
