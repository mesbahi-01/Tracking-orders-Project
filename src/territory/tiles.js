// crossOrigin: tiles are fetched with CORS (all three servers send
// Access-Control-Allow-Origin) so the service worker can store real, checkable
// responses instead of opaque ones that Chrome pads to ~7 MB each in quota.
export const TILE_LAYERS = {
  streets: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors', maxZoom: 19, crossOrigin: 'anonymous' },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
    crossOrigin: 'anonymous',
  },
  labels: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    crossOrigin: 'anonymous',
  },
}
export const DEFAULT_CENTER = [35.43, -5.98]
export const DEFAULT_ZOOM = 11
