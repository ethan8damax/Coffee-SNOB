# Add a shop — design

Sep 29, 2026 · owner ask: "anyone can add a shop, it needs admin approval; name and
coordinates required, anything else optional; immaculate, in the design system."

## Why

Open data misses real specialty shops. Of seven the owner checked in Tampa/Atlanta,
three (Wuz Here, Elevensies, Sunflower Coffee House) are in no free source. People
who know a shop is missing should be able to put it on the map, and a person should
check it first.

## Flow

**App (anyone signed in)**
1. "Not on the map? Add it" (map search, log screen) → pin mode, unchanged: the map
   moves under a fixed pin; name field; button now reads **Next**.
2. `/add-shop` screen, same shell as the log form (Cancel · Add a shop · Send):
   - **Name** (required, from pin mode, editable) and the pin's spot (required), with
     "Move the pin" going back to the map.
   - Optional: **Address** (prefilled from the pin via `/api/locate`, editable),
     **Hours** (a day-by-day editor that writes OSM `opening_hours`, e.g.
     `Mo-Fr 07:00-15:00; Sa,Su 08:00-14:00`), **Website or Instagram**,
     **What they pour** (roaster), **Anything we should know** (note for the admin).
3. Sent → a done state: "Sent for a look. We check every shop before it goes on the
   map. You'll hear from us here." Admins skip the queue: their add goes live and
   opens the shop page.
4. Decision → a note at the top of the home feed (same card as the finder note):
   approved "Wuz Here is on the map. You added it — log the first visit."; declined
   "We passed on X." plus the admin's reason.

**Admin (`/admin/shops?tab=added`, first tab with a waiting count)**
- Waiting list: name, where, who sent it, when. Open one → side panel with a small
  OSM map of the pin, every field editable, the sender's roaster and note, and
  **Close by**: our shops and coffee-index cafés within 150 m (catches duplicates).
- **Put it on the map** (creates the shop, notifies the sender) or **Pass** with an
  optional reason (notifies the sender).
- **Add one yourself**: name + "lat, lng" (paste from any map) + optional fields,
  live immediately — for loading a city's known shops in one sitting.
- Recently decided list.

## Data (migration 0036)

- `shop_submissions`: sender, name, lat/lng, address, hours, website, roaster, note,
  locality/region/country_code, status `pending | approved | declined`,
  decline_reason, shop_id, reviewed_by/at. Read: own rows or admin. Writes only
  through RPCs.
- `submit_shop(...)`: signed in, active, not a chain, 10 per day. Admin → shop
  created now (status approved). Returns `(submission_id, shop_id)`.
- `approve_shop_submission(id, edits…)` / `decline_shop_submission(id, reason)`:
  admin only; approve creates the shop as `user/<uuid>` (the build already links
  those to the index later).
- Guard trigger on `shops`: a new `user/…` shop can only be created by an admin (or
  the service role). Closes the old path where any log created one directly.
- `notifications`: kinds `shop_added` / `shop_declined`; `shop_id` becomes nullable
  and `submission_id` is added.

## Map

Approved shops nobody has logged yet show as ordinary café dots
(`getAddedShopsInBounds`, same box as the rated fetch) and are searchable
(`searchAddedShops`). The first log turns them into a rated pin as usual.

## Shops you added (owner ask, same day)

Own profile gets a "Shops you added" row ("3 on the map because of you · 1 waiting")
opening `/my-shops`: counts (On the map · Waiting · Passed) and every submission
with its status; approved ones open the shop, passed ones show the admin's line.
Private to the sender (RLS). Bigger contributor recognition is a separate
brainstorm; per the owner's rule, no user-facing tiers or badges come with it.

## Not doing

Photos, phone, amenities (wifi, seating), editing after sending. Add when someone asks.
