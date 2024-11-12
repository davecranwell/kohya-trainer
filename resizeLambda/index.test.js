import { describe, beforeAll, afterAll, it, vi, expect } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { S3, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// Define buffers at the top level
const s3Mock = mockClient(S3); // Explicitly mock the S3 client

vi.mock('sharp', () => ({
    default: vi.fn().mockReturnValue({
        resize: vi.fn().mockReturnThis(),
        toFormat: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock resized image data')),
    }),
}));

import { handler } from './index.mjs';

describe('Lambda@Edge Image Resize Function', () => {
    it('should resize the image and return a 200 response', async () => {
        const mockImageBuffer = Buffer.from('mock image data');
        // for small files upload:
        s3Mock.on(GetObjectCommand).callsFake(() => {
            return { Body: mockImageBuffer };
        });

        s3Mock.on(HeadObjectCommand).callsFake(() => {
            return { statusCode: 404 };
        });

        const event = {
            Records: [
                {
                    cf: {
                        request: {
                            uri: '/picture.400.jpg',
                        },
                        response: {
                            status: '404',
                            headers: {},
                        },
                    },
                },
            ],
        };

        const context = {};
        const callback = vi.fn();

        await handler(event, context, callback);

        expect(callback).toHaveBeenCalledWith(
            null,
            expect.objectContaining({
                status: 200,
                headers: {
                    'content-type': [{ key: 'Content-Type', value: 'image/jpeg' }],
                },
            }),
        );
    });

    it('should have attempted to put back a new image to S3', async () => {
        const mockImageBuffer = Buffer.from('mock image data');
        s3Mock.on(GetObjectCommand).callsFake(() => {
            return { Body: mockImageBuffer };
        });

        s3Mock.on(PutObjectCommand).callsFake(() => {
            return { Body: mockImageBuffer, Foo: 'bar' };
        });

        s3Mock.on(HeadObjectCommand).callsFake(() => {
            return { statusCode: 200 };
        });

        const event = {
            Records: [
                {
                    cf: {
                        request: {
                            uri: '/picture.400.jpg',
                        },
                        response: {
                            status: '404',
                            headers: {},
                        },
                    },
                },
            ],
        };

        const context = {};
        const callback = vi.fn();

        await handler(event, context, callback);

        // expect the first call to be a getObject which looks for the picture without the dimension part of the filename
        expect(s3Mock.calls()[0].args[0].input).toEqual(expect.objectContaining({ Key: 'picture.jpg' }));
        // expect the second call to be a putObject which puts the resized image including the dimension part of the filename
        expect(s3Mock.calls()[1].args[0].input).toEqual(expect.objectContaining({ Key: 'picture.400.jpg' }));
    });
});
