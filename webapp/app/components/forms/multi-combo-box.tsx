import * as React from 'react';
import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { Cross1Icon, ArrowDownIcon, PlusIcon, TargetIcon, QuoteIcon, ChevronDownIcon, BookmarkFilledIcon } from '@radix-ui/react-icons';

import { commaSeparatedStringToArray } from '~/util/misc';

type Props = {
    name: string;
    options: Option[];
    defaultValue: string | undefined | null;
    onChange: (options: Option[]) => void;
    onRemove: (options: Option[], removedOption: Option) => void;
};

export type Option = string;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

// Separate component for selected items to prevent re-renders of the entire combobox
const SelectedItems = memo(({ selected, name, onRemove }: { selected: Option[]; name: string; onRemove: (option: Option) => void }) => {
    if (selected.length === 0) return null;

    // Event delegation handler
    const handleClick = (e: React.MouseEvent) => {
        // Look for closest button element from click target
        const button = (e.target as HTMLElement).closest('[data-remove-option]');
        if (button) {
            const option = button.getAttribute('data-remove-option');
            if (option) onRemove(option);
        }
    };

    return (
        <ul className="mb-2 flex flex-wrap border-b border-gray-800 py-2" onClick={handleClick}>
            {selected.map((option: Option, index) => (
                <li
                    key={`${name}-${option}-${index}`}
                    className="group relative mb-1 mr-1 flex items-center items-stretch whitespace-nowrap rounded rounded-full bg-primary-dark p-1 px-2 text-xs text-white">
                    <span>{option}</span>
                    <span
                        title={`Remove ${option}`}
                        data-remove-option={option}
                        className="inset-0 flex cursor-pointer content-center items-center justify-center justify-items-center justify-items-stretch justify-self-center rounded rounded-full">
                        <Cross1Icon className="m-auto ml-1 h-3 w-3 hover:text-semantic-error-dark" aria-label={`Remove ${option}`} />
                    </span>
                </li>
            ))}
        </ul>
    );
});

export const MultiComboBox: React.FC<Props> = memo(({ ...props }) => {
    const [selected, setSelected] = useState<Option[]>(props.defaultValue ? commaSeparatedStringToArray(props.defaultValue) : []);
    const [query, setQuery] = useState('');

    useEffect(() => {
        setSelected(props.defaultValue ? commaSeparatedStringToArray(props.defaultValue) : []);
    }, [props.defaultValue]);

    const handleChange = useCallback(
        (selectedOptions: Option[]) => {
            setSelected(selectedOptions);
            setQuery('');
            props.onChange(selectedOptions);
        },
        [props.onChange],
    );

    const handleRemove = useCallback(
        (option: Option) => {
            setSelected((selected) => {
                const newSelected = selected.filter((selectedItem) => selectedItem !== option);
                props.onRemove(newSelected, option);
                return newSelected;
            });
        },
        [props.onChange],
    );

    // Memoize filtered items
    const filteredItems = useMemo(
        () => (query === '' ? props.options : props.options?.filter((item) => item.toLowerCase().includes(query.toLowerCase()))),
        [query, props.options],
    );

    // Memoize unselected items
    const unSelectedItems = useMemo(() => filteredItems?.filter((item) => !selected.includes(item)) || [], [filteredItems, selected]);

    return (
        <div className="rounded rounded-lg border border-gray-800 bg-black/40 p-2">
            <SelectedItems selected={selected} name={props.name} onRemove={handleRemove} />

            <Combobox value={selected} onChange={handleChange} multiple>
                {({ value }) => (
                    <>
                        {/* We're doing the renderprop method because the alternative creates a horrid hidden input naming convention which is just overkill
                        https://headlessui.com/react/combobox#using-with-html-forms  */}

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
                                {query.length > 0 && !unSelectedItems.includes(query) && (
                                    <ComboboxOption
                                        value={query}
                                        className="flex items-center p-1 text-left text-white hover:bg-primary-dark/30 data-[focus]:bg-primary-dark/30">
                                        <PlusIcon className="mr-1 text-white" /> Add <span className="font-bold">"{query}"</span>
                                    </ComboboxOption>
                                )}
                                {unSelectedItems.length > 0 &&
                                    unSelectedItems
                                        .filter((option) => option.length > 0)
                                        .map((option, index) => (
                                            <ComboboxOption
                                                key={`${option}-${index}`}
                                                value={option}
                                                className="flex items-center p-1 text-left text-white hover:bg-primary-dark/30 data-[focus]:bg-primary-dark/30">
                                                <BookmarkFilledIcon className="mr-1 text-primary" />
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
});

// Add display name for debugging
MultiComboBox.displayName = 'MultiComboBox';
