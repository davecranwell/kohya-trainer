import { CheckCircledIcon, CheckIcon, SymbolIcon } from '@radix-ui/react-icons';

export default function Progress() {
    return (
        <div className="w-full py-4 sm:py-0">
            <div className="relative">
                <div className="z-1 absolute left-0 top-4 h-0.5 w-full -translate-y-1/2 bg-gray-800">
                    <div className="bg-grey-700 h-full w-full transition-all duration-300"></div>
                </div>
                <div className="z-2 relative flex w-full items-center justify-between">
                    <div className="flex flex-col items-center">
                        <div className="bg-semantic-success flex h-8 w-8 items-center justify-center rounded-full text-white">
                            <CheckIcon />
                        </div>
                        <span className="text-semantic-success absolute -bottom-6 whitespace-nowrap text-xs">Image upload</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="bg-semantic-success flex h-8 w-8 items-center justify-center rounded-full text-white">
                            <CheckIcon />
                        </div>
                        <span className="text-semantic-success absolute -bottom-6 whitespace-nowrap text-xs">Training setup</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 animate-bounce items-center justify-center rounded-full bg-primary text-white">
                            <SymbolIcon className="animate-spin" />
                        </div>
                        <span className="absolute -bottom-6 whitespace-nowrap text-xs text-primary">Training</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-800 bg-black">
                            <span className="text-sm">4</span>
                        </div>
                        <span className="absolute -bottom-6 whitespace-nowrap text-xs">Ready!</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
