export const SPOTIFY_CONFIG = {
  clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID || '2814f06addc8ee4e84cafe0036985a93',
  redirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI || 'http://localhost:5173/callback',
  scopes: [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read'
  ].join(' ')
};