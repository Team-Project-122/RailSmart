/**
 * Weather Service (services/weather.js)
 * Wraps OpenWeatherMap API for live station weather (condition, visibility in meters, temperature in °C)
 * with robust local caching.
 */

const axios = require('axios');
const config = require('../config');
const { query, run } = require('../db');

const weatherCache = new Map();

const STATION_COORDINATES = {
  NDLS: { lat: 28.6143, lng: 77.2188, name: 'New Delhi' },
  GZB:  { lat: 28.6538, lng: 77.4300, name: 'Ghaziabad' },
  ALJN: { lat: 27.8974, lng: 78.0880, name: 'Aligarh' },
  TDL:  { lat: 27.2065, lng: 78.2410, name: 'Tundla' },
  CNB:  { lat: 26.4547, lng: 80.3507, name: 'Kanpur Central' },
  PRYJ: { lat: 25.4497, lng: 81.8282, name: 'Prayagraj' },
  DDU:  { lat: 25.2818, lng: 83.1189, name: 'Pt DD Upadhyaya' },
  PNBE: { lat: 25.6033, lng: 85.1384, name: 'Patna' },
  HWH:  { lat: 22.5840, lng: 88.3426, name: 'Howrah' }
};

class WeatherService {
  async getStationWeather(stationCode) {
    const code = (stationCode || 'NDLS').toUpperCase();
    const coords = STATION_COORDINATES[code] || STATION_COORDINATES['NDLS'];

    // 1. Check in-memory cache (TTL 15 min)
    const cached = weatherCache.get(code);
    if (cached && (Date.now() - cached.timestamp < config.CACHE_TTL_MINUTES * 60 * 1000)) {
      return cached.data;
    }

    // 2. Try OpenWeatherMap API if API key provided
    if (config.OPENWEATHER_API_KEY) {
      try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lng}&appid=${config.OPENWEATHER_API_KEY}&units=metric`;
        const res = await axios.get(url, { timeout: 3000 });
        const d = res.data;

        const snapshot = {
          station_code: code,
          station_name: coords.name,
          condition: (d.weather?.[0]?.main || 'CLEAR').toUpperCase(),
          description: d.weather?.[0]?.description || 'Clear sky',
          visibility_m: d.visibility || 5000,
          temp_c: Math.round(d.main?.temp || 28),
          humidity_percent: d.main?.humidity || 65,
          wind_speed_kmh: Math.round((d.wind?.speed || 3) * 3.6),
          is_live: true,
          data_source: 'OpenWeatherMap Live API',
          fetched_at: new Date().toISOString()
        };

        weatherCache.set(code, { timestamp: Date.now(), data: snapshot });
        this._persistSnapshot(snapshot);
        return snapshot;
      } catch (err) {
        console.warn(`[Weather] Live fetch for ${code} failed: ${err.message}. Using fallback.`);
      }
    }

    // 3. Fallback from DB or realistic default
    const dbRow = query('SELECT * FROM weather_snapshots WHERE station_code = ? ORDER BY fetched_at DESC LIMIT 1', [code])[0];
    const fallback = dbRow ? {
      station_code: code,
      station_name: coords.name,
      condition: dbRow.condition,
      description: `${dbRow.condition} conditions`,
      visibility_m: dbRow.visibility_m,
      temp_c: dbRow.temp_c,
      wind_speed_kmh: dbRow.wind_speed_kmh,
      is_live: false,
      data_source: 'Weather Cached Snapshot (Offline Mode)',
      fetched_at: dbRow.fetched_at
    } : {
      station_code: code,
      station_name: coords.name,
      condition: 'CLEAR',
      description: 'Clear visibility',
      visibility_m: 4000,
      temp_c: 30,
      wind_speed_kmh: 12,
      is_live: false,
      data_source: 'Weather Default Simulation',
      fetched_at: new Date().toISOString()
    };

    weatherCache.set(code, { timestamp: Date.now(), data: fallback });
    return fallback;
  }

  _persistSnapshot(s) {
    try {
      run(`
        INSERT OR REPLACE INTO weather_snapshots (snapshot_id, station_code, condition, visibility_m, temp_c, wind_speed_kmh, is_cached, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [`WX-${s.station_code}`, s.station_code, s.condition, s.visibility_m, s.temp_c, s.wind_speed_kmh, s.is_live ? 0 : 1, s.fetched_at]);
    } catch (e) {
      // ignore
    }
  }

  async getAllStationWeather() {
    const results = [];
    for (const code of Object.keys(STATION_COORDINATES)) {
      results.push(await this.getStationWeather(code));
    }
    return results;
  }
}

module.exports = new WeatherService();
