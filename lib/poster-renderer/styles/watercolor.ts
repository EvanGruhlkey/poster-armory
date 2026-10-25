import type { PosterStyle, ColorPalette } from '@/lib/poster-renderer/types';
import { buildStyle } from './styleBuilder';

const coastalPalette: ColorPalette = {
  id: 'watercolor-coastal',
  name: 'Coastal Wash',
  style: 'watercolor',
  
  background: '#FAF8F5',
  text: '#4A5568',
  border: '#9CA5A8',
  
  roads: {
    motorway: '#5A6068',
    trunk: '#6E7078',
    primary: '#787880',
    secondary: '#8A8C90',
    tertiary: '#9CA0A0',
    residential: '#B8BCBC',
    service: '#C8CCCC',
  },
  
  water: '#7BA3B8',
  waterLine: '#5D8AA0',
  greenSpace: '#A8B89C',
  landuse: '#F0EDE5',
  buildings: '#E8E0D8',
  
  accent: '#9CA5A8',
};

const defaultPalette = coastalPalette;

const springPalette: ColorPalette = {
  id: 'watercolor-spring',
  name: 'Spring Garden',
  style: 'watercolor',
  
  background: '#FFFEF9',
  text: '#4A4540',
  border: '#8A9080',
  
  roads: {
    motorway: '#4A4540',
    trunk: '#5C524C',
    primary: '#6A605A',
    secondary: '#7A7570',
    tertiary: '#8B8680',
    residential: '#A8A4A0',
    service: '#C0BCBA',
  },
  
  water: '#89A8C4',
  waterLine: '#6090B0',
  greenSpace: '#8AB888',
  landuse: '#F8F5EC',
  buildings: '#ECE8E0',
  
  accent: '#8AB888',
};

const sunsetPalette: ColorPalette = {
  id: 'watercolor-sunset',
  name: 'Sunset Wash',
  style: 'watercolor',
  
  background: '#FDF8F4',
  text: '#5A4A48',
  border: '#B89890',
  
  roads: {
    motorway: '#5A4A48',
    trunk: '#6A5A58',
    primary: '#7A6A68',
    secondary: '#8A7A78',
    tertiary: '#9A8A88',
    residential: '#B8A8A8',
    service: '#D0C0C0',
  },
  
  water: '#90A0B8',
  waterLine: '#7088A0',
  greenSpace: '#B8C0A0',
  landuse: '#F8F0E8',
  buildings: '#F0E8E0',
  
  accent: '#C8A090',
};

const duskPalette: ColorPalette = {
  id: 'watercolor-dusk',
  name: 'Dusk',
  style: 'watercolor',
  
  background: '#FAF8FA',
  text: '#4A4048',
  border: '#908088',
  
  roads: {
    motorway: '#4A4048',
    trunk: '#5A5058',
    primary: '#6A6068',
    secondary: '#7A7078',
    tertiary: '#908088',
    residential: '#A898A0',
    service: '#C0B8BC',
  },
  
  water: '#9090B8',
  waterLine: '#7070A0',
  greenSpace: '#A8A898',
  landuse: '#F4F2F4',
  buildings: '#EAE8EC',
  
  accent: '#9090B8',
};

const sumiPalette: ColorPalette = {
  id: 'watercolor-sumi',
  name: 'Sumi-e',
  style: 'watercolor',
  
  background: '#FAF9F6',
  text: '#2A2828',
  border: '#6A6868',
  
  roads: {
    motorway: '#2A2828',
    trunk: '#3A3838',
    primary: '#4A4848',
    secondary: '#5A5858',
    tertiary: '#6A6868',
    residential: '#8A8888',
    service: '#A8A8A8',
  },
  
  water: '#A8B0B0',
  waterLine: '#788888',
  greenSpace: '#C8C8C0',
  landuse: '#F2F1EE',
  buildings: '#E8E8E4',
  
  accent: '#6A6868',
};

const botanicalPalette: ColorPalette = {
  id: 'watercolor-botanical',
  name: 'Botanical',
  style: 'watercolor',
  
  background: '#FAFAF5',
  text: '#2A3A2A',
  border: '#5A7058',
  
  roads: {
    motorway: '#2A3A2A',
    trunk: '#3A4A3A',
    primary: '#4A5A4A',
    secondary: '#5A6A5A',
    tertiary: '#6A7A6A',
    residential: '#8A9A8A',
    service: '#A8B8A8',
  },
  
  water: '#7090A8',
  waterLine: '#507888',
  greenSpace: '#7AA870',
  landuse: '#F4F5F0',
  buildings: '#E8EAE4',
  
  accent: '#5A7058',
};

export const watercolorStyle: PosterStyle = buildStyle({
  id: 'watercolor',
  name: 'Watercolor / Painted',
  description: 'Soft, organic maps with diffuse edges and a hand-painted feel',
  defaultPalette: defaultPalette,
  palettes: [
    coastalPalette, 
    springPalette, 
    sunsetPalette, 
    duskPalette, 
    sumiPalette, 
    botanicalPalette
  ],
  recommendedFonts: ['Quicksand', 'Nunito', 'Pacifico', 'Caveat'],
  variant: 'watercolor',
  overrides: {
    base: {
      waterOpacity: 0.7,
      parkOpacity: 0.6,
      buildingsOpacity: 0.2,
    },
    terrain: {
      hillshadeExaggeration: 0.4,
      hillshadeShadowColor: defaultPalette.secondary,
      hillshadeHighlightColor: defaultPalette.background,
      hillshadeAccentColor: defaultPalette.secondary,
    },
    roads: {
      lineCap: 'round',
      lineJoin: 'round',
    },
    labels: {
      countrySize: [2, 10, 6, 18],
      stateSize: [3, 9, 8, 16],
      citySize: [4, 8, 12, 14],
    },
  },
});
