# Tell us: one system for what people send us

Date: 2026-09-30. Status: shipped (migration 0037).

## Why

Three separate things, none of them easy to find:
- a "Something off?" report of three chips, index cafés only;
- Add a shop, reachable only from search results and the log screen;
- nothing at all for bugs, ideas, or contact.

Tell us makes them one flow with one follow-up page ("What you've sent") and
one admin Inbox. Owner decisions: account required for everything; replies go
by email (one-way in the app) but people always see the status; Add a shop is
a permanent control on the map; the name is "Tell us".

## Surfaces

| Where | What |
|---|---|
| `/tell-us` | One screen. With `about=shop` (+ shopId or placeId, name, lat, lng) it opens the shop report; `about=bug/idea/contact` opens that note; bare, it asks "What's up?" with five rows (missing shop → map pin mode, shop problem → map, bug, idea, hi). |
| Shop report | Reason chips (one): Closed for good · Moved · Wrong hours or info · Not specialty · Duplicate · Something else; optional note. Reasons already open for this person show "· sent" and can't be re-sent. |
| Bug / idea / hi | One note (2000 chars). Bugs show the line "Sends: web · app 1.0.0 · /map · 390×844": platform, version, screen, window, and the browser string on web. Nothing else is collected. |
| Map, phone | "+ Add a shop" beside locate (hidden while a preview card is up). Labelled so it never reads as zoom-in. |
| Map, desktop panel + phone List view | Pinned footer: "Missing a shop? Add it" · "Tell us". |
| Map preview card, shop page | "Something off?" opens the report with the shop filled in: index cafés (placeId), hand-added shops (shopId), and every rated shop (shop page). |
| Settings | Tell us: Report a bug · Suggest something · Contact us · What you've sent. |
| `/sent` (was `/my-shops`) | Counts (On the map · Fixed · Waiting) and one list, newest first: shops (Waiting / On the map / Passed), reports (Sent / Done / Passed), notes (Sent / Seen / Done / Passed), with the admin's line when there is one. |
| Profile (own) | "What you've sent" row with the summary line. |
| Feed note | New kinds: report_done / report_passed / message_done / message_passed. |
| Admin | Flags + Added tabs become **Inbox** with filters: Missing shops · Shop problems · Bugs · Ideas · Messages. Opening a note marks it Seen; Done/Fixed and Pass take an optional line the sender reads; "Reply by email" opens a mailto with the note quoted. Shop problems: Hide (index café) or Edit + Fixed (our shop), or Pass with a line. |

## Data (0037)

- `place_flags` grows `shop_id` (report on one of our shops; `place_id` for index cafés, exactly one), `note`, `outcome` (done/passed), `reason`, and three kinds (wrong_info, duplicate, other). The insert policy refuses pre-decided rows. The hide rules (`active_place_hides`, `place_flag_counts`) only read index-café rows.
- `messages`: kind (bug/idea/contact), body, context jsonb, status (sent/seen/done/passed), reason. Select: sender or admin. Writes only through functions.
- Functions: `send_message` (signed in, active, 20/day), `mark_message_seen`, `decide_message`, `message_sender_email` (admin only, reads auth.users), `decide_place_flags` (admin; closes every open report on one place or shop, one note per reporter).
- `notifications` grows `flag_id`, `message_id` and the four kinds.

Tests: `packages/supabase/test/tell-us-sql.test.ts` (PGlite), `apps/app/lib/tell-us/sent.test.ts`.

## Left out

- Picking a shop inside Tell us without coming from it: the row sends you to the map, where every card has "Something off?". Add a search picker if people get stuck there.
- In-app replies and threads: replies are email by decision.
- Screenshots on bug reports.
- Desktop opens Tell us as a centered column (like Add a shop), not inside the map panel.
