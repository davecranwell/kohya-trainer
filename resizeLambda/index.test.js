const AWSMock = require('aws-sdk-mock');
const { S3 } = require('@aws-sdk/client-s3');

const { handler } = require('./index.mjs');

jest.mock('sharp', () => {
    return jest.fn().mockReturnValue({
        resize: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockResizedImageBuffer),
    });
});

describe('Lambda@Edge Image Resize Function', () => {
    beforeAll(() => {
        AWSMock.setSDKInstance(S3);
    });

    afterAll(() => {
        AWSMock.restore('S3');
    });

    it('should resize the image and return a 200 response', async () => {
        const mockImageBuffer = Buffer.from('mock image data');
        const mockResizedImageBuffer = Buffer.from('mock resized image data');

        // Mock S3 getObject
        AWSMock.mock('S3', 'getObject', (params, callback) => {
            callback(null, { Body: mockImageBuffer });
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
        const callback = jest.fn();

        await handler(event, context, callback);

        expect(callback).toHaveBeenCalledWith(
            null,
            expect.objectContaining({
                status: '200',
                body: mockResizedImageBuffer.toString('base64'),
                headers: {
                    'content-type': [{ key: 'Content-Type', value: 'image/jpeg' }],
                },
            }),
        );
    });
});
