import { Link, type MetaFunction } from 'react-router';
import { ArrowRightIcon } from '@radix-ui/react-icons';

export const meta: MetaFunction = () => {
    return [{ title: 'Hi' }, { name: 'description', content: 'And welcome' }];
};

export default function Index() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="space-y-8 text-center">
                <div>
                    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/20 via-accent1/20 to-accent2/20 blur-3xl" />
                    <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
                        <span className="bg-gradient-to-r from-primary via-accent1 to-accent2 bg-clip-text text-transparent">Likera</span>
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-gray-300">Likeness LoRas without the hassle.</p>
                </div>

                <div className="flex flex-col items-center justify-center gap-4 pt-8 sm:flex-row">
                    <Link to="/training">
                        <button className="group flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-lg font-medium text-white transition-all duration-300 hover:bg-primary-dark">
                            Get Started
                            <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
