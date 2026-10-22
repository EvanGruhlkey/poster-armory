import type { PosterStyle, ColorPalette } from '@/lib/poster-renderer/types';
import { buildStyle } from './styleBuilder';

const defaultPalette: ColorPalette = {
  id: 'midnight-classic',
  name: 'Midnight',
  style: 'midnight',
  
  background: '#0D1B2A', // deep navy
  text: '#E0E1DD',
  border: '#E0E1DD',
  
  roads: {
    motorway: '#E0E1DD',
    trunk: '#D0D1CD',
    primary: '#C0C1BD',
    secondary: '#A0A090',
    tertiary: '#808070',
    residential: '#606050',
    service: '#404030',
  },
  
  water: '#1B263B',      // slightly lighter navy
  waterLine: '#1B263B',
  greenSpace: '#1B263B', // same as water
  landuse: '#0D1B2A',
  buildings: '#1B263B',
  
  accent: '#E0E1DD',
};

export const midnightStyle: PosterStyle = buildStyle({
  id: 'midnight',
  name: 'Midnight Noir',
  description: 'Deep navy and ivory technical maps with a high-end feel',
  defaultPalette: defaultPalette,
  palettes: [defaultPalette],
  recommendedFonts: ['Outfit', 'Inter', 'DM Sans', 'Public Sans'],
  variant: 'midnight',
  overrides: {
    base: {
      waterOpacity: 0.6,
      populationOpacity: {
        stops: [[0, 0], [1, 0.05], [100, 0.15], [1000, 0.3], [10000, 0.5]],
      },
    },
    terrain: {
      hillshadeShadowColor: '#000000',
      hillshadeHighlightColor: defaultPalette.secondary,
      hillshadeAccentColor: '#000000',
      hillshadeExaggeration: 0.6,
    },
  },
});
