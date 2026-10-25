import type { PosterStyle } from '@/lib/poster-renderer/types';
import { buildStyle } from './styleBuilder';
import { organicPalettes } from './extra-palettes';

const defaultPalette = organicPalettes[0];

export const organicStyle: PosterStyle = buildStyle({
  id: 'organic',
  name: 'Organic / Nature',
  description: 'Grounded maps with rich forest greens, desert earths, and ocean depths',
  defaultPalette: defaultPalette,
  palettes: organicPalettes,
  recommendedFonts: ['Outfit', 'Crimson Pro', 'Fraunces', 'Bricolage Grotesque'],
  variant: 'organic',
  overrides: {
    base: {
      waterFilter: ['all', ['!=', ['get', 'class'], 'pier'], ['!=', ['get', 'brunnel'], 'bridge']],
      waterOpacity: 1.0,
      waterwayOpacity: 0.8,
      parkOpacity: 0.9,
      buildingsOpacity: 0.3,
    },
    terrain: {
      hillshadeShadowColor: defaultPalette.roads.secondary,
      hillshadeHighlightColor: defaultPalette.background,
      hillshadeAccentColor: defaultPalette.roads.secondary,
      hillshadeExaggeration: 0.5,
    },
  },
});
