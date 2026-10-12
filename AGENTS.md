# Game version

Every PR must increment the game version once, including documentation-only PRs.
Use a patch increment by default (1.0.0 → 1.0.1 → 1.0.2).
Update both the visible `.game-version` footer in `index.html` and the
`CACHE_NAME` version suffix in `sw.js` to the same version. This also refreshes
the offline asset cache. Check the latest target branch before choosing the
number so separate PRs do not ship the same version.

Keep the version label small and inside the start menu only, below its content.
