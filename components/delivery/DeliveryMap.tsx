'use client'

import React, { useEffect, useRef } from 'react'

interface Driver {
  id: string
  email: string
  profile?: {
    firstName?: string
    lastName?: string
    phone?: string
  }
}

interface Delivery {
  id: string
  status: string
  estimatedDelivery?: string | null
  actualDelivery?: string | null
  currentLat?: number | string | null
  currentLng?: number | string | null
  locationUpdatedAt?: string | null
  driver?: Driver | null
  driverId?: string | null
}

interface DeliveryMapProps {
  delivery: Delivery
}

export default function DeliveryMap({ delivery }: DeliveryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const [map, setMap] = React.useState<any>(null)

  useEffect(() => {
    // Placeholder for Leaflet map implementation
    // In production, this would integrate with Leaflet:
    // import L from 'leaflet'
    // const map = L.map('map').setView([center], 13)
    // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

    // For now, display the coordinates and a placeholder message
    if (mapContainer.current) {
      // Initialize map when Leaflet is added to package.json
      console.log('DeliveryMap: Ready for Leaflet integration')
      console.log('Driver location:', {
        lat: delivery.currentLat,
        lng: delivery.currentLng,
      })
    }
  }, [delivery.currentLat, delivery.currentLng])

  const lat = Number(delivery.currentLat)
  const lng = Number(delivery.currentLng)

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Live Driver Location
      </h2>

      {/* Map Container - Placeholder for Leaflet */}
      <div
        ref={mapContainer}
        className="w-full h-96 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg flex items-center justify-center border-2 border-blue-200 relative"
      >
        <div className="text-center">
          <div className="text-blue-600 text-4xl mb-3">📍</div>
          <p className="text-blue-900 font-semibold mb-2">
            Driver Location Map
          </p>
          <p className="text-blue-700 text-sm mb-4">
            Coordinates: {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
          <div className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded text-xs font-medium">
            Leaflet map coming soon
          </div>
        </div>

        {/* Live Dot - shows driver position */}
        <div className="absolute animate-pulse">
          <div className="w-4 h-4 bg-blue-600 rounded-full" />
          <div className="absolute inset-0 w-4 h-4 bg-blue-400 rounded-full animate-ping" />
        </div>
      </div>

      {/* Location Details */}
      <div className="mt-6 space-y-3 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm">Latitude</span>
          <span className="font-mono font-semibold text-gray-900">
            {lat.toFixed(8)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm">Longitude</span>
          <span className="font-mono font-semibold text-gray-900">
            {lng.toFixed(8)}
          </span>
        </div>
        {delivery.locationUpdatedAt && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Last Updated</span>
            <span className="text-gray-900">
              {new Date(delivery.locationUpdatedAt).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* WebSocket Ready Info */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-amber-800 text-xs font-medium">
          ℹ️ This component is WebSocket-ready. Real-time updates will be enabled once
          WebSocket server is connected.
        </p>
      </div>
    </div>
  )
}
