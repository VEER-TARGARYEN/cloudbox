---
name: Aura Precision
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464555'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#5b5e6a'
  on-secondary: '#ffffff'
  secondary-container: '#dddfee'
  on-secondary-container: '#5f626f'
  tertiary: '#46494b'
  on-tertiary: '#ffffff'
  tertiary-container: '#5e6163'
  on-tertiary-container: '#dadcde'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#e0e2f0'
  secondary-fixed-dim: '#c3c6d4'
  on-secondary-fixed: '#181b26'
  on-secondary-fixed-variant: '#434652'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-padding: 20px
  gutter: 12px
---

## Brand & Style
The design system is built on a foundation of **Modern Minimalism** with a focus on high-end utility, drawing inspiration from the precision of developer tools like Linear and the calm clarity of Things. The brand personality is efficient, sophisticated, and trustworthy.

The UI evokes a sense of "digital air"—generous whitespace is used not just as a margin, but as a functional element to reduce cognitive load. The aesthetic relies on structural integrity through hairline borders and subtle tonal shifts rather than heavy shadows or decorative flourishes. It is designed to feel like a premium tool that prioritizes the user's data and tasks above the interface itself.

## Colors
The palette is rooted in a crisp white base to maximize the "airy" feel. 
- **Primary Indigo** is reserved for high-intent actions and active states, ensuring clear signposting without overwhelming the view. 
- **Secondary Tint** acts as a soft highlight for background containers or selected list items.
- **Surface Tones** use a cool-gray off-white to subtly differentiate cards and sections from the main background.
- **Borders** utilize a hairline weight to provide structure while remaining nearly invisible, maintaining the minimalist aesthetic.

## Typography
This design system utilizes **Inter** for its systematic, utilitarian precision. 
- **Headings** use tight letter-spacing and bold weights to create a strong visual anchor on the page.
- **Body Text** is set with generous line-height to ensure readability during long-form data consumption.
- **Labels** utilize a medium weight to maintain legibility at smaller sizes, often used for metadata or secondary navigation.
- **Mobile scaling** ensures that large displays do not crowd the narrow viewport of Android devices, shifting from 32px to 28px where necessary.

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for mobile. 
- **Standard Margin:** 20px on the left and right of the screen to provide a comfortable frame.
- **Vertical Rhythm:** Elements are spaced in multiples of 4px, with 16px being the default gap for related items and 32px for distinct sections.
- **Alignment:** All text elements should align to a consistent left axis to reinforce the "Linear" design influence.

## Elevation & Depth
This design system eschews traditional shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.
- **Surface Level 0:** The global background (#FFFFFF).
- **Surface Level 1:** Cards and input fields (#F8FAFC) with a 1px hairline border (#E8EBF0).
- **Interactive Depth:** When an element is pressed, it should not rise; instead, it should experience a subtle scale reduction (98%) or a slight color shift to the Light Accent Tint.
- **Overlays:** Modals and bottom sheets use a very soft, diffused 10% opacity shadow to provide context against the background without appearing heavy.

## Shapes
The shape language is defined by **Soft Roundedness**.
- **Cards & Containers:** 16px corner radius (`rounded-lg`) is the standard for all major surfaces.
- **Buttons & Inputs:** Use a full pill-shape (circular ends) to create a friendly, approachable touch target that contrasts with the structural grid.
- **Icons:** Must be "Material Symbols Rounded" with a **Thin (100-200)** weight and **20px** optical size to match the refined typography.

## Components
- **Buttons:** 
  - **Primary:** Full-width, pill-shaped, #4F46E5 background with white text.
  - **Secondary:** Pill-shaped, #EEF0FF background with #4F46E5 text.
- **Floating Action Button (FAB):** Circular, 56x56dp, Primary Indigo background with a white 24px thin-weight icon.
- **Input Fields:** Filled style using Surface Level 1 (#F8FAFC), 16px corner radius, and a subtle hairline border that turns Primary Indigo on focus.
- **List Rows:** 72dp height for primary lists. Icons should be housed in a 40px circular container with the Light Accent Tint (#EEF0FF).
- **Checkboxes/Radios:** Use the Primary Indigo color for the "Checked" state. Shapes should be slightly rounded even for checkboxes (4px radius).
- **Chips:** Small, pill-shaped tags with #F8FAFC background and #64748B text for filtering or categorization.