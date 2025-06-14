import * as React from 'react';

type HelpContextType = {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    help: React.ReactNode;
    setHelp: (help: React.ReactNode) => void;
    toggleHelp: () => void;
};

export const HelpContext = React.createContext<HelpContextType | null>(null);

export function HelpProvider({ children }: { children: React.ReactNode }) {
    // Move state management to the provider level
    const [isOpen, setIsOpen] = React.useState(false);
    const [help, setHelp] = React.useState<React.ReactNode>(null);

    const handleSetHelp = (newHelp: React.ReactNode) => {
        setHelp(newHelp);
        toggleHelp();
    };

    const toggleHelp = () => setIsOpen(!isOpen);

    const value = React.useMemo(
        () => ({
            isOpen,
            setIsOpen,
            help,
            setHelp: handleSetHelp,
            toggleHelp,
        }),
        [isOpen, help],
    );

    return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp() {
    const context = React.useContext(HelpContext);
    if (!context) {
        throw new Error('useHelp must be used within a HelpProvider');
    }
    return context;
}
