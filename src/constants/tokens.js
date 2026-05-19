// Design tokens — mirrors design_tokens.css and app/static/css/main.css :root vars

export const colors = {
  // Brand
  gold:       '#C8960C',
  goldBright: '#E8B020',
  goldLight:  '#FAEEDA',
  burgundy:   '#791F1F',
  sage:       '#27500A',

  // UI
  white:      '#FFFFFF',
  offWhite:   '#FAFAF8',
  bgDeep:     '#FFFFFF',
  border:     '#E0DDD8',
  borderLight:'#F5F3F0',

  // Text
  text:       '#1A1A1A',
  textMuted:  '#888888',
  textLight:  '#BBBBBB',

  // Status
  danger:     '#E24B4A',
  dangerLight:'#FCEBEB',

  // Tiers — background / text pairs
  tier: {
    S:       { bg: '#FAEEDA', text: '#633806', label: 'S Tier' },
    A:       { bg: '#EAF3DE', text: '#27500A', label: 'A Tier' },
    B:       { bg: '#E6F1FB', text: '#0C447C', label: 'B Tier' },
    C:       { bg: '#F1EFE8', text: '#5F5E5A', label: 'C Tier' },
    NEXT_UP: { bg: '#FCEBEB', text: '#791F1F', label: 'Next Up' },
    TBE:     { bg: '#FEFCE8', text: '#713F12', label: 'TBE'     },
  },
};

export const fonts = {
  heading: 'Outfit_700Bold',
  headingXBold: 'Outfit_800ExtraBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 99,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
