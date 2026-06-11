export const COLORS = {
  gold: '#C8960C',
  goldLight: '#FAEEDA',
  white: '#FFFFFF',
  offWhite: '#FAFAF8',
  border: '#E0DDD8',
  borderLight: '#F5F3F0',
  text: '#1A1A1A',
  textMuted: '#888888',
  textLight: '#BBBBBB',
  danger: '#E24B4A',
  dangerLight: '#FCEBEB',

  tierS: '#FAEEDA',
  tierSText: '#633806',
  tierA: '#EAF3DE',
  tierAText: '#27500A',
  tierB: '#E6F1FB',
  tierBText: '#0C447C',
  tierC: '#F1EFE8',
  tierCText: '#5F5E5A',
  tierNextUp: '#FCEBEB',
  tierNextUpText: '#791F1F',
  tierTBE: '#FEFCE8',
  tierTBEText: '#713F12',

  // Pills — must match design_tokens.css (--pill-cat-* / --pill-cui-*). No borders.
  pillCatBg: '#85B7EB',
  pillCatText: '#042C53',
  pillCuiBg: '#B4B2A9',
  pillCuiText: '#2C2C2A',

  // Taste DNA radar — must match design_tokens.css (--dna-radar-grid / --dna-radar-ink)
  dnaRadarGrid: '#ECE8E0',
  dnaRadarInk: '#1C1A17',

  // Tastie Persona decorative — must match design_tokens.css (--persona-*).
  // App has no gradient lib, so these are flat approximations of the web
  // gradients (medallion = warm gold, Ask-AI block = dark warm).
  personaMedallion: '#F6E3B8',     // flat fill ≈ the web medallion radial
  personaMedallionLabel: '#9A7212',
  personaAiDark: '#2E271D',        // flat ≈ the web Ask-AI dark gradient
  personaAiSub: '#D7CBB4',
};

export const TIER_COLORS = {
  S: { bg: '#FAEEDA', text: '#633806', label: 'S Tier' },
  A: { bg: '#EAF3DE', text: '#27500A', label: 'A Tier' },
  B: { bg: '#E6F1FB', text: '#0C447C', label: 'B Tier' },
  C: { bg: '#F1EFE8', text: '#5F5E5A', label: 'C Tier' },
  NEXT_UP: { bg: '#FCEBEB', text: '#791F1F', label: 'Next Up' },
  TBE: { bg: '#FEFCE8', text: '#713F12', label: 'TBE' },
};
