import type { Weather } from "./types";

// Open-Meteo — no API key required. Surfaces freeze/heat so the board can nudge
// the right seasonal task ("freeze tonight → drain outdoor faucets").
const CODES: Record<number, string> = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "foggy", 48: "rime fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow",
  75: "heavy snow", 80: "rain showers", 95: "thunderstorms",
};

const cToF = (c: number) => Math.round((c * 9) / 5 + 32);

export async function getWeather(): Promise<Weather | null> {
  const lat = process.env.HOMEBASE_LAT;
  const lon = process.env.HOMEBASE_LON;
  if (!lat || !lon) return null;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min` +
      `&temperature_unit=celsius&forecast_days=1&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const j = await res.json();

    const tempF = j.current ? cToF(j.current.temperature_2m) : null;
    const code = j.current ? j.current.weather_code : null;
    const high = j.daily ? cToF(j.daily.temperature_2m_max[0]) : null;
    const low = j.daily ? cToF(j.daily.temperature_2m_min[0]) : null;

    return {
      tempF,
      code,
      summary: code != null ? CODES[code] ?? "—" : "—",
      high,
      low,
      freezeWarning: low != null && low <= 32,
      heatWarning: high != null && high >= 90,
    };
  } catch {
    return null;
  }
}
