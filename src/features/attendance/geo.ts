export interface Coords {
  latitude: number
  longitude: number
  accuracy?: number
}

const GEO_ERROR_TEXT: Record<number, string> = {
  1: 'Location permission is blocked. Allow location access for this site in your browser settings, then retry.',
  2: 'Your device could not determine its location. Turn on location services / Wi-Fi and retry.',
  3: 'Getting your location took too long. Retry — moving near a window or turning on Wi-Fi helps.',
}

// A fix this precise is good enough to stop waiting for a better one.
const GOOD_ACCURACY_M = 30
const HIGH_ACCURACY_WINDOW_MS = 12_000
const FALLBACK_TIMEOUT_MS = 15_000

function toCoords(pos: GeolocationPosition): Coords {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  }
}

/**
 * Locate the device (requires HTTPS). The first reading a browser returns is
 * often a coarse network guess that sharpens over a few seconds, so we watch
 * for a short window and keep the most accurate fix, then fall back to a
 * low-accuracy request (desktops without GPS frequently time out otherwise).
 */
export function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported on this device/browser.'))
      return
    }
    let best: Coords | null = null
    let settled = false

    const finish = (watchId: number, timer: ReturnType<typeof setTimeout>) => {
      settled = true
      navigator.geolocation.clearWatch(watchId)
      clearTimeout(timer)
    }
    const fallback = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(toCoords(pos)),
        (err) => reject(new Error(GEO_ERROR_TEXT[err.code] ?? err.message ?? 'Could not get location.')),
        { enableHighAccuracy: false, timeout: FALLBACK_TIMEOUT_MS, maximumAge: 60_000 },
      )
    }

    const timer = setTimeout(() => {
      if (settled) return
      finish(watchId, timer)
      if (best) resolve(best)
      else fallback()
    }, HIGH_ACCURACY_WINDOW_MS)

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (settled) return
        const c = toCoords(pos)
        if (!best || (c.accuracy ?? Infinity) < (best.accuracy ?? Infinity)) best = c
        if ((c.accuracy ?? Infinity) <= GOOD_ACCURACY_M) {
          finish(watchId, timer)
          resolve(c)
        }
      },
      (err) => {
        if (settled) return
        finish(watchId, timer)
        if (best) resolve(best)
        // Permission denied is final; anything else gets the low-accuracy retry.
        else if (err.code === 1) reject(new Error(GEO_ERROR_TEXT[1]))
        else fallback()
      },
      { enableHighAccuracy: true, timeout: HIGH_ACCURACY_WINDOW_MS, maximumAge: 0 },
    )
  })
}

/** Haversine distance in metres (mirror of the server-side check for display). */
export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Current date (YYYY-MM-DD) in the given IANA timezone. */
export function todayInTz(tz = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}m`
}
