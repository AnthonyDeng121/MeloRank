export const SPOTIFY_CONFIG = {
  clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:5188/',
  scopes: [
    'user-read-private',
    'playlist-read-private',
    'user-library-read'
  ].join(' ')
};
