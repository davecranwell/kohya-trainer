import * as React from 'react';
import { useEffect, useState } from 'react';
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { Cross1Icon, ArrowDownIcon, PlusIcon } from '@radix-ui/react-icons';

import { commaSeparatedStringToArray } from '~/util/misc';

type Props = {
    name: string;
    options: Option[];
    defaultValue: string | undefined | null;
    onChange: (options: Option[]) => void;
};

export type Option = string;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const MultiComboBox: React.FC<Props> = ({ ...props }) => {
    const [selected, setSelected] = useState<Option[]>(props.defaultValue ? commaSeparatedStringToArray(props.defaultValue) : []);
    const [query, setQuery] = useState('');

    useEffect(() => {
        setSelected(props.defaultValue ? commaSeparatedStringToArray(props.defaultValue) : []);
    }, [props.defaultValue]);

    const handleChange = (selectedOptions: Option[]) => {
        setSelected(selectedOptions);
        setQuery('');
        props.onChange(selectedOptions);
    };

    const handleRemove = (option: Option) => {
        setSelected((selected) => selected.filter((selectedItem) => selectedItem !== option));
        props.onChange(selected.filter((selectedItem) => selectedItem !== option));
    };

    // Filter the items by the active query
    const filteredItems = query === '' ? props.options : props.options?.filter((item) => item.toLowerCase().includes(query.toLowerCase()));

    // Then we want to remove the items we've already selected
    const unSelectedItems = filteredItems?.filter((item) => !selected.find((selected) => item === selected)) || [];

    return (
        <div className="rounded bg-white p-2">
            {selected.length > 0 && (
                <ul className="flex flex-wrap">
                    {selected.map((option: Option, index) => (
                        <li
                            key={`${props.name}-${option}-${index}`}
                            className="group relative mb-1 mr-1 flex items-center items-stretch whitespace-nowrap rounded bg-gray-200 p-1 text-xs hover:bg-gray-300">
                            <span>{option}</span>
                            <span
                                title={`Remove ${option}`}
                                onClick={() => handleRemove(option)}
                                className="absolute inset-0 flex hidden w-full cursor-pointer content-center items-center justify-center justify-items-center justify-items-stretch justify-self-center rounded bg-gray-300 opacity-90 group-hover:block">
                                <Cross1Icon className="text-primary m-auto group-hover:text-red-600" aria-label={`Remove ${option}`} />
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <Combobox value={selected} onChange={handleChange} multiple>
                {({ value }) => (
                    <>
                        {/* We're doing the renderprop method because the alternative creates a horrid hidden input naming convention which is just overkill
                        https://headlessui.com/react/combobox#using-with-html-forms  */}

                        <input type="hidden" name={props.name} value={value} />
                        <div className="dropdown w-full">
                            <div>
                                <div className="relative w-full">
                                    <ComboboxInput
                                        placeholder="Choose tags or type to add new ones"
                                        value={query}
                                        onChange={(event) => {
                                            setQuery(event.target.value);
                                        }}
                                        className="focus:ring-primary block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset sm:max-w-xs sm:text-sm sm:leading-6"
                                    />
                                    <ComboboxButton className="absolute inset-y-0 right-0 z-0 flex w-8 items-center">
                                        <ArrowDownIcon className="text-gray-500" />
                                    </ComboboxButton>
                                </div>
                            </div>

                            <ComboboxOptions className="dropdown-content absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                {query.length > 0 && (
                                    <ComboboxOption value={query} className="flex p-1 data-[focus]:bg-blue-100">
                                        <PlusIcon className="mr-1 text-gray-500" /> Add <span className="font-bold">"{query}"</span>
                                    </ComboboxOption>
                                )}
                                {unSelectedItems.length > 0 &&
                                    unSelectedItems.map((option, index) => (
                                        <ComboboxOption key={`${option}-${index}`} value={option} className="p-1 text-left data-[focus]:bg-blue-100">
                                            {option}
                                        </ComboboxOption>
                                    ))}
                            </ComboboxOptions>
                        </div>
                    </>
                )}
            </Combobox>
        </div>
    );
};
