import type { PosterStyle } from '@/lib/poster-renderer/types';
import { buildStyle } from './styleBuilder';
import { atmosphericPalettes } from './extra-palettes';

const defaultPalette = atmosphericPalettes[0];

export const atmosphericStyle: PosterStyle = buildStyle({
  id: 'atmospheric',
  name: 'Atmospheric / Ethereal',
  description: 'Soft, luminous maps with hazy gradients and sunset tones',
  defaultPalette: defaultPalette,
  palettes: atmosphericPalettes,
  recommendedFonts: ['Outfit', 'Montserrat', 'Quicksand', 'Lexend'],
  variant: 'atmospheric',
  overrides: {
    base: {
      waterFilter: ['all', ['!=', ['get', 'class'], 'pier'], ['!=', ['get', 'brunnel'], 'bridge']],
      waterOpacity: 0.8,
      waterwayOpacity: 0.9,
      parkOpacity: 0.4,
      buildingsOpacity: 0.2,
    },
    terrain: {
      hillshadeShadowColor: defaultPalette.roads.secondary,
      hillshadeHighlightColor: defaultPalette.background,
      hillshadeAccentColor: defaultPalette.roads.secondary,
      hillshadeExaggeration: 0.8,
    },
  },
});
