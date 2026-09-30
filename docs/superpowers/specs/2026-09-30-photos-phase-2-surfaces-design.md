# Photos, Phase 2: surfaces

**Date:** 2026-09-30 · **Parent spec:** `2026-09-30-photos-design.md` (section 7; section 10, Phase 2) · **Status:** approved 2026-09-30

**Why:** photos now upload (Phase 1). This phase puts them where people look: the shop page band, the map card, map list rows and profile tiles, plus a gallery on the shop page. Mockups: [photo surfaces](https://claude.ai/artifact/2BmxwRUFttz9XBdiyw1K3e).

## 1. Which photo heads a shop: `shop_headers(shop_ids, day)`

Migration `0039_shop_headers.sql` adds one SQL function. It is `security invoker`, so RLS applies, and callable by `anon` and `authenticated`. It takes shop ids and a day (default: today, UTC) and returns at most one row per shop: `shop_id, photo_id, path, thumb_path, width, height, username, pinned`.

1. **Pin:** `shops.header_photo_id`, if that photo is `live`.
2. **Otherwise, today's rotation:**
   - **Eligible photos** are live, with a short edge of at least 600 px.
   - **The pool** is the landscape ones if the shop has any, otherwise all eligible photos. This changes the parent spec: most phone photos are portrait, and the first real upload was 1200×1600.
   - **The pick** is the photo at index `mod(abs(hashtext(shop_id || day)), n)`, with photos sorted by id. Everyone sees the same photo all day.
3. **Otherwise nothing is returned**, and each surface uses its fallback.

The `day` parameter exists so the rotation is testable.

## 2. Surfaces

| Surface | With a header | Without |
| --- | --- | --- |
| **Shop page band** (`Hero`) | Full-size photo covers the band (taller, 300 px min), darkened toward the bottom; credit tag top-right | **Web:** oxblood band with faint streets (below) and a "© OpenStreetMap" tag top-right. **Native:** today's plain band. |
| **Map card, rated shop** | Thumbnail on top of the card (2:1); letter tile hidden; close button on the photo's corner; credit tag bottom-left | Unchanged |
| **Map list rows** (`ShopTile`) | Thumbnail replaces the letter | Unchanged |
| **Profile entry tiles** | The log's own live photo, else the shop's header thumbnail, under the existing scrim | Today's solid ground |
| **Shop page gallery** | A "Photos" strip of the shop's live photos (newest first, up to 30), shown only when there are any. Tapping opens the full size with its credit tag. | Hidden |

- **Credit tag:** ink ground, cream Area Extended label reading "Photo by @username". It links to the profile.
- **Loading:** images sit on a `paper2` ground while they load.
- **BlurHash is dropped.** Generating one needs raw pixel access that Expo's native image tools don't expose, and a ~60 KB thumbnail on a token-colored ground loads fast enough. The `blurhash` column stays, unused.
- **Map search results** don't fetch headers yet. They keep the letter tile.

## 3. Faint streets (web)

- A non-interactive MapLibre map fills the band, zoomed to about street level (z16) on the shop.
- It uses the same OpenFreeMap style the map already loads, passed through `streetsStyle()`. That function sets the background to oxblood, hides every layer except road lines, and draws those in `oxbloodLt`.
- It's a pure JSON → JSON function, tested like `brandStyle`.
- No labels, no pin, no controls. Credit lives in the tag.

## 4. Data

- `getShopHeaders(client, shopIds)` returns a `Map<shopId, ShopHeader>`.
- `getShopPhotos(client, shopId)` returns the shop's live photos with usernames.
- `getProfileEntries` embeds the log's photos, fetches shop headers for entries without their own live photo, and sets `ProfileEntry.photo`.
- The map's rated-shop loader fetches headers for the shops it loads and puts them on `RatedShopPin.header`.

## 5. Checks

- PGlite tests for `shop_headers`: pin wins; a hidden pin falls through to rotation; hidden or small photos are skipped; landscape is preferred; portrait-only still works; stable within a day; varies across days; username included; empty list.
- Vitest for `streetsStyle`, `getShopHeaders` and `getShopPhotos` mapping, and the profile entries photo fallback.
- Typechecks and the app web export.
- Live: the Lazy Labrador photo heads its shop page, map card, list row and your profile tile. A shop with no photos shows the street band.
