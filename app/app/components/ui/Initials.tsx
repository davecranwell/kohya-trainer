import React from 'react';

interface InitialsProps {
    name: string;
}

const Initials: React.FC<InitialsProps> = ({ name }) => {
    const initials = name
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase())
        .join('');

    return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-500 text-white">{initials}</div>;
};

export default Initials;
