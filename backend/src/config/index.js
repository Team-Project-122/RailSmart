require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5001,
  RULE_ENGINE_URL: process.env.RULE_ENGINE_URL || 'http://127.0.0.1:8000',
  RAILRADAR_API_KEY: process.env.RAILRADAR_API_KEY || '',
  RAILRADAR_BASE_URL: process.env.RAILRADAR_BASE_URL || 'https://api.railradar.io/v1',
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY || '',
  DATABASE_PATH: process.env.DATABASE_PATH || './railsmart.sqlite',
  CACHE_TTL_MINUTES: parseInt(process.env.CACHE_TTL_MINUTES || '15', 10),
  TICK_INTERVAL_MS: parseInt(process.env.TICK_INTERVAL_MS || '1000', 10)
};
