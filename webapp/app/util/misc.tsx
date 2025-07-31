/**
 * Merge multiple headers objects into one (uses set so headers are overridden)
 */
export function mergeHeaders(...headers: Array<ResponseInit['headers'] | null | undefined>) {
    const merged = new Headers();
    for (const header of headers) {
        if (!header) continue;
        for (const [key, value] of new Headers(header).entries()) {
            merged.set(key, value);
        }
    }
    return merged;
}

/**
 * Combine multiple header objects into one (uses append so headers are not overridden)
 */
export function combineHeaders(...headers: Array<ResponseInit['headers'] | null | undefined>) {
    const combined = new Headers();
    for (const header of headers) {
        if (!header) continue;
        for (const [key, value] of new Headers(header).entries()) {
            combined.append(key, value);
        }
    }
    return combined;
}

/**
 * Combine multiple response init objects into one (uses combineHeaders)
 */
export function combineResponseInits(...responseInits: Array<ResponseInit | null | undefined>) {
    let combined: ResponseInit = {};
    for (const responseInit of responseInits) {
        combined = {
            ...responseInit,
            headers: combineHeaders(combined.headers, responseInit?.headers),
        };
    }
    return combined;
}

export function commaSeparatedStringToArray(string: string) {
    if (typeof string !== 'string') return string;
    return string
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
}

export function makeArrayUnique(array: string[]) {
    return [...new Set(array)];
}

export function arrayToCommaSeparatedString(array: string[]) {
    return array.join(',');
}

export function sanitiseTagString(tagString: string, filterTags?: string[]) {
    return arrayToCommaSeparatedString(makeArrayUnique(commaSeparatedStringToArray(tagString).filter((tag) => !filterTags?.includes(tag))));
}

// Takes an array of tags, an optional second array to filter on, and returns a new array of tags that are unique and that are not in the filter array
// The second param is typically used when removing tags.
export function sanitiseTagArray(tagArray: string[], filterTags?: string[]) {
    return makeArrayUnique(tagArray).filter((tag) => !filterTags?.includes(tag));
}

// // a function which converts an S3 string pointing to an image file, to a string in which the file extension is replaced with _thumbnail.extension
// export function getThumbnailKey(s3Key: string) {
//     return s3Key.replace(/\.[^.]+$/, '_thumbnail-200$&');
// }

export function getThumbnailUrl(s3root: string, origionalKey: string, size: number) {
    const origionalPath = origionalKey.split('/').slice(0, -1).join('/');
    const origionalFilename = origionalKey.split('/').pop();

    return `${s3root}${origionalPath}/${size}/${origionalFilename}`;
}

export function getOriginalUrl(s3root: string, origionalKey: string) {
    const origionalPath = origionalKey.split('/').slice(0, -1).join('/');
    const origionalFilename = origionalKey.split('/').pop();

    return `${s3root}${origionalPath}/${origionalFilename}`;
}
