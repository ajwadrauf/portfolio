# Completed packshots → Campaign Studio

Branch: `codex/packshot-campaign-handoff`. Deployment branch: `claude/loblaw-ai-content-studio-701jhf`.

## User workflow

1. Finish a Packshot generation or render the artwork views locally.
2. Choose **Use in Campaign Studio** on the completed view. Generated results with a finished cutout/upscale offer a version selector; the latest finished version is the default, and the original remains available.
3. Campaign Studio opens in a new tab with that image staged. The source Packshots tab stays open.
4. Review the image and its transferred angle, version and review status. **Analyze this packshot** starts the existing campaign flow. Opening a transfer never analyzes, writes a brief or generates assets automatically.

Campaign Studio currently uses one product image. Each handoff therefore contains one selected view, not a multi-image batch. The ordinary upload and sample workflows remain available.

## Eligible results

- Generated results require `status === "done"`, actual image media and no finishing operation in progress. Queued, running, failed and demo results cannot transfer.
- Artwork results require a finished render batch, an actual image, at least one visible region with assigned artwork, no active rendering and no edits since that batch was rendered. Outdated views must be rendered again before transfer; completely unassigned views do not offer the action.
- Review status is carried as context, not treated as certification. Unreviewed completed results can transfer and remain marked as needing review. Artwork metadata includes any unassigned visible regions.
- Product names, view details and source version come from the completed job/batch snapshot, not later form edits.

## Storage and media

The handoff stores actual PNG/JPEG/WebP bytes and bounded metadata in same-origin IndexedDB. It does not rely on a temporary provider URL surviving, upload the artwork to a new service, or put image data in the URL. Remote completed images are fetched through the existing allowlisted image-download route. Image bytes and MIME are checked, downloads are bounded to 24 MB and 30 seconds, and storage errors preserve the source result.

Transfers last up to 24 hours, with a maximum of eight saved entries. Older entries may be pruned. Links work in the same browser and site origin; they are not cloud share links. Private browsing or storage restrictions may prevent transfer. The UI offers download/upload as recovery. Blocked popups leave an ordinary **Open in Campaign Studio** link.

The imported preview retains original transparency. Only after explicit analysis, Campaign Studio creates a white-backed JPEG reference, keeping a 2048px long edge where possible and reducing quality/dimensions only to fit its 2.5 MB reference budget. The original stored image remains intact.

## Validation

```sh
node scripts/check-campaign-transfer.cjs
node scripts/check-campaign-handoff.cjs
node scripts/check-packshot.cjs
node scripts/check-artwork.cjs
node scripts/check-package-presets.cjs
node scripts/check-packaging.cjs
npm run build -- --webpack
git diff --check
```

The handoff suite passes 44 checks using mocked provider calls, including button lifecycle and 2048px image preparation. Separate transport checks verify actual bytes, expiry, retention, quota rollback and bounded downloads. Existing Packshots, artwork, preset and geometry checks pass, as does the production build. Removing the Analyze click lock makes the handoff suite fail as expected.

Browser verification passed with provider keys absent: a local front view opened in a separate Campaign Studio tab with the correct image and metadata; analysis waited for an explicit click, then the free demo advanced to clarification. The source tab retained its views, and editing its dimensions removed stale transfer actions. The 390px recipient layout had no horizontal overflow. No paid generations were used.
