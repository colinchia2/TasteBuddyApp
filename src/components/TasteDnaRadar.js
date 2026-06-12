// Taste DNA radar — 6-spoke SHARP-polygon radar (react-native-svg, ships OTA).
// Lives inside the gold Taste Card (PersonaProfileScreen). Renders the SHARED
// /api/persona/<id>/taste-dna payload: axis order + pole labels come from the
// payload (the server's DNA_AXES constant) — nothing hardcoded. Geometry +
// styling mirror the web renderer in personas/public_profile.html: soft-gold
// grid, sharp (miter) polygon with an SVG radialGradient fill, haloed gold
// vertex dots, Pole A names at the rim. App OMITS the feGaussianBlur edge glow
// (flaky in react-native-svg) — gradient-only fallback; web keeps the glow.
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText,
  Defs, RadialGradient, Stop } from 'react-native-svg';
import { COLORS } from '../constants/colors';

const GOLD = COLORS.gold;                   // #C8960C
const GRID = 'rgba(200,150,12,0.20)';       // soft-gold grid on the Taste Card
const INK = COLORS.dnaRadarInk;             // #1C1A17

export default function TasteDnaRadar({ dna, size = 320 }) {
  if (!dna || !Array.isArray(dna.axes) || !dna.axes.length) return null;
  const axes = dna.axes;
  const n = axes.length;
  const CX = size / 2;
  const CY = size / 2;
  const R = size / 2 - 62;   // leave room for rim labels

  const pt = (i, frac) => {  // axis 0 at top, clockwise — same as web
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [CX + R * frac * Math.cos(ang), CY + R * frac * Math.sin(ang)];
  };

  const ringPoints = (frac) =>
    axes.map((_, i) => pt(i, frac).join(',')).join(' ');
  const dataPts = axes.map((a, i) => pt(i, a.value / 100));

  // Lean line is built server-side (shared with web) — render dna.lean_line.
  // Fallback keeps an older payload working until the OTA lands.
  let leanLine = dna.lean_line;
  if (!leanLine) {
    const ranked = [...axes].sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50));
    const leans = ranked.slice(0, 2)
      .filter((a) => Math.abs(a.value - 50) >= 5)
      .map((a) => (a.value >= 50 ? a.pole_a : a.pole_b).toLowerCase());
    leanLine = leans.length ? `Leans ${leans.join(' and ')}` : 'Balanced across the board.';
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {/* Radial gradient fill — saturated gold center → soft edge (same as web). */}
          <RadialGradient id="dnaFill" cx="50%" cy="50%" r="62%">
            <Stop offset="0%" stopColor={GOLD} stopOpacity="0.6" />
            <Stop offset="100%" stopColor={GOLD} stopOpacity="0.1" />
          </RadialGradient>
        </Defs>
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <Polygon key={frac} points={ringPoints(frac)} fill="none" stroke={GRID} strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <Line key={`s${i}`} x1={CX} y1={CY} x2={x} y2={y} stroke={GRID} strokeWidth={1} />;
        })}
        {/* SHARP polygon (miter joins) + gradient fill. No glow on app (fallback). */}
        <Polygon
          points={dataPts.map((p) => p.join(',')).join(' ')}
          fill="url(#dnaFill)" stroke={GOLD} strokeWidth={2.5} strokeLinejoin="miter"
        />
        {/* Haloed vertex dots — gold fill + white ring. */}
        {dataPts.map((p, i) => (
          <Circle key={`d${i}`} cx={p[0]} cy={p[1]} r={4.5} fill={GOLD} stroke="#fff" strokeWidth={2} />
        ))}
        {/* Rim labels ONLY (pole_a at the vertices). The inner grey pole_b
            labels were dropped (decluttered) — the bipolar read now lives in the
            lean line below. Mirrors the web SVG renderer. */}
        {axes.map((a, i) => {
          const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
          const ax = CX + (R + 22) * Math.cos(ang);
          const ay = CY + (R + 22) * Math.sin(ang);
          const anchor = Math.abs(Math.cos(ang)) < 0.3 ? 'middle' : (Math.cos(ang) > 0 ? 'start' : 'end');
          return (
            <SvgText key={`l${i}`} x={ax} y={ay + 4} textAnchor={anchor} fontSize={11}
                     fontFamily="DMSans_700Bold" fill={INK}>{a.pole_a}</SvgText>
          );
        })}
      </Svg>
      <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: '#5a4a22', marginTop: 2 }}>
        {leanLine}
      </Text>
      {dna.low_confidence ? (
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>
          Still learning your taste — log more visits to sharpen this.
        </Text>
      ) : null}
    </View>
  );
}

/* SLIDER FALLBACK (stub — same payload, no backend change). If the bipolar
   radar tests poorly, swap <TasteDnaRadar dna={dna}/> → <TasteDnaSliders dna={dna}/>.
export function TasteDnaSliders({ dna }) {
  return (
    <View style={{ width: '100%' }}>
      {dna.axes.map((a) => (
        <View key={a.key} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
          <Text style={{ width: 88, textAlign: 'right', fontSize: 11, color: '#888', fontFamily: 'DMSans_400Regular' }}>{a.pole_b}</Text>
          <View style={{ flex: 1, height: 6, backgroundColor: COLORS.dnaRadarGrid, borderRadius: 3, marginHorizontal: 8 }}>
            <View style={{ position: 'absolute', top: -4, left: `${a.value}%`, marginLeft: -7,
                           width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.gold }} />
          </View>
          <Text style={{ width: 88, fontSize: 11, fontFamily: 'DMSans_700Bold', color: COLORS.dnaRadarInk }}>{a.pole_a}</Text>
        </View>
      ))}
    </View>
  );
}
*/
