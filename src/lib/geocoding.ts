import * as ExpoLocation from 'expo-location'

/** Reverse geocode a lat/lon to the most useful place name available. */
export async function getPlaceName(latitude: number, longitude: number): Promise<string | null> {
  try {
    const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude })
    const r = results[0]
    if (r === undefined) return null
    // Prefer city, fall back to district → region → country
    return r.city ?? r.district ?? r.region ?? r.country ?? null
  } catch {
    return null
  }
}
