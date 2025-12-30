import { useCallback, useMemo, useState, forwardRef, useRef } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';

import { useHelp } from '~/util/help.provider';
import { sanitiseTagArray } from '~/util/misc';

import { Button } from './button';
import { ImageList } from './image-list';
import { ImageWithMetadata } from './file-upload-dropzone';
import { ControlGroup } from './control-group';
import { RadioGroup, Radio } from '@headlessui/react';

export const ImageTaggingList = forwardRef(
    (
        {
            images,
            onImageTagsUpdated,
            ImageComponent,
            windowWidth,
            imageWidth,
            imageHeight,
            cols = 1,
            textMode,
        }: {
            images: any[]; // todo go back to ImageWithMetadata[]
            onImageTagsUpdated: (imageId: string, sanitisedTags: string[]) => Promise<boolean>;
            ImageComponent: React.ComponentType<{
                image: ImageWithMetadata;
                handleTagChange: (tags: string[], imageId: string) => void;
                handleTagRemove: (tags: string[], removedTag: string, imageId: string) => void;
                handleGetTagOptions: () => string[];
                [key: string]: any; // Allow additional props to be passed through
            }>;
            windowWidth: number;
            imageWidth: number;
            imageHeight: number;
            cols: number;
            textMode: 'tags' | 'caption';
        },
        ref: React.Ref<HTMLDivElement>,
    ) => {
        const [allTags, setAllTags] = useState<string[]>(sanitiseTagArray(images.map((image) => (image.text || '').split(',')).flat()));
        const [showUntaggedOnly, setShowUntaggedOnly] = useState(false);
        const [selectedTag, setSelectedTag] = useState<string>('');
        const [negateTag, setNegateTag] = useState(false);
        const [textModeState, setTextModeState] = useState<typeof textMode>(textMode);

        const { setHelp } = useHelp();
        // store current tags in a ref to avoid stale closure issues
        const tagRef = useRef<string[]>(sanitiseTagArray(images.map((image) => (image.text || '').split(',')).flat()));

        if (images.length === 0) {
            return null;
        }

        const updateImageTags = useCallback(async (imageId: string, tags: string[]): Promise<[string[], boolean]> => {
            const sanitisedTags = sanitiseTagArray(tags);
            const hasUpdated = await onImageTagsUpdated(imageId, sanitisedTags);

            return [sanitisedTags, hasUpdated];
        }, []);

        const handleTagChange = useCallback(
            async (tags: string[], imageId: string) => {
                const [sanitisedTags, hasUpdated] = await updateImageTags(imageId, tags);
                if (hasUpdated) {
                    const newAllTags = sanitiseTagArray([...allTags, ...sanitisedTags]);
                    setAllTags(newAllTags);
                    tagRef.current = newAllTags; // Store in ref for immediate access
                }
            },
            [updateImageTags, allTags],
        );

        const handleGetTagOptions = useCallback(() => {
            // Use ref for immediate access to latest tags, fallback to state
            const tagsToUse = tagRef.current.length > 0 ? tagRef.current : allTags;

            return tagsToUse;
        }, [allTags]);

        // TODO: Removing the last instance of a tag does reset the dropdown but doesn't reset the query, fix this
        const handleTagRemove = useCallback(
            async (tags: string[], removedTag: string, imageId: string) => {
                const [sanitisedTags, updatedOk] = await updateImageTags(imageId, tags);

                if (updatedOk) {
                    if (images.filter((image) => image.id !== imageId).every((image) => !image.text?.includes(removedTag))) {
                        setAllTags((prevTags) => sanitiseTagArray([...tags.filter((tag) => tag !== removedTag), ...sanitisedTags]));
                    }
                }
            },
            [images, updateImageTags],
        );

        const filteredImages = useMemo(
            () =>
                [...images].filter((image) => {
                    if (showUntaggedOnly) {
                        return !image.text || image.text.trim() === '';
                    }

                    if (selectedTag) {
                        const imageTags = (image.text || '').split(',').map((t: string) => t.trim());
                        const hasTag = imageTags.includes(selectedTag);
                        return negateTag ? !hasTag : hasTag;
                    }

                    return true;
                }),
            [showUntaggedOnly, selectedTag, negateTag, images],
        );

        return (
            <div className="flex h-full flex-1 cursor-default flex-col justify-stretch" ref={ref}>
                <ControlGroup heading="Text mode">
                    <RadioGroup value={textModeState} onChange={(value: 'tags' | 'caption') => setTextModeState(value)}>
                        <Radio value="tags" className="text-sm text-gray-200 data-[checked]:bg-primary">
                            <span className="text-sm text-gray-200">Tags</span>
                        </Radio>
                        <Radio value="caption" className="text-sm text-gray-200 data-[checked]:bg-primary">
                            <span className="text-sm text-gray-200">Caption</span>
                        </Radio>
                    </RadioGroup>
                </ControlGroup>
                <ControlGroup heading="Tag filters">
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
                        display="textonly"
                        size="text"
                        className="text-sm"
                        icon={InfoCircledIcon}
                        onClick={() => {
                            setHelp(
                                <div className="space-y-4">
                                    <p>
                                        Tags should be <strong className="text-accent1">one or two words</strong>, not phrases and should usually only
                                        be things that are <strong className="text-accent1">visible in the scene</strong>, except where they identify
                                        attributes of the photographic process. Tagging things that can't be seen will confuse the model.
                                    </p>
                                    <p>
                                        Tag things you would want to be <strong className="text-accent1">changeable</strong> in your image generation.
                                        Don't tag things you want to be fixed. e.g If your subject is an iconic blond cartoon character, tagging their
                                        hair as "blond" can indicate this is a changeable property. If blonde hair should be fixed then
                                        <strong className="text-accent1">don't tag it</strong>.
                                    </p>
                                    <p>
                                        Avoid <strong className="text-accent1">ambiguous or non-specific tags</strong>. e.g "person", "picture",
                                        "image", "light" which could apply to many things
                                    </p>
                                    <p>
                                        Avoid too many tags about <strong className="text-accent1">background/secondary details</strong>.
                                    </p>

                                    <p>
                                        Try to ensure your tags include <strong className="text-accent1">common details</strong>, such as:
                                    </p>
                                    <ul className="marker:text-grey-800 mt-4 list-disc space-y-4 pl-8">
                                        <li>
                                            The <strong className="text-accent1">quality and type</strong> of the image e.g{' '}
                                            <code className="font-mono text-accent2">professional</code>,{' '}
                                            <code className="font-mono text-accent2">amateur</code>,{' '}
                                            <code className="font-mono text-accent2">illustration</code>,{' '}
                                            <code className="font-mono text-accent2">photograph</code>, etc
                                        </li>
                                        <li>
                                            Details <strong className="text-accent1">about the medium</strong> e.g{' '}
                                            <code className="font-mono text-accent2">canon</code>,{' '}
                                            <code className="font-mono text-accent2">f1.8</code>, or style of art{' '}
                                            <code className="font-mono text-accent2">cell-shading</code>,{' '}
                                            <code className="font-mono text-accent2">chiaroscuro</code>,{' '}
                                            <code className="font-mono text-accent2">watercolour</code>,
                                        </li>
                                        <li>
                                            <strong className="text-accent1">The scene or background of the image</strong> e.g{' '}
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

                                    <p>
                                        But remember: if any of these details are things you would <strong>not</strong> want to be optional or
                                        modified during image generation, consider not tagging them at all. You can use an Image Set to tighten the
                                        crops around your subject, reducing your need to tag secondary detail that you'd want removed.
                                    </p>
                                    <p>
                                        Note however that on the whole image generation models attempt to generate the images you've trained them on.
                                        So large numbers of images cropped too tightly may heavily bias the images generated towards the same
                                        composition and cropping.
                                    </p>
                                </div>,
                            );
                            return false;
                        }}>
                        Learn more about tagging
                    </Button>
                </ControlGroup>

                <ImageList
                    images={filteredImages}
                    cols={cols}
                    imageWidth={imageWidth}
                    imageHeight={imageHeight}
                    textMode={textModeState}
                    ImageComponent={(props) => (
                        <ImageComponent
                            {...props}
                            handleTagChange={handleTagChange}
                            handleTagRemove={handleTagRemove}
                            handleGetTagOptions={handleGetTagOptions}
                        />
                    )}
                />
            </div>
        );
    },
);

ImageTaggingList.displayName = 'ImageTaggingList';
