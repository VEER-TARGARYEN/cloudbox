// A small, central design token set so every screen looks consistent.
// (No UI library — just a tidy dark theme we control entirely.)

export const colors = {
  bg: '#0B1220', // app background
  surface: '#111A2E', // cards / inputs
  primary: '#4F8CFF', // brand / buttons
  primaryText: '#FFFFFF',
  text: '#E6EAF2', // main foreground text
  muted: '#8A95A8', // secondary text / placeholders
  border: '#22304A',
  danger: '#FF5C7A',
};

// 8-point spacing scale: spacing(2) === 16px. Keeps margins/paddings rhythmic.
export const spacing = (n: number) => n * 8;

export const radius = {
  md: 12,
  lg: 16,
};
