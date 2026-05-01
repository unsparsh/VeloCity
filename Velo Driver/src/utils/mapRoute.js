import maplibregl from 'maplibre-gl'

const SOURCE_ID = 'ride-route'
const LAYER_ID = 'ride-route-line'

export function drawRouteOnMap(map, geometry, { fit = true } = {}) {
  if (!map || !geometry?.coordinates?.length) return

  const render = () => {
    try {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry },
      })

      map.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#18A558',
          'line-width': 4,
          'line-opacity': 0.85,
        },
      })

      if (fit && geometry.coordinates.length >= 2) {
        const bounds = geometry.coordinates.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(geometry.coordinates[0], geometry.coordinates[0])
        )
        map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 })
      }
    } catch (e) {
      /* Style may not be fully loaded — safe to ignore */
    }
  }

  if (map.isStyleLoaded()) render()
  else map.once('load', render)
}

export function clearRouteOnMap(map) {
  if (!map) return
  try {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
  } catch { /* ignore */ }
}
