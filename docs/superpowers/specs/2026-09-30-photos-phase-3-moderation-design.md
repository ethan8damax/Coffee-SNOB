# Photos, Phase 3: moderation

**Date:** 2026-09-30 · **Parent spec:** `2026-09-30-photos-design.md` (section 8; section 10, Phase 3) · **Status:** approved 2026-09-30

**Why:** photos go live the moment they're posted. People need a way to report a bad one, the app needs to hide it quickly, and the admin needs to decide. The admin also needs to pin a photo, which is how Snob-Approved shops get their header.

## 1. Database: `0040_photo_moderation.sql`

- **Auto-hide.** A trigger after each `photo_flags` insert hides a live photo once it has **two open flags**. The flags are from two different people, because `(photo_id, user_id)` is unique. The trigger is security definer, since reporters can't update photos.
- **`photo_flags.outcome`** (`kept` / `removed`) records how each flag ended, for audit.
- **`decide_photo(p_photo_id, p_outcome)`** is admin only and security definer.
  - `kept` sets the photo back to `live`.
  - `removed` sets it to `removed` and clears any pin pointing at it.
  - Either way it resolves the open flags. It also notifies each reporter once (`photo_kept` / `photo_removed`, with the photo's `shop_id`), skipping the admin themselves.
  - It works with no flags too, so the admin can take down any photo from the shop view.
- **Notifications** learn the two kinds `photo_kept` and `photo_removed`.
- A hidden pin already falls through to rotation in `shop_headers`, and comes back on restore. Nothing new is needed.

## 2. App

- **Report photo:** in the gallery's full-size view, signed-in people get a "Report photo" link. It opens four reasons: Wrong shop, Not okay, Not their photo, Something else. Picking one sends it. The link then reads "Reported. We'll take a look." Reporting the same photo twice reads as already reported.
- **Feed note** (`FinderNote`):
  - `photo_removed`: "Removed" · "We took down a photo of {shop}." · "You reported it. It's gone."
  - `photo_kept`: "Checked" · "The photo of {shop} stays." · "We looked at your report and it checks out. Thanks for flagging it."

## 3. Admin (`/admin/shops`)

- **Inbox → Photos:** every photo that is hidden or has open reports. Each row shows the thumbnail, shop, uploader, report counts by reason, and a Hidden or Live chip. Actions are **Keep** (restore) and **Remove**. The inbox count includes these.
- **Shop editor → Photos:** the shop's live photos, each with **Pin** (or **Unpin** on the pinned one) and **Remove**. Pinning is a plain update to `shops.header_photo_id`; the 0038 trigger refuses anything that isn't a live photo of that shop.
- **Snob-Approved headers:** log your visit in the app with a photo, then pin it here.

## 4. Not doing

- Photo reports don't appear on `/sent`. The feed note is the answer.
- No per-reason rules: two reports of any kind hide a photo.
- No owner "remove my photo" button yet. Deleting the entry removes it.

## 5. Checks

- PGlite tests for 0040:
  - one report doesn't hide; two do
  - `kept` restores and resolves; `removed` removes, unpins and resolves
  - reporters are notified once each; the admin isn't
  - non-admins can't decide
  - removing a photo with no flags works
- Vitest for `reportPhoto` and `getModerationPhotos`.
- Typechecks, web build, a live admin check in Chrome.
