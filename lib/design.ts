// Shared design tokens for Oporto Weekly — travel magazine theme.
// Single source of truth for colors, spacing, typography.

export const colors = {
  // Backgrounds
  bg: '#faf7f0',         // warm cream — page background
  bgAlt: '#efe8da',      // darker cream — alt sections, footer
  bgSoft: '#f4ede0',     // very soft cream — tip box, callouts
  card: '#ffffff',       // pure white — cards
  divider: '#e5dfd3',    // warm beige — subtle dividers/borders

  // Text
  text: '#1a1a1a',       // near-black — body text
  textSoft: '#5a5a5a',   // mid gray — secondary text
  textMuted: '#8a8170',  // warm gray — copyright/fine print

  // Brand
  heading: '#1a1a2e',    // dark navy — titles/headings (kept for contrast)
  accent: '#c9a96e',     // gold — primary accent
  accentSoft: '#d4bb87', // lighter gold — hover/alt

  // Rarely used dark (only for hero overlays or inverse boxes)
  dark: '#1a1a2e',
} as const;

export const typography = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
} as const;

export const spacing = {
  pageMaxWidth: 1080,
  contentMaxWidth: 720,
} as const;
