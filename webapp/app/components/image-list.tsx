import { useCallback, useMemo, useState, forwardRef, useRef } from 'react';
import { List, AutoSizer, CellMeasurer, CellMeasurerCache, Masonry, createMasonryCellPositioner, Grid } from 'react-virtualized';
import { useHydrated } from 'remix-utils/use-hydrated';

import { ImageWithMetadata } from './file-upload-dropzone';

export const ImageList = ({
    images,
    cols,
    imageWidth,
    imageHeight,
    textMode,
    ImageComponent,
}: {
    images: any[];
    cols: number;
    imageWidth: number;
    imageHeight: number;
    textMode: 'tags' | 'caption';
    ImageComponent: React.ComponentType<{
        image: ImageWithMetadata;
        textMode: 'tags' | 'caption';
        [key: string]: any; // Allow additional props to be passed through
    }>;
}) => {
    const isHydrated = useHydrated();

    const rowRenderer = useCallback(
        ({ key, index, rowIndex, columnIndex, isScrolling, parent, style }: any) => {
            if (!images.length) return null;
            const image = images[rowIndex * cols + columnIndex];
            if (!image) return null;

            return (
                <div className="flex w-full pb-4 pr-4" key={`${key}-${rowIndex}-${columnIndex}`} style={style}>
                    <div
                        className={`flex-0 group/image relative flex rounded-xl border border-gray-800 bg-gray-900 p-4`}
                        key={`${image.id}-cell`}
                        style={{ width: `${imageWidth}px` }}>
                        <ImageComponent image={image} textMode={textMode} />
                    </div>
                </div>
            );
        },
        [cols, images, imageWidth, textMode],
    );

    return (
        <>
            {isHydrated && (
                <div className="flex-1">
                    <AutoSizer>
                        {({ width, height }) => (
                            <Grid
                                cellRenderer={rowRenderer}
                                columnCount={cols}
                                columnWidth={imageWidth}
                                rowCount={Math.ceil(images.length / cols)}
                                rowHeight={imageHeight}
                                height={height}
                                width={width}
                            />
                        )}
                    </AutoSizer>
                </div>
            )}
        </>
    );
};
