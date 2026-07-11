import Cookies from 'js-cookie';

/** Set the access token cookie with production-safe flags. */
export function setAuthTokenCookie(token: string) {
  Cookies.set('mrh_token', token, {
    path: '/',
    secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
    sameSite: 'strict',
  });
}
