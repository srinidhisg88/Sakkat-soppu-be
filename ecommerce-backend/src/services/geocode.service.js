const axios = require('axios');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_EMAIL = process.env.NOMINATIM_EMAIL; // optional per Nominatim policy

/**
 * Fetch geocode (lat/lon) for an address using OpenStreetMap Nominatim.
 * Returns { latitude, longitude } or null if no results were found.
 * Throws on network errors.
 */
const getGeocode = async (address) => {
    try {
        const params = {
            q: address,
            format: 'json',
            limit: 1,
            addressdetails: 0,
        };
        if (NOMINATIM_EMAIL) params.email = NOMINATIM_EMAIL;

        const response = await axios.get(NOMINATIM_URL, { params, headers: { 'User-Agent': 'SakkatSoppu/1.0 (mailto:' + (NOMINATIM_EMAIL || 'noreply@example.com') + ')' } });

        if (Array.isArray(response.data) && response.data.length > 0) {
            const r = response.data[0];
            return { latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) };
        }

        // No results found — return null to let callers decide fallback
        return null;
    } catch (err) {
        // Network / unexpected errors should be propagated
        throw new Error('Error fetching geocode from Nominatim: ' + err.message);
    }
};

module.exports = {
    getGeocode,
};