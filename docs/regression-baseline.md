# MeloRank Regression Baseline

Run the automated baseline before and after each refactor:

```sh
npm run check
```

## Application shell

- Open every top navigation destination and return to the home page.
- Open and close the play queue without changing the current track.
- Refresh the page with and without a saved QQ Music cookie.

## QQ Music

- Open the QR login dialog, cancel it, and confirm polling stops.
- Search for a song and verify pagination and empty/error states.
- Play a searchable song, pause it, seek it, and change volume.
- Add, remove, reorder, and clear songs in the play queue.
- Verify lyrics update when the current song changes.

## Ranking

- Switch among yearly song, album, artist, and MV ranking modes.
- Add, edit, delete, and move ranking items in both scoring modes.
- Verify equal scores, decimal scores, and an empty ranking do not produce invalid values.
- Import a valid text ranking and reject malformed rows without losing existing data.
- Save, load, and delete a ranking history entry, then refresh the page.
- Verify search selection fills title, artist, and cover fields.
- Export PDF and DOCX and compare item order, scores, covers, and Chinese text.
- Restore the default ranking only after confirming the dialog.

## Other tools

- Open the artist recommendations page and verify its local images load.
- Paste lyrics and export the generated result.
- Load an audio file in Audio Lab and exercise its available controls.

## Baseline limitations

- QQ Music checks require the local API configured by `VITE_QQ_MUSIC_API_URL`.
- Ranking history currently uses browser local storage.
- PDF and DOCX output still require manual visual comparison.
