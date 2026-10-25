import type { PosterStyle } from '@/lib/poster-renderer/types';
import { buildStyle } from './styleBuilder';
import { retroPalettes } from './extra-palettes';

const defaultPalette = retroPalettes[0];

export const retroStyle: PosterStyle = buildStyle({
  id: 'retro',
  name: 'Retro / Nostalgic',
  description: 'Bold, vibrant maps inspired by 70s earth tones, 80s neon, and 90s teal',
  defaultPalette: defaultPalette,
  palettes: retroPalettes,
  recommendedFonts: ['Outfit', 'Space Grotesk', 'Archivo Black', 'Righteous'],
  variant: 'retro',
  overrides: {
    base: {
      waterFilter: ['all', ['!=', ['get', 'class'], 'pier'], ['!=', ['get', 'brunnel'], 'bridge']],
      waterOpacity: 1.0,
      waterwayOpacity: 1.0,
      parkOpacity: 0.8,
      buildingsOpacity: 0.4,
    },
    terrain: {
      hillshadeShadowColor: defaultPalette.roads.secondary,
      hillshadeHighlightColor: defaultPalette.background,
      hillshadeAccentColor: defaultPalette.roads.secondary,
      hillshadeExaggeration: 0.3,
    },
  },
});
