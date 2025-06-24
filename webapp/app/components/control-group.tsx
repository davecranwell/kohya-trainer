export const ControlGroup = ({ children, heading }: { children: React.ReactNode; heading: string }) => {
    return (
        <div className="flex flex-none items-center gap-4 py-4">
            <h3 className="text-sm font-medium uppercase">{heading}</h3>
            {children}
        </div>
    );
};
