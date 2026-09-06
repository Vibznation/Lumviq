// Centralized brand configuration.
// "Lumviq" is a working name — change values here (not throughout the codebase)
// if the product is renamed.
export const brand = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Lumviq',
  tagline: 'Clarity behind every number.',
  pronunciation: 'LUM-vik',
} as const

export type Brand = typeof brand
