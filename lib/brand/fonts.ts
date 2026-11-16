/** Curated pairs that all exist on Google Fonts, so previews always render. */
export const FONT_PAIRS = [
  { id: "fraunces-inter", heading: "Fraunces", body: "Inter", feel: "warm editorial serif with a clean sans" },
  { id: "playfair-source", heading: "Playfair Display", body: "Source Sans 3", feel: "classic high-contrast serif, refined" },
  { id: "dmserif-dmsans", heading: "DM Serif Display", body: "DM Sans", feel: "friendly serif headlines, modern body" },
  { id: "spacegrotesk-inter", heading: "Space Grotesk", body: "Inter", feel: "technical, modern grotesk" },
  { id: "archivoblack-archivo", heading: "Archivo Black", body: "Archivo", feel: "loud, heavy, confident" },
  { id: "poppins", heading: "Poppins", body: "Poppins", feel: "round, friendly geometric" },
  { id: "bricolage-inter", heading: "Bricolage Grotesque", body: "Inter", feel: "characterful, contemporary" },
  { id: "cormorant-lato", heading: "Cormorant Garamond", body: "Lato", feel: "luxurious, delicate serif" },
  { id: "oswald-opensans", heading: "Oswald", body: "Open Sans", feel: "condensed, sturdy, rugged" },
  { id: "nunito", heading: "Nunito", body: "Nunito", feel: "soft, approachable, rounded" },
  { id: "sora-manrope", heading: "Sora", body: "Manrope", feel: "clean, startup-modern" },
  { id: "baskerville-karla", heading: "Libre Baskerville", body: "Karla", feel: "bookish, trustworthy" },
  { id: "bebas-montserrat", heading: "Bebas Neue", body: "Montserrat", feel: "punchy display, sporty" },
  { id: "lora-worksans", heading: "Lora", body: "Work Sans", feel: "gentle serif, honest and calm" },
] as const;

export const FONT_CHOICES: string[] = [...new Set<string>(FONT_PAIRS.flatMap((f) => [f.heading, f.body]))].sort();
