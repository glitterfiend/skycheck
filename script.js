(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
  const WX = 'https://api.open-meteo.com/v1/forecast';

  // WMO weather code -> [label, day icon, night icon, theme]
  const CODES = {
    0: ['Clear sky', '☀️', '🌙', 'clear'],
    1: ['Mostly clear', '🌤️', '🌙', 'clear'],
    2: ['Partly cloudy', '⛅', '☁️', ''],
    3: ['Overcast', '☁️', '☁️', ''],
    45: ['Fog', '🌫️', '🌫️', ''], 48: ['Rime fog', '🌫️', '🌫️', ''],
    51: ['Light drizzle', '🌦️', '🌧️', 'rain'], 53: ['Drizzle', '🌦️', '🌧️', 'rain'], 55: ['Heavy drizzle', '🌧️', '🌧️', 'rain'],
    56: ['Freezing drizzle', '🌧️', '🌧️', 'rain'], 57: ['Freezing drizzle', '🌧️', '🌧️', 'rain'],
    61: ['Light rain', '🌦️', '🌧️', 'rain'], 63: ['Rain', '🌧️', '🌧️', 'rain'], 65: ['Heavy rain', '🌧️', '🌧️', 'rain'],
    66: ['Freezing rain', '🌧️', '🌧️', 'rain'], 67: ['Freezing rain', '🌧️', '🌧️', 'rain'],
    71: ['Light snow', '🌨️', '🌨️', 'snow'], 73: ['Snow', '❄️', '❄️', 'snow'], 75: ['Heavy snow', '❄️', '❄️', 'snow'],
    77: ['Snow grains', '🌨️', '🌨️', 'snow'],
    80: ['Light showers', '🌦️', '🌧️', 'rain'], 81: ['Showers', '🌧️', '🌧️', 'rain'], 82: ['Violent showers', '⛈️', '⛈️', 'rain'],
    85: ['Snow showers', '🌨️', '🌨️', 'snow'], 86: ['Heavy snow showers', '❄️', '❄️', 'snow'],
    95: ['Thunderstorm', '⛈️', '⛈️', 'rain'], 96: ['Thunderstorm, hail', '⛈️', '⛈️', 'rain'], 99: ['Severe thunderstorm', '⛈️', '⛈️', 'rain']
  };
  const code = (c, day = 1) => {
    const e = CODES[c] || ['Unknown', '❔', '❔', ''];
    return { label: e[0], icon: day ? e[1] : e[2], theme: e[3] };
  };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  let unit = store.get('unit', 'f');
  let current = null; // {place, data}

  const status = (msg, err = false) => { const s = $('status'); s.textContent = msg; s.className = err ? 'error' : ''; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Fetching ----------
  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Request failed (' + r.status + ')');
    return r.json();
  }

  async function searchCities(name) {
    const j = await getJSON(`${GEO}?name=${encodeURIComponent(name)}&count=6&language=en&format=json`);
    return j.results || [];
  }

  async function getWeather(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 7,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure',
      hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max'
    });
    return getJSON(`${WX}?${params}`);
  }

  // ---------- Units ----------
  const toF = c => c * 9 / 5 + 32;
  const T = c => Math.round(unit === 'f' ? toF(c) : c) + '°';
  const wind = kmh => unit === 'f' ? Math.round(kmh * 0.621371) + ' mph' : Math.round(kmh) + ' km/h';
  const precip = mm => unit === 'f' ? (mm / 25.4).toFixed(2) + ' in' : mm.toFixed(1) + ' mm';
  const compass = d => ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(d / 22.5) % 16];

  // ---------- Rendering ----------
  function clockLabel(iso) { // iso is local time at the place, e.g. 2026-10-13T16:00
    const h = +iso.slice(11, 13);
    return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
  }
  function dayLabel(iso, i) {
    if (i === 0) return 'Today';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
  }
  function timeOnly(iso) {
    const h = +iso.slice(11, 13), m = iso.slice(14, 16);
    return (h % 12 || 12) + ':' + m + (h < 12 ? ' AM' : ' PM');
  }

  function render() {
    if (!current) return;
    const { place, data, savedAt } = current;
    const c = data.current, cd = code(c.weather_code, c.is_day);

    $('result').hidden = false;
    $('place').textContent = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
    $('updated').textContent = 'Updated ' + new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    $('cicon').textContent = cd.icon;
    $('ctemp').textContent = T(c.temperature_2m);
    $('cdesc').textContent = cd.label;

    const d = data.daily;
    $('tiles').innerHTML = [
      ['Feels like', T(c.apparent_temperature)],
      ['Humidity', Math.round(c.relative_humidity_2m) + '%'],
      ['Wind', wind(c.wind_speed_10m) + ' ' + compass(c.wind_direction_10m)],
      ['Pressure', Math.round(c.surface_pressure) + ' hPa'],
      ['Precipitation', precip(c.precipitation)],
      ['UV index (max)', Math.round(d.uv_index_max[0])],
      ['Sunrise', timeOnly(d.sunrise[0])],
      ['Sunset', timeOnly(d.sunset[0])]
    ].map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('');

    // hourly: from the current hour, next 24
    const h = data.hourly;
    let start = h.time.findIndex(t => t >= data.current.time.slice(0, 13) + ':00');
    if (start < 0) start = 0;
    let html = '';
    for (let i = start; i < start + 24 && i < h.time.length; i++) {
      const hc = code(h.weather_code[i], h.is_day[i]);
      const p = h.precipitation_probability[i];
      html += `<div class="hour"><div class="t">${i === start ? 'Now' : clockLabel(h.time[i])}</div>
        <div class="i" aria-hidden="true">${hc.icon}</div><div>${T(h.temperature_2m[i])}</div>
        <div class="t">${p ? p + '%' : '&nbsp;'}</div></div>`;
    }
    $('hourly').innerHTML = html;

    $('daily').innerHTML = d.time.map((t, i) => {
      const dc = code(d.weather_code[i]);
      const p = d.precipitation_probability_max[i];
      return `<div class="day"><span>${dayLabel(t, i)}</span><span class="i" aria-hidden="true">${dc.icon}</span>
        <span class="p">${dc.label}${p ? ' · ' + p + '%' : ''}</span>
        <span class="hl">${T(d.temperature_2m_max[i])} <span class="lo">${T(d.temperature_2m_min[i])}</span></span></div>`;
    }).join('');

    document.body.className = !c.is_day ? 'night' : cd.theme;
    document.querySelector('meta[name=theme-color]').content = getComputedStyle(document.body).getPropertyValue('--bg1').trim() || '#1e3a5f';
  }

  // ---------- Loading a place ----------
  async function loadPlace(place) {
    hideSuggestions();
    status('Loading weather for ' + place.name + '…');
    try {
      const data = await getWeather(place.latitude, place.longitude);
      current = { place, data, savedAt: Date.now() };
      store.set('last', current);
      $('offline').style.display = 'none';
      status('');
      render();
    } catch (e) {
      if (!navigator.onLine && current) {
        $('offline').style.display = 'block';
        status('');
      } else {
        status('Could not load weather. Check your connection and try again.', true);
      }
    }
  }

  // ---------- Search & suggestions ----------
  const list = $('suggestions');
  let results = [], active = -1, timer;

  function hideSuggestions() { list.style.display = 'none'; list.innerHTML = ''; results = []; active = -1; }
  function showSuggestions(rs) {
    results = rs; active = -1;
    list.innerHTML = rs.map((r, i) =>
      `<li role="option" data-i="${i}">${esc(r.name)} <small>${esc([r.admin1, r.country].filter(Boolean).join(', '))}</small></li>`).join('');
    list.style.display = rs.length ? 'block' : 'none';
  }
  list.addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    const r = results[+li.dataset.i];
    $('q').value = r.name;
    loadPlace(r);
  });

  $('q').addEventListener('input', e => {
    clearTimeout(timer);
    const v = e.target.value.trim();
    if (v.length < 2) return hideSuggestions();
    timer = setTimeout(async () => {
      try { if (v === $('q').value.trim()) showSuggestions(await searchCities(v)); } catch {}
    }, 250);
  });
  $('q').addEventListener('keydown', e => {
    const items = [...list.children];
    if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.setAttribute('aria-selected', i === active));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault(); items[active].click();
    } else if (e.key === 'Escape') hideSuggestions();
  });
  document.addEventListener('click', e => { if (!e.target.closest('#search, #suggestions')) hideSuggestions(); });

  $('search').addEventListener('submit', async e => {
    e.preventDefault();
    const v = $('q').value.trim(); if (!v) return;
    status('Searching…');
    try {
      const rs = await searchCities(v);
      if (!rs.length) { hideSuggestions(); return status('No city found for “' + v + '”.', true); }
      $('q').value = rs[0].name;
      loadPlace(rs[0]);
    } catch { status('Search failed. Check your connection.', true); }
  });

  $('locate').addEventListener('click', () => {
    if (!navigator.geolocation) return status('Geolocation is not supported on this device.', true);
    status('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      pos => loadPlace({ name: 'My location', latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => status('Location permission denied or unavailable.', true),
      { timeout: 10000, maximumAge: 300000 }
    );
  });

  // ---------- Units ----------
  document.querySelectorAll('[data-unit]').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.unit === unit);
    b.addEventListener('click', () => {
      unit = b.dataset.unit; store.set('unit', unit);
      document.querySelectorAll('[data-unit]').forEach(x => x.setAttribute('aria-pressed', x === b));
      render();
    });
  });

  // ---------- Online/offline ----------
  addEventListener('online', () => {
    $('offline').style.display = 'none';
    if (current) loadPlace(current.place);
  });
  addEventListener('offline', () => { if (current) $('offline').style.display = 'block'; });

  // ---------- Install prompt ----------
  let deferred;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('install').style.display = 'block'; });
  $('install').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt(); await deferred.userChoice; deferred = null; $('install').style.display = 'none';
  });
  addEventListener('appinstalled', () => { $('install').style.display = 'none'; });

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---------- Startup: restore last city ----------
  const last = store.get('last', null);
  if (last && last.place && last.data) {
    current = last;
    $('q').value = last.place.name === 'My location' ? '' : last.place.name;
    render();
    status('');
    if (navigator.onLine) loadPlace(last.place); else $('offline').style.display = 'block';
  }
})();