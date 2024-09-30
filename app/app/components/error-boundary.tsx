import { type ErrorResponse, isRouteErrorResponse, useParams, useRouteError } from '@remix-run/react';
import { captureRemixErrorBoundaryError } from '@sentry/remix';

import { getErrorMessage } from '#app/utils/misc.tsx';

type StatusHandler = (info: { error: ErrorResponse; params: Record<string, string | undefined> }) => JSX.Element | null;

const IS_PROD = process.env.NODE_ENV === 'production';

export function GeneralErrorBoundary({
    defaultStatusHandler = ({ error }) => (
        <p>
            {IS_PROD ? (
                <>Something went wrong</>
            ) : (
                <>
                    {error.status} {error.data}
                </>
            )}
        </p>
    ),
    unexpectedErrorHandler = (error) => <p>{IS_PROD ? <>Something went wrong</> : getErrorMessage(error)}</p>,
    statusHandlers,
}: {
    defaultStatusHandler?: StatusHandler;
    unexpectedErrorHandler?: (error: unknown) => JSX.Element | null;
    statusHandlers?: Record<number, StatusHandler>;
}) {
    const error = useRouteError();
    const params = useParams();
    captureRemixErrorBoundaryError(error);

    if (typeof document !== 'undefined') {
        console.error(error);
    }

    return (
        <div>
            {isRouteErrorResponse(error)
                ? (statusHandlers?.[error.status] ?? defaultStatusHandler)({
                      error,
                      params,
                  })
                : unexpectedErrorHandler(error)}
        </div>
    );
}
