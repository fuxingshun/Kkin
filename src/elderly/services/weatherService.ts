import { API_BASE_URL } from '../../config/runtime';
import { getLatestMood } from './moodService';

export interface WeatherInfo {
  icon: string;
  text: string;
  source: 'geolocation' | 'mood' | 'fallback';
}

interface CachedWeatherPayload extends WeatherInfo {
  createdAt: number;
}

interface WeatherApiResponse {
  weather?: Partial<WeatherInfo>;
}

const WEATHER_CACHE_KEY = 'kinecho-elderly-weather';
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;

const fallbackWeather: WeatherInfo = {
  icon: '🌤️',
  text: '天气待同步',
  source: 'fallback',
};

function readCachedWeather() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw) as CachedWeatherPayload;
    if (!cached.createdAt || Date.now() - cached.createdAt > WEATHER_CACHE_TTL_MS) {
      return null;
    }

    return cached;
  } catch (error) {
    console.warn('[weatherService] Failed to read cached weather', error);
    return null;
  }
}

function cacheWeather(weather: WeatherInfo) {
  if (typeof window === 'undefined' || weather.source !== 'geolocation') {
    return;
  }

  try {
    const payload: CachedWeatherPayload = {
      ...weather,
      createdAt: Date.now(),
    };
    window.sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[weatherService] Failed to cache weather', error);
  }
}

function normalizeWeatherPayload(payload?: Partial<WeatherInfo>): WeatherInfo | null {
  if (!payload?.text) {
    return null;
  }

  const source = payload.source === 'geolocation' || payload.source === 'mood' ? payload.source : 'fallback';

  return {
    icon: payload.icon || fallbackWeather.icon,
    text: payload.text,
    source,
  };
}

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 6000,
      maximumAge: WEATHER_CACHE_TTL_MS,
    });
  });
}

async function fetchWeatherFromBff(
  familyId: string,
  elderlyId: number,
  coords?: GeolocationCoordinates
): Promise<WeatherInfo> {
  const params = new URLSearchParams({
    family_id: familyId,
    elderly_id: String(elderlyId),
  });

  if (coords) {
    params.set('latitude', String(coords.latitude));
    params.set('longitude', String(coords.longitude));
  }

  const response = await fetch(`${API_BASE_URL}/elderly/weather?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch elderly weather: ${response.status}`);
  }

  const payload = (await response.json()) as WeatherApiResponse;
  const weather = normalizeWeatherPayload(payload.weather);
  if (!weather) {
    throw new Error('Invalid elderly weather payload');
  }

  cacheWeather(weather);
  return weather;
}

export async function getCurrentWeather(familyId: string, elderlyId: number): Promise<WeatherInfo> {
  const cached = readCachedWeather();
  if (cached) {
    return {
      icon: cached.icon,
      text: cached.text,
      source: cached.source,
    };
  }

  try {
    const position = await getCurrentPosition();
    return await fetchWeatherFromBff(familyId, elderlyId, position.coords);
  } catch (error) {
    console.warn('[weatherService] Falling back from geolocation weather', error);
  }

  try {
    return await fetchWeatherFromBff(familyId, elderlyId);
  } catch (error) {
    console.warn('[weatherService] Falling back from elderly weather API', error);
  }

  try {
    const latestMood = await getLatestMood(familyId, elderlyId);
    const weatherText = latestMood?.weather?.trim();
    if (weatherText) {
      return {
        icon: '🌤️',
        text: weatherText,
        source: 'mood',
      };
    }
  } catch (error) {
    console.warn('[weatherService] Falling back from latest mood weather', error);
  }

  return fallbackWeather;
}

export function getDefaultWeather() {
  const cached = readCachedWeather();
  if (cached) {
    return {
      icon: cached.icon,
      text: cached.text,
      source: cached.source,
    } satisfies WeatherInfo;
  }

  return fallbackWeather;
}
