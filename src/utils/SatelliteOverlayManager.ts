/**
 * Satellite Overlay Manager for Waves Marine Navigation
 * Manages different satellite imagery sources and overlay options
 */

export interface SatelliteSource {
  id: string;
  name: string;
  description: string;
  attribution: string;
  maxZoom: number;
  tileSize: number;
  url: string;
  requiresApiKey: boolean;
  cost: 'free' | 'paid';
  quality: 'standard' | 'high' | 'premium';
}

export const SATELLITE_SOURCES: SatelliteSource[] = [
  {
    id: 'mapbox-satellite',
    name: 'MapBox Satellite',
    description: 'High-resolution global satellite imagery',
    attribution: '© Mapbox © OpenStreetMap',
    maxZoom: 22,
    tileSize: 512,
    url: 'mapbox://mapbox.satellite',
    requiresApiKey: true,
    cost: 'paid',
    quality: 'premium'
  },
  {
    id: 'esri-world-imagery',
    name: 'ESRI World Imagery',
    description: 'Free global satellite and aerial imagery',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    tileSize: 256,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    requiresApiKey: false,
    cost: 'free',
    quality: 'high'
  },
  {
    id: 'google-satellite',
    name: 'Google Satellite',
    description: 'Google Earth satellite imagery',
    attribution: '© Google',
    maxZoom: 20,
    tileSize: 256,
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    requiresApiKey: true,
    cost: 'paid',
    quality: 'premium'
  },
  {
    id: 'carto-positron',
    name: 'CARTO Light',
    description: 'Clean base map good for overlays',
    attribution: '© CARTO © OpenStreetMap',
    maxZoom: 20,
    tileSize: 256,
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    requiresApiKey: false,
    cost: 'free',
    quality: 'standard'
  }
];

export interface OverlaySettings {
  baseMap: string;
  satelliteEnabled: boolean;
  satelliteOpacity: number;
  chartOverlay: boolean;
  chartOpacity: number;
  depthDataOverlay: boolean;
  showShallowWaterHighlight: boolean;
  nightModeInversion: boolean;
}

export class SatelliteOverlayManager {
  private currentSettings: OverlaySettings;
  private mapInstance: any; // MapBox map instance
  
  constructor(mapInstance: any) {
    this.mapInstance = mapInstance;
    this.currentSettings = {
      baseMap: 'esri-world-imagery',
      satelliteEnabled: true,
      satelliteOpacity: 1.0,
      chartOverlay: true,
      chartOpacity: 0.7,
      depthDataOverlay: true,
      showShallowWaterHighlight: true,
      nightModeInversion: false
    };
  }

  /**
   * Add satellite source to map
   */
  addSatelliteSource(sourceId: string): void {
    const source = SATELLITE_SOURCES.find(s => s.id === sourceId);
    if (!source) return;

    if (this.mapInstance.getSource(sourceId)) {
      return; // Source already exists
    }

    const sourceConfig: any = {
      type: 'raster',
      tileSize: source.tileSize
    };

    if (source.id === 'mapbox-satellite') {
      sourceConfig.url = source.url;
    } else {
      sourceConfig.tiles = [source.url.replace(/\{s\}/g, 'a')];
    }

    this.mapInstance.addSource(sourceId, sourceConfig);
  }

