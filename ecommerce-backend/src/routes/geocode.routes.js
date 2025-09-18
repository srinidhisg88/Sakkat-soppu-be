const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Simple in-memory cache with TTL to be polite to OSM
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const cache = new Map(); // key -> { data, expiresAt }
const getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return undefined; }
  return entry.data;
};
const setCache = (key, data) => cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });

// Rate limit per IP ~1 req/sec
const limiter = rateLimit({
  windowMs: 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
});

function buildUA() {
  const app = process.env.APP_NAME || 'SakkatSoppu';
  const ver = process.env.npm_package_version || '1.0';
  const email = process.env.OSM_CONTACT_EMAIL || '';
  return email ? `${app}/${ver} (${email})` : `${app}/${ver}`;
}

// Forward Geocoding
router.get('/geocode/search', limiter, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ message: 'Missing query' });
  const key = `search:${q}`;
  const cached = getCache(key);
  if (cached) return res.json(cached);
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    const r = await fetch(url, { headers: { 'User-Agent': buildUA() } });
    if (!r.ok) return res.status(502).json({ message: 'Geocoding failed' });
    const data = await r.json();
    const mapped = Array.isArray(data) ? data.map(i => ({
      display_name: i.display_name,
      lat: i.lat,
      lon: i.lon,
    })) : [];
    setCache(key, mapped);
    return res.json(mapped);
  } catch (e) {
    return res.status(502).json({ message: 'Geocoding failed' });
  }
});

// Reverse Geocoding
router.get('/geocode/reverse', limiter, async (req, res) => {
  const lat = (req.query.lat || '').toString().trim();
  const lon = (req.query.lon || '').toString().trim();
  if (!lat || !lon) return res.status(400).json({ message: 'Missing lat/lon' });
  const key = `reverse:${lat}:${lon}`;
  const cached = getCache(key);
  if (cached) return res.json(cached);
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', lat);
    url.searchParams.set('lon', lon);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    const r = await fetch(url, { headers: { 'User-Agent': buildUA() } });
    if (!r.ok) return res.status(502).json({ message: 'Reverse geocoding failed' });
    const data = await r.json();
    const mapped = {
      display_name: data.display_name,
      lat: data.lat,
      lon: data.lon,
    };
    setCache(key, mapped);
    return res.json(mapped);
  } catch (e) {
    return res.status(502).json({ message: 'Reverse geocoding failed' });
  }
});

module.exports = router;
