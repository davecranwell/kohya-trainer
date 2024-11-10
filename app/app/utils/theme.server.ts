import * as cookie from 'cookie';

const COOKIE_NAME = 'en_theme';
export type Theme = 'light' | 'dark';

export function getTheme(request: Request): Theme | null {
    const cookies = request.headers.get('cookie');

    const parsed = cookies ? cookie.parse(cookies)[COOKIE_NAME] : 'light';
    if (parsed === 'light' || parsed === 'dark') return parsed;
    return null;
}

export function setTheme(theme: Theme | 'system') {
    if (theme === 'system') {
        return cookie.serialize(COOKIE_NAME, '', { path: '/', maxAge: -1 });
    } else {
        return cookie.serialize(COOKIE_NAME, theme, { path: '/', maxAge: 31536000 });
    }
}