  /**
   * Add satellite layer to map
   */
  addSatelliteLayer(sourceId: string, opacity: number = 1.0): void {
    const layerId = `${sourceId}-layer`;
    
    if (this.mapInstance.getLayer(layerId)) {
      return; // Layer already exists
    }

    this.mapInstance.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {
        'raster-opacity': opacity
      }
    });
  }

  /**
   * Switch between different satellite sources
   */
  switchSatelliteSource(sourceId: string): void {
    // Remove current satellite layers
    SATELLITE_SOURCES.forEach(source => {
      const layerId = `${source.id}-layer`;
      if (this.mapInstance.getLayer(layerId)) {
        this.mapInstance.removeLayer(layerId);
      }
    });

    // Add new satellite source and layer
    this.addSatelliteSource(sourceId);
    this.addSatelliteLayer(sourceId, this.currentSettings.satelliteOpacity);
    
    this.currentSettings.baseMap = sourceId;
  }

  /**
   * Add NOAA chart overlay
   */
  addChartOverlay(opacity: number = 0.7): void {
    const chartSourceId = 'noaa-charts';
    const chartLayerId = 'noaa-chart-overlay';

    if (!this.mapInstance.getSource(chartSourceId)) {
      this.mapInstance.addSource(chartSourceId, {
        type: 'raster',
        tiles: [
          'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'NOAA Office of Coast Survey'
      });
    }

    if (!this.mapInstance.getLayer(chartLayerId)) {
      this.mapInstance.addLayer({
        id: chartLayerId,
        type: 'raster',
        source: chartSourceId,
        paint: {
          'raster-opacity': opacity
        }
      });
    }
  }

  /**
   * Update satellite opacity
   */
  setSatelliteOpacity(opacity: number): void {
    this.currentSettings.satelliteOpacity = opacity;
    
    const currentLayerId = `${this.currentSettings.baseMap}-layer`;
    if (this.mapInstance.getLayer(currentLayerId)) {
      this.mapInstance.setPaintProperty(currentLayerId, 'raster-opacity', opacity);
    }
  }

  /**
   * Update chart overlay opacity
   */
  setChartOpacity(opacity: number): void {
    this.currentSettings.chartOpacity = opacity;
    
    if (this.mapInstance.getLayer('noaa-chart-overlay')) {
      this.mapInstance.setPaintProperty('noaa-chart-overlay', 'raster-opacity', opacity);
    }
  }

  /**
   * Toggle chart overlay visibility
   */
  toggleChartOverlay(visible: boolean): void {
    this.currentSettings.chartOverlay = visible;
    
    if (this.mapInstance.getLayer('noaa-chart-overlay')) {
      this.mapInstance.setLayoutProperty(
        'noaa-chart-overlay', 
        'visibility', 
        visible ? 'visible' : 'none'
      );
    } else if (visible) {
      this.addChartOverlay(this.currentSettings.chartOpacity);
    }
  }

  /**
   * Add shallow water highlighting
   */
  addShallowWaterHighlight(): void {
    // This would integrate with depth data to highlight areas < vessel draft + safety margin
    const shallowWaterFilter = [
      'all',
      ['<', ['get', 'depth'], 10], // Less than 10 feet
      ['>', ['get', 'confidence'], 0.5] // Confidence > 50%
    ];

    if (!this.mapInstance.getLayer('shallow-water-highlight')) {
      this.mapInstance.addLayer({
        id: 'shallow-water-highlight',
        type: 'circle',
        source: 'depth-data',
        filter: shallowWaterFilter,
        paint: {
          'circle-color': '#ef4444',
          'circle-radius': 8,
          'circle-opacity': 0.6,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  }

  /**
   * Apply night mode filter (red tint for night navigation)
   */
  applyNightMode(enabled: boolean): void {
    this.currentSettings.nightModeInversion = enabled;
    
    // Apply red filter for night navigation
    const layers = [
      `${this.currentSettings.baseMap}-layer`,
      'noaa-chart-overlay'
    ];

    layers.forEach(layerId => {
      if (this.mapInstance.getLayer(layerId)) {
        if (enabled) {
          this.mapInstance.setPaintProperty(layerId, 'raster-hue-rotate', 0);
          this.mapInstance.setPaintProperty(layerId, 'raster-saturation', -0.8);
          this.mapInstance.setPaintProperty(layerId, 'raster-contrast', -0.2);
        } else {
          this.mapInstance.setPaintProperty(layerId, 'raster-hue-rotate', 0);
          this.mapInstance.setPaintProperty(layerId, 'raster-saturation', 0);
          this.mapInstance.setPaintProperty(layerId, 'raster-contrast', 0);
        }
      }
    });
  }

  /**
   * Get current overlay settings
   */
  getSettings(): OverlaySettings {
    return { ...this.currentSettings };
  }

  /**
   * Update all settings
   */
  updateSettings(settings: Partial<OverlaySettings>): void {
    this.currentSettings = { ...this.currentSettings, ...settings };
    
    // Apply changes
    if (settings.baseMap && settings.baseMap !== this.currentSettings.baseMap) {
      this.switchSatelliteSource(settings.baseMap);
    }
    
    if (settings.satelliteOpacity !== undefined) {
      this.setSatelliteOpacity(settings.satelliteOpacity);
    }
    
    if (settings.chartOverlay !== undefined) {
      this.toggleChartOverlay(settings.chartOverlay);
    }
    
    if (settings.chartOpacity !== undefined) {
      this.setChartOpacity(settings.chartOpacity);
    }
    
    if (settings.nightModeInversion !== undefined) {
      this.applyNightMode(settings.nightModeInversion);
    }
    
    if (settings.showShallowWaterHighlight) {
      this.addShallowWaterHighlight();
    }
  }

  /**
   * Get available satellite sources with their capabilities
   */
  getAvailableSources(): SatelliteSource[] {
    return SATELLITE_SOURCES;
  }

  /**
   * Check if source requires API key
   */
  requiresApiKey(sourceId: string): boolean {
    const source = SATELLITE_SOURCES.find(s => s.id === sourceId);
    return source?.requiresApiKey || false;
  }
}

export default SatelliteOverlayManager;