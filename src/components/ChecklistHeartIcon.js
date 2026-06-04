import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Outline checklist (clipboard with checkmarks) + a heart badge in the corner —
// the "your activity / your taste" icon. Matches the app's outline aesthetic.
export default function ChecklistHeartIcon({ size = 24, color = '#1A1A1A', strokeWidth = 1.8 }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Document (open at bottom-right where the heart sits) */}
      <Path d="M14.5 20H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v7" {...p} />
      {/* Row 1 — check + line */}
      <Path d="M6.4 7l1 1 1.8-2" {...p} />
      <Path d="M11 6.5h3.6" {...p} />
      {/* Row 2 */}
      <Path d="M6.4 11.5l1 1 1.8-2" {...p} />
      <Path d="M11 11h3.6" {...p} />
      {/* Row 3 */}
      <Path d="M6.4 16l1 1 1.8-2" {...p} />
      <Path d="M11 15.5h2.6" {...p} />
      {/* Heart badge (bottom-right) */}
      <Path d="M18.4 22.3l-3.05-3.1a2 2 0 0 1 2.83-2.82l.22.22.22-.22a2 2 0 1 1 2.83 2.82z" {...p} />
    </Svg>
  );
}
