import * as React from 'react';
import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { ChevronDownIcon, PlusIcon } from '@radix-ui/react-icons';

type Props = {
    name: string;
    defaultValue: string | undefined;
    onChange: (model: string) => void;
};

type Model = {
    id: string;
    name: string;
};

export const MultiComboBoxCivitai: React.FC<Props> = memo(({ ...props }) => {
    const [selected, setSelected] = useState<string | undefined>(props.defaultValue);
    const [query, setQuery] = useState('');
    const [models, setModels] = useState<Model[]>([]);

    useEffect(() => {
        const fetchModels = async () => {
            const response = await fetch('https://civitai.com/api/v1/models?limit=100&sort=Most Downloaded&nsfw=false');
            const data = await response.json();

            console.log(data.items);
            setModels(data.items);
        };
        fetchModels();
    }, [query]);

    const handleChange = (model: any) => {
        setSelected(model);
        props.onChange(model);
    };

    return (
        <div className="rounded rounded-lg border border-gray-800 bg-black/40 p-2">
            <Combobox value={selected} onChange={handleChange}>
                {({ value }) => (
                    <>
                        <input type="hidden" name={props.name} value={value} />
                        <div className="dropdown relative w-full">
                            <ComboboxInput
                                placeholder="Choose or type"
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                }}
                                className="block w-full rounded-md border-0 bg-transparent py-1.5 text-white focus:ring-primary"
                            />
                            <ComboboxButton className="absolute inset-y-0 right-0 z-0 flex w-8 items-center justify-center">
                                <ChevronDownIcon className="text-gray-500" />
                            </ComboboxButton>

                            <ComboboxOptions
                                className="dropdown-content absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-black py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                                onClick={(e: React.MouseEvent) => {
                                    // Prevent re-opening of dropdown when clicking option
                                    e.stopPropagation();
                                }}>
                                {query.length > 0 && (
                                    <ComboboxOption
                                        value={query}
                                        className="flex items-center p-1 text-left text-white hover:bg-primary-dark/30 data-[focus]:bg-primary-dark/30">
                                        <PlusIcon className="mr-1 text-white" /> Add <span className="font-bold">"{query}"</span>
                                    </ComboboxOption>
                                )}
                                {models.map((model: any) => (
                                    <ComboboxOption
                                        key={model.id}
                                        value={model.name}
                                        className="flex items-center p-1 text-left text-white hover:bg-primary-dark/30 data-[focus]:bg-primary-dark/30">
                                        <img
                                            src={model.modelVersions[0]?.images[0]?.url}
                                            alt={model.name}
                                            className="h-[100px] w-[100px] rounded-lg object-cover"
                                        />
                                        {model.name}
                                    </ComboboxOption>
                                ))}
                            </ComboboxOptions>
                        </div>
                    </>
                )}
            </Combobox>
        </div>
    );
});

// Add display name for debugging
MultiComboBoxCivitai.displayName = 'MultiComboBoxCivitai';
