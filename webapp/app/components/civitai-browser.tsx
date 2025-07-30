import * as React from 'react';
import { useState } from 'react';
import { Dialog, DialogPanel, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronDownIcon, ExternalLinkIcon, UpdateIcon } from '@radix-ui/react-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';

import { Button } from './button';
import { Container } from './container';
import { Input } from './forms/input';

const getModels = async (baseModels: string[], search: string) => {
    try {
        const response = await fetch(
            `https://civitai.com/api/v1/models?types=Checkpoint&sort=Highest%20Rated&nsfw=true&baseModels=${baseModels.map((model) => encodeURIComponent(model)).join(',')}&query=${search}`,
        );

        const data = await response.json();
        return data;
    } catch (error) {
        // catch preflight errors - regular status code errors are returned in the try block
        throw new Error(`Failed to retrieve Civitai models. If you are in the UK this may be due to Civitai's block on UK IP addresses`);
    }
};

const Model = ({
    model,
    as: Component = 'li',
    supported,
    onSelect,
    ...props
}: {
    model: any;
    as: React.ElementType;
    supported: string[];
    onSelect: (version: any) => void;
    [key: string]: any;
}) => {
    const baseModels = new Set(model?.modelVersions.map((version: any) => version.baseModel));
    const baseModelsUnique = [...baseModels] as string[];
    const baseModelsSupported = baseModelsUnique.filter((baseModel) => supported.includes(baseModel));
    const isSupported = baseModelsUnique.some((baseModel: string) => supported.includes(baseModel));
    const [selectedVersion, setSelectedVersion] = useState({ ...model?.modelVersions[0], originalModelName: model.name });

    if (!isSupported) return null;

    const handleSelectVersion = (version: any) => {
        // we need to tag the original model name to the version, so when we pass the version to the onSelect function, we can use it to get the original model name
        setSelectedVersion({ ...version, originalModelName: model.name });
    };

    return (
        <Component {...props}>
            <div className="flex grow-0 flex-col rounded-lg border border-gray-800 bg-gray-900 transition hover:border-primary-dark hover:bg-gray-800">
                <div className="flex h-[300px] w-[248px] justify-center rounded-lg">
                    {model?.modelVersions[0]?.images[0]?.type === 'image' ? (
                        <img
                            src={model?.modelVersions[0]?.images[0]?.url}
                            alt={model.name}
                            className="h-[300px] w-[249px] rounded-t-lg object-cover"
                        />
                    ) : (
                        <video
                            disablePictureInPicture
                            autoPlay
                            playsInline
                            loop
                            muted
                            className="rounded-t-lg object-cover"
                            poster={model?.modelVersions[0]?.images[0]?.url}
                            src={model?.modelVersions[0]?.images[0]?.url}
                        />
                    )}
                </div>
                <div className="space-y-4 p-4">
                    <h2 className="flex flex-row items-center gap-2 text-white">
                        <div className="flex-1 truncate">{model.name}</div>
                        <a href={`https://civitai.com/models/${model.id}`} target="_blank" className="flex-0 text-accent2">
                            <ExternalLinkIcon className="h-[16px] w-[16px]" />
                        </a>
                    </h2>
                    <div>
                        {baseModelsSupported.map((baseModel: string) => {
                            return (
                                <span key={baseModel} className="mr-1 inline-block items-center rounded-full bg-accent1 px-2 py-1 leading-none">
                                    <span className="items-center text-xs text-gray-900">{baseModel}</span>
                                </span>
                            );
                        })}
                    </div>
                    <div className="relative">
                        {isSupported && (
                            <div className="flex flex-col items-center justify-between gap-2">
                                <Listbox onChange={handleSelectVersion}>
                                    <ListboxButton className="flex max-h-60 w-full flex-row items-center justify-between overflow-auto truncate rounded-lg border border-gray-800 bg-black/40 px-3 py-3 text-xs text-white ring-1 ring-black ring-opacity-5 focus:ring-primary">
                                        {selectedVersion.name}
                                        {model?.modelVersions.length > 1 && <ChevronDownIcon className="text-gray-500" />}
                                    </ListboxButton>
                                    {model?.modelVersions.length > 1 && (
                                        <ListboxOptions
                                            anchor="bottom"
                                            className="w-[var(--button-width)] rounded-md bg-black py-1 shadow-lg ring-1 ring-black ring-opacity-5 transition duration-100 ease-in focus:outline-none data-[leave]:data-[closed]:opacity-0 sm:text-sm">
                                            {model?.modelVersions
                                                .filter((version: any) => supported.includes(version.baseModel))
                                                .map((version: any) => (
                                                    <ListboxOption
                                                        key={`${model.id}-${version.id}`}
                                                        value={version}
                                                        className="flex items-center p-2 text-left text-xs text-white hover:bg-primary-dark/30 data-[focus]:bg-primary-dark/30">
                                                        {version.name} {baseModelsSupported.length > 1 && `(${version.baseModel})`}
                                                    </ListboxOption>
                                                ))}
                                        </ListboxOptions>
                                    )}
                                </Listbox>
                                <Button size="full" className="text-sm" onClick={() => onSelect(selectedVersion)}>
                                    Choose
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* </div> */}
        </Component>
    );
};

export function CivitaiBrowser({
    onSelect,
    isOpen = false,
    setIsOpen,
    supportedModels = ['SDXL 1.0'],
}: {
    onSelect: (version: any) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    supportedModels: string[];
}) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounce(search, 1000);
    const { data, error, isLoading } = useQuery({
        queryKey: ['models', debouncedSearch],
        queryFn: () => getModels(supportedModels, debouncedSearch),
        placeholderData: (prev) => prev,
        enabled: isOpen,
    });

    const handleChooseModel = (version: any) => {
        onSelect(version);
        setIsOpen(false);
    };

    return (
        <>
            <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
                <div className="fixed inset-0 flex w-screen items-center justify-center">
                    <Container className="flex h-[80vh] max-h-[80vh] max-w-6xl self-center overflow-y-auto bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 shadow-2xl shadow-cyan-500/10">
                        <div className="flex min-h-full w-full">
                            <DialogPanel className="w-full">
                                {isLoading ? (
                                    <div className="flex h-full items-center justify-center">
                                        <UpdateIcon className="h-[20px] w-[20px] animate-spin" />
                                    </div>
                                ) : (
                                    <Input
                                        type="text"
                                        placeholder="Search"
                                        defaultValue={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="sticky"
                                    />
                                )}
                                {error ? (
                                    <div className="flex h-full items-center justify-center">
                                        <span className="text-gray-500">{error.message}</span>
                                    </div>
                                ) : (
                                    data?.items?.length < 1 && (
                                        <div className="flex h-full items-center justify-center">
                                            <span className="text-gray-500">No models found</span>
                                        </div>
                                    )
                                )}
                                <ul className="mt-4 flex w-full flex-row flex-wrap items-stretch">
                                    {!error &&
                                        data?.items.map((model) => (
                                            <Model
                                                key={model.id}
                                                model={model}
                                                as="li"
                                                supported={supportedModels}
                                                className="mb-4 mr-4 w-[250px] flex-1 grow-0"
                                                onSelect={handleChooseModel}
                                            />
                                        ))}
                                </ul>
                            </DialogPanel>
                        </div>
                    </Container>
                </div>
            </Dialog>
        </>
    );
}
