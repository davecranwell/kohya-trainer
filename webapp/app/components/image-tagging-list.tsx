import { useCallback, useMemo, useState, useEffect, useLayoutEffect, forwardRef } from 'react';
import { useDebounce } from 'use-debounce';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Grid, List, AutoSizer, CellMeasurer, CellMeasurerCache } from 'react-virtualized';
import { useHydrated } from 'remix-utils/use-hydrated';

import { useHelp } from '~/util/help.provider';
import { sanitiseTagArray } from '~/util/misc';

import { Button } from './button';
import { ImageWithMetadata } from './file-upload-preview';

export const ImageTaggingList = forwardRef(
    (
        {
            images,
            onImageTagsUpdated,
            thumbnailBucketUrl,
            RenderImage,
            windowWidth,
            imageWidth,
            cols = 1,
        }: {
            images: any[]; // todo go back to ImageWithMetadata[]
            onImageTagsUpdated: (imageId: string, sanitisedTags: string[]) => Promise<boolean>;
            thumbnailBucketUrl: string;
            RenderImage: React.ComponentType<{
                image: ImageWithMetadata;
                handleTagChange: (tags: string[], imageId: string) => void;
                handleTagRemove: (tags: string[], removedTag: string, imageId: string) => void;
                allTags: string[];
                [key: string]: any; // Allow additional props to be passed through
            }>;
            windowWidth: number;
            imageWidth: number;
            cols: number;
        },
        ref: React.Ref<HTMLDivElement>,
    ) => {
        const [allTags, setAllTags] = useState<string[]>(sanitiseTagArray(images.map((image) => (image.text || '').split(',')).flat()));
        const [showUntaggedOnly, setShowUntaggedOnly] = useState(false);
        const [selectedTag, setSelectedTag] = useState<string>('');
        const [negateTag, setNegateTag] = useState(false);
        const isHydrated = useHydrated();
        const { setHelp } = useHelp();

        if (images.length === 0) {
            return null;
        }

        const updateImageTags = async (imageId: string, tags: string[]): Promise<[string[], boolean]> => {
            const sanitisedTags = sanitiseTagArray(tags);
            const hasUpdated = await onImageTagsUpdated(imageId, sanitisedTags);

            return [sanitisedTags, hasUpdated];
        };

        const handleTagChange = async (tags: string[], imageId: string) => {
            const [sanitisedTags, hasUpdated] = await updateImageTags(imageId, tags);

            if (hasUpdated) {
                setAllTags(sanitiseTagArray([...allTags, ...sanitisedTags]));
            }
        };

        // TODO: Removing the last instance of a tag does reset the dropdown but doesn't reset the query, fix this
        const handleTagRemove = async (tags: string[], removedTag: string, imageId: string) => {
            const [sanitisedTags, updatedOk] = await updateImageTags(imageId, tags);

            if (updatedOk) {
                if (images.filter((image) => image.id !== imageId).every((image) => !image.text?.includes(removedTag))) {
                    setAllTags([...tags.filter((tag) => tag !== removedTag), ...sanitisedTags]);
                }
            }
        };

        const filteredImages = useMemo(
            () =>
                [...images].filter((image) => {
                    if (showUntaggedOnly) {
                        return !image.text || image.text.trim() === '';
                    }

                    if (selectedTag) {
                        const imageTags = (image.text || '').split(',').map((t) => t.trim());
                        const hasTag = imageTags.includes(selectedTag);
                        return negateTag ? !hasTag : hasTag;
                    }

                    return true;
                }),
            [showUntaggedOnly, selectedTag, negateTag, images],
        );

        const rowRenderer = useCallback(
            ({ key, columnIndex, index, isScrolling, rowIndex, parent, style }: any) => {
                const idx = index * cols; //rowIndex * cols + columnIndex;
                const images = filteredImages.slice(idx, idx + cols);

                if (!images.length) return null;

                return (
                    <div className="flex w-1/2 flex-row pb-4 pr-4" key={`${key}-${idx}`} style={style}>
                        {images.map((image) => (
                            <div className="align-center mr-4 flex flex-row gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4" key={image.id}>
                                {/* {isScrolling ? (
                                '...'
                            ) : ( */}
                                <RenderImage image={image} handleTagChange={handleTagChange} handleTagRemove={handleTagRemove} allTags={allTags} />
                                {/* )} */}
                            </div>
                        ))}
                    </div>
                );
            },
            [allTags, cols, filteredImages],
        );

        return (
            <div className="flex h-full flex-1 cursor-default flex-col justify-stretch" ref={ref}>
                <div className="flex flex-none items-center gap-4 border-b border-gray-800 pb-4">
                    <h3 className="text-xl font-medium text-white">Filters</h3>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="untagged-filter"
                            checked={showUntaggedOnly}
                            onChange={(e) => setShowUntaggedOnly(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600"
                        />
                        <label htmlFor="untagged-filter" className="text-sm text-gray-200">
                            Untagged images
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={selectedTag}
                            onChange={(e) => setSelectedTag(e.target.value)}
                            className="rounded bg-gray-700 px-2 py-1 text-sm text-gray-200">
                            <option value="">Filter by tag...</option>
                            {allTags
                                .sort()
                                .filter((tag) => tag.length)
                                .map((tag) => (
                                    <option key={tag} value={tag}>
                                        {tag}
                                    </option>
                                ))}
                        </select>

                        {selectedTag && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="negate-tag"
                                    checked={negateTag}
                                    onChange={(e) => setNegateTag(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600"
                                />
                                <label htmlFor="negate-tag" className="text-sm text-gray-200">
                                    Exclude this tag
                                </label>
                            </div>
                        )}
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                            setHelp(
                                <ul className="list-disc space-y-4 pl-4 text-sm leading-6 marker:text-accent1">
                                    <li>
                                        Tags should be <strong className="text-accent1">one or two words</strong>, not phrases and should usually only
                                        be things that are <strong className="text-accent1">visible in the image</strong>, except where they identify
                                        overall qualities of the image. Tagging things that can't be seen will confuse the model.
                                    </li>
                                    <li>
                                        Tag things you{' '}
                                        <strong className="text-accent1">would want to change when generating images from your Lora</strong>. Don't
                                        tag things you want to be fixed. e.g If images are of yourself, and you have brown hair, tagging the hair as
                                        "brunette" or "brown" can indicate this is a changeable property. If brown hair should never change, don't tag
                                        it.
                                    </li>
                                    <li>
                                        Avoid <strong className="text-accent1">ambiguous or non-specific tags</strong>. e.g "person", "picture",
                                        "image", "light" which could apply to many things
                                    </li>
                                    <li>
                                        Avoid too many tags about <strong className="text-accent1">background/secondary details</strong>.
                                    </li>
                                    <li>
                                        <strong className="text-accent1">Be consistent in the language you use</strong>. If you tag an object as
                                        "rusted" in one image don't tag it as "corroded" in another
                                    </li>
                                    <li>
                                        Try to ensure your tags include <strong className="text-accent1">common details</strong>, such as:
                                        <ul className="marker:text-grey-800 mt-4 list-disc space-y-4 pl-8">
                                            <li>
                                                The <strong className="text-accent1">quality and type</strong> of the image e.g{' '}
                                                <code className="font-mono text-accent2">professional</code>,{' '}
                                                <code className="font-mono text-accent2">amateur</code>, etc
                                            </li>
                                            <li>
                                                Details <strong className="text-accent1">about the medium</strong> e.g{' '}
                                                <code className="font-mono text-accent2">canon</code>,{' '}
                                                <code className="font-mono text-accent2">f1.8</code>, or style of art{' '}
                                                <code className="font-mono text-accent2">cell-shading</code>,{' '}
                                                <code className="font-mono text-accent2">chiaroscuro</code>,
                                            </li>
                                            <li>
                                                <strong className="text-accent1">The setting or background of the image</strong> e.g{' '}
                                                <code className="font-mono text-accent2">sunset</code>,{' '}
                                                <code className="font-mono text-accent2">office</code>,{' '}
                                                <code className="font-mono text-accent2">beach</code>,{' '}
                                                <code className="font-mono text-accent2">city</code>
                                            </li>
                                            <li>
                                                Types of <strong className="text-accent1">clothing, or surface details</strong> e.g{' '}
                                                <code className="font-mono text-accent2">t-shirt</code>,{' '}
                                                <code className="font-mono text-accent2">hoodie</code>,{' '}
                                                <code className="font-mono text-accent2">tattoos</code>,{' '}
                                                <code className="font-mono text-accent2">rusted</code>,{' '}
                                                <code className="font-mono text-accent2">scratched</code>
                                            </li>
                                            <li>
                                                <strong className="text-accent1">Lighting styles</strong> e.g{' '}
                                                <code className="font-mono text-accent2">soft lighting</code>,{' '}
                                                <code className="font-mono text-accent2">hard lighting</code> (nb: "soft" or "hard" would be too
                                                ambiguous)
                                            </li>
                                            <li>
                                                Any <strong className="text-accent1">relevant actions</strong> e.g{' '}
                                                <code className="font-mono text-accent2">sitting</code>,{' '}
                                                <code className="font-mono text-accent2">painting</code>,{' '}
                                                <code className="font-mono text-accent2">driving</code>,{' '}
                                                <code className="font-mono text-accent2">waving</code>
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        But remember: if these details are things you would <strong>not</strong> want to be optional or modified
                                        during image generation, consider not tagging them.
                                    </li>
                                </ul>,
                            );
                            return false;
                        }}>
                        <InfoCircledIcon className="size-4 flex-none" />
                    </Button>
                </div>

                {isHydrated && (
                    <div className="flex-1">
                        <AutoSizer>
                            {({ width, height }) => (
                                <List
                                    columnCount={1} // do not be tempted to change this to use props.cols, it will break the layout
                                    columnWidth={imageWidth}
                                    rowHeight={240}
                                    rowRenderer={rowRenderer}
                                    rowCount={Math.ceil(filteredImages.length / cols)}
                                    width={windowWidth}
                                    height={height}
                                    overscanRows={2}

                                    // width={width}
                                    // height={height}
                                    // deferredMeasurementCache={cache}
                                    // rowHeight={cache.rowHeight}
                                    // rowRenderer={rowRenderer}
                                    // rowCount={filteredImages.length}
                                />
                            )}
                        </AutoSizer>
                    </div>
                )}
            </div>
        );
    },
);

ImageTaggingList.displayName = 'ImageTaggingList';
