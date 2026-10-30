import { Tone } from "@/generated/prisma/enums";

/** Cover letter tones (NEW-6, SET-6), with the sign-off each one uses (APP-10). */
export const TONES: Record<Tone, { label: string; description: string; signOff: string }> = {
  [Tone.WARM]: { label: "Herzlich", description: "Persönlich und positiv.", signOff: "Warm regards," },
  [Tone.DIRECT]: { label: "Direkt", description: "Kurze Sätze, auf den Punkt.", signOff: "Best," },
  [Tone.FORMAL]: { label: "Förmlich", description: "Klassisch und geschliffen.", signOff: "Kind regards," },
};
