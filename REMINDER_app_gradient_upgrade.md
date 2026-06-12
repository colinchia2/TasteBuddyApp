# REMINDER — app gradient upgrade (deferred to a native build)

The web Taste Card (persona profile hero) uses a 3-stop CSS gradient background
(`--persona-card-1/2/3`: `#FFF9ED → #FBEAC6 → #F4D89B`). React Native has **no
native CSS gradient**, so the app currently approximates it with a **solid fill**
(`COLORS.personaCardFill = #FBEAC6`).

## To match the web gradient on the app
1. Add the dep: `npx expo install expo-linear-gradient` — this is a **native
   module**, so it ships only via a **full `eas build` + `eas submit`**, NEVER OTA.
2. In `PersonaProfileScreen.js`, replace the Taste Card's solid `backgroundColor`
   (`styles.tasteCard`) with:
   ```jsx
   import { LinearGradient } from 'expo-linear-gradient';
   <LinearGradient colors={['#FFF9ED', '#FBEAC6', '#F4D89B']}
                   start={{x:0,y:0}} end={{x:1,y:1}} style={styles.tasteCard}>
     …card contents…
   </LinearGradient>
   ```
   Keep the border (`#E6BE5E`), radius (24), and shadow as-is.

## Radar
The radar's **SVG `<radialGradient>` fill** already ships OTA (react-native-svg
renders it) — that does NOT need this upgrade. The only deferred piece is the
**card background** gradient.

## Glow (separate caveat)
The radar's `feGaussianBlur` edge glow is flaky in react-native-svg; the app
currently ships **gradient-only (no glow)** on the radar as the safe fallback.
Web keeps the full glow. Re-evaluate the glow at the same time if desired.

Created 2026-06-11 (BUILD LOG #69).
