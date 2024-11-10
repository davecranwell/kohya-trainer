import { type ErrorResponse, isRouteErrorResponse, useParams, useRouteError } from '@remix-run/react';
import { captureRemixErrorBoundaryError } from '@sentry/remix';

const IS_PROD = process.env.NODE_ENV === 'production';

export function getErrorMessage(error: unknown) {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message;
    }
    console.error('Unable to get error message for error', error);
    return 'Unknown Error';
}

export function GeneralErrorBoundary() {
    const error = useRouteError();
    const params = useParams();

    return (
        <div>
            {isRouteErrorResponse(error) ? (
                <p>
                    {IS_PROD ? (
                        <>Something went wrong</>
                    ) : (
                        <>
                            {error.status} {error.data}
                        </>
                    )}
                </p>
            ) : (
                <p>{IS_PROD ? <>Something went wrong</> : getErrorMessage(error)}</p>
            )}
        </div>
    );
}
