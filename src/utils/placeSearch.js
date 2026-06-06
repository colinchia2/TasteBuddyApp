// Blended place search — your matching SAVED places sort to the TOP (highlighted
// "In your list"), Google autocomplete results follow. De-duped by
// google_place_id so a saved place that is ALSO a Google hit appears ONCE.
//
// Surfacing saved matches is a DB lookup (/api/places/search-mine) — NO extra
// Google Places API calls beyond the autocomplete already happening. This is the
// app side of the same saved-on-top behavior the web uses, so the highlight,
// ordering, and de-dupe stay identical across platforms.
import { api } from '../api/client';

// Merge saved matches + Google results into one ordered, de-duped list.
// savedMatches: from /api/places/search-mine (each has google_place_id, place_id).
// googleResults: from /api/places/google-autocomplete (each already carries
// already_saved/place_id for hits the user has).
export function blendPlaceResults(savedMatches, googleResults) {
  const top = [];
  const topGpids = new Set();
  (savedMatches || []).forEach(s => {
    const gp = s.google_place_id || null;
    if (gp && topGpids.has(gp)) return;
    if (gp) topGpids.add(gp);
    top.push({
      google_place_id: gp,
      name: s.name,
      address: s.address || '',
      already_saved: true,
      place_id: s.place_id,
      saved_tier: s.tier || null,
    });
  });
  const bottom = [];
  (googleResults || []).forEach(g => {
    if (g.google_place_id && topGpids.has(g.google_place_id)) return; // de-dupe
    if (g.already_saved) {
      // A saved Google hit whose stored name didn't text-match — promote to top.
      if (g.google_place_id) topGpids.add(g.google_place_id);
      top.push(g);
    } else {
      bottom.push(g);
    }
  });
  return [...top, ...bottom];
}

// Run a blended search. Options:
//   lat/lng        — bias Google autocomplete toward the user's location.
//   savedNeedsGpid — only surface saved matches that have a google_place_id
//                    (use where the pick path needs one, e.g. GPS check-in).
export async function fetchBlendedPlaces(q, { lat, lng, savedNeedsGpid = false } = {}) {
  let googleUrl = `/api/places/google-autocomplete?q=${encodeURIComponent(q)}`;
  if (lat != null && lng != null) googleUrl += `&lat=${lat}&lng=${lng}`;
  const [saved, google] = await Promise.all([
    api.json(`/api/places/search-mine?q=${encodeURIComponent(q)}`).catch(() => []),
    api.json(googleUrl).catch(() => []),
  ]);
  let savedArr = Array.isArray(saved) ? saved : [];
  if (savedNeedsGpid) savedArr = savedArr.filter(s => s.google_place_id);
  return blendPlaceResults(savedArr, Array.isArray(google) ? google : []);
}
