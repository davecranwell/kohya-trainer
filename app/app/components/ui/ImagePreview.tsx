import React from 'react';
import { Label } from './label';
import { MultiComboBox } from './multi-combo-box';

interface ImagePreviewProps {
    id?: string;
    name: string;
    text: string | null | undefined;
    url?: string;
    uploadProgress: number | undefined;
    tagList: string[];
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ id, name, text, url, uploadProgress, tagList }) => {
    return (
        <div className="flex flex-row">
            <div className="flex w-[250px] flex-none flex-col space-y-2">
                <img src={url} alt={`Preview ${name}`} className="m-auto h-[200px] w-[200px] object-contain text-center" />
                {!id && (
                    <div className="w-fullrounded-full h-2.5 bg-gray-300">
                        <div className="h-2.5 w-[0px] rounded-full bg-blue-600 text-sm text-gray-500" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                )}
            </div>
            <div className="flex-grow">
                <Label htmlFor={`${name}-text`}>Tags/Caption</Label>
                <MultiComboBox name={`${id || name}-tags`} defaultValue={text} options={tagList} />
            </div>
        </div>
    );
};
