# Phase 3 — App Parity Spec (Same-Name "Group vs New Entry")

Source of truth for mirroring the web flow onto the app. Web (Phases 1/2/2.1) is
live; the backend is shared. App = **My Places Lite**: full add/log/group flow,
but **view-only** for management (no per-member edit, no label edit, no
remove-category, **no ungroup** — those live on the web).

## Flow (identical to web)
1. **Pick place → pre-check → [decision] → category.**
   `GET /api/places/check-group-conflict?name&google_place_id&address`
   → `{conflict: {existing:{place_id,slug,display_name,address,google_place_id,in_group_id}, incoming:{name,google_place_id}} | null}`.
   Fail-open: on error → normal category step (server still backstops).
2. **No conflict** → today's category/cuisine step.
3. **Conflict** → Decision dialog (before any category UI).

## Decision dialog (verbatim copy)
- Title: **You already have a place by this name**
- Body: **{existing_name} is already in your list — at {existing_address}. The one you're adding is at {incoming_address}.**
- Group: **Same place, different location** / "Track both locations under one ranking — you'll still log visits to each." / **Group locations**. If `in_group_id`: **Add to your {existing_name} group** / "This joins the locations you're already tracking together." / **Add to group**.
- New: **A different place that shares the name** / "Add it separately and give each a name to tell them apart." / **Add as separate**.
- Cancel = no place created.

### Group branch
1. `add-mobile` with `group_aware:true, group_with_place_id=<existing>, place_only:true`
   → creates the incoming places row (keep location-confirm panel for a brand-new place) + groups it; **no user_places** for the new location.
2. Optional add-category screen: yellow note "You already track these for this Place:"
   + Category(blue)+Cuisine(grey) pills + "Would you like to add more Categories?".
   Skip → done. Add → `POST /api/places/<canonical>/add-category-mobile {category_id,cuisine,tier}`.

### New Entry branch
1. `add-mobile` with `group_aware:true, force_new:true, place_only:true`.
2. Rename screen: **Name each location** / "Give each a label so they're easy to tell apart in your list." / two rows (muted address + input prefilled with current name) / **Save names** (`POST /api/places/<id>/label {display_name_override}`) / **Skip**.
3. Then the normal category step (`force_new` add-mobile with `categories[]`).

## Log a Visit (already works via backend)
`loadCategories` fetches `/api/places/<id>/categories-mobile` (group-aware → a bare
grouped location returns the canonical's categories). Visit saves against the picked
`place_id` (per-location); backend accepts the canonical's `user_place_tiers` rows.

## View surfaces (read-only)
- **PlaceCardModal / Rankings card**: `{N} locations`, one tier badge per category,
  per-member Map/Directions from `locations[]` (canonical first), label-override name.
- **Activity feed**: render the `detail` field ("Address Added") on new_place items.

## Gotchas
1. A grouped new location has **no user_places** — a bare linked address. Don't assume a ranking row.
2. Actions use the gpid's **own** place_id (per-location); navigation/categories use the **canonical**. Don't collapse.
3. Display name = per-user label override, never the catalog name.
4. Decision comes **before** category.

## Tokens (src/constants/colors.js — already present)
Category `#85B7EB`/`#042C53`, Cuisine `#B4B2A9`/`#2C2C2A` (no borders), gold `#C8960C`,
confirm/note box `#FEFCE8`/`#713F12`.
