# Lyrics fallback

Lookup order: original catalog, other domestic catalog (QQ/NetEase), then LRCLIB.
Domestic synchronized lyrics return immediately. An overseas outage preserves any
available domestic plain text and does not affect audio playback.

LRCLIB documentation: https://lrclib.net/docs

The backend sends only track title, artist and duration. No account cookies or
tokens are sent to LRCLIB. It checks title, artist and duration (within 3 seconds),
keeps version labels such as Remix/Live/Sped Up, and normalizes featured-artist
credits. Synchronized results are preferred; plain text is displayed without
inventing timing. The player labels the overseas source as LRCLIB.

Requests time out after 8 seconds. The bounded in-memory cache holds 200 entries;
successes expire after one hour and misses after five minutes. Failures are not
cached. No API key is required. Availability and catalog coverage depend on the
external service. Translation and romanization remain empty unless supplied by
the domestic provider; no AI translation or Apple/Spotify private API is used.

Verification:

- `node scripts/check-external-lyrics.cjs`
- `node scripts/check-external-lyrics.cjs --live` (WAP, network required)
- `node scripts/check-platform-songs.cjs`
- `node scripts/check-inline-review.cjs`

The inline personal review keeps its existing independent local-storage key.
Fields save on blur; export validates and saves before generating the card.
Album reviews retain their existing modal flow.
