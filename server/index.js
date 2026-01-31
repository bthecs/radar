// /server/index.js
import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
const hasDist = fs.existsSync(distPath);
const app = express();
const PORT = process.env.PORT || 3001;

// Permitir que el Frontend (React) nos hable
app.use(cors());

// Clave OpenWeatherMap: en producción usar variable de entorno OWM_API_KEY
const OWM_API_KEY = process.env.OWM_API_KEY || "97ee37d865932e519a312aaa0f0773de";

// RUTA MAGISTRAL: Proxy de Radar
// El cliente pide: /api/radar/z/x/y
// Nosotros pedimos a OWM y devolvemos la imagen sin revelar la Key
app.get('/api/radar/:z/:x/:y', async (req, res) => {
    const { z, x, y } = req.params;
    
    // URL real de OpenWeatherMap (Capa de Precipitación Nueva)
    const url = `https://tile.openweathermap.org/map/precipitation_new/${z}/${x}/${y}.png?appid=${OWM_API_KEY}`;

    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream' // Importante: Recibimos imagen, no texto
        });

        // Le decimos al navegador que esto es una imagen PNG
        res.set('Content-Type', 'image/png');
        // Enviamos el flujo de datos (stream) directo al frontend
        response.data.pipe(res);

    } catch (error) {
        console.error("Error obteniendo tile:", error.message);
        res.status(404).send('Tile no encontrado'); // O devolver una imagen transparente vacía
    }
});
const isHailRisk = (entry) => {
    const weather = entry?.weather?.[0];
    if (!weather) return false;

    const id = weather.id ?? 0;
    const main = (weather.main || '').toLowerCase();
    const desc = (weather.description || '').toLowerCase();
    const temp = entry?.main?.temp;
    const rainMm = entry?.rain?.['3h'] ?? 0;
    const snowMm = entry?.snow?.['3h'] ?? 0;
    const precipMm = rainMm + snowMm;

    // Tormenta eléctrica suele implicar riesgo de granizo
    const thunderstorm = id >= 200 && id < 300;
    // Código antiguo de granizo y detección por texto
    const hailById = id === 906;
    const hailByText = desc.includes('hail') || desc.includes('granizo');
    // Aguanieve / lluvia helada / hielo
    const frozenByText =
        desc.includes('sleet') ||
        desc.includes('ice pellets') ||
        desc.includes('freezing') ||
        desc.includes('aguanieve') ||
        desc.includes('lluvia helada') ||
        desc.includes('hielo');
    // Nieve (no es granizo, pero indica precipitación congelada)
    const snow = id >= 600 && id < 700 || main.includes('snow');
    // Heurística: temperatura cerca de 0°C + precipitación
    const freezingPrecip = typeof temp === 'number' && temp <= 2 && precipMm > 0;

    return thunderstorm || hailById || hailByText || frozenByText || snow || freezingPrecip;
};

const isHailOrStormAlert = (alert) => {
    if (!alert) return false;
    const text = `${alert.event || ''} ${alert.description || ''}`.toLowerCase();
    if (text.includes('granizo') || text.includes('hail') || text.includes('hielo') ||
        text.includes('aguanieve') || text.includes('lluvia helada') || text.includes('ice pellets') || text.includes('sleet'))
        return true;
    if (text.includes('tormenta') || text.includes('storm') || text.includes('thunderstorm'))
        return true;
    return false;
};

// Open-Meteo: gratis, sin API key. Códigos WMO 95=tormenta, 96=tormenta+granizo, 99=tormenta fuerte+granizo
const OPENMETEO_HAIL_CODES = [95, 96, 99];
const openMeteoRiskLabel = (code) => {
    if (code === 99) return { severity: 'high', text: 'Tormenta fuerte con granizo' };
    if (code === 96) return { severity: 'high', text: 'Tormenta con granizo' };
    if (code === 95) return { severity: 'medium', text: 'Tormenta (riesgo de granizo)' };
    return { severity: 'medium', text: 'Tormenta' };
};

async function getOpenMeteoHailRisk(sensors) {
    const results = [];
    for (const s of sensors) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&hourly=weather_code&timezone=America/Argentina/Mendoza&forecast_days=2`;
            const r = await axios.get(url);
            const times = r.data?.hourly?.time ?? [];
            const codes = r.data?.hourly?.weather_code ?? [];
            const dangerHours = codes
                .map((code, i) => ({ code, time: times[i] }))
                .filter(({ code }) => OPENMETEO_HAIL_CODES.includes(code));
            if (dangerHours.length > 0) {
                const worst = Math.max(...dangerHours.map((h) => h.code));
                const label = openMeteoRiskLabel(worst);
                results.push({
                    name: s.name,
                    lat: s.lat,
                    lon: s.lon,
                    type: 'HAIL_RISK',
                    source: 'openmeteo',
                    severity: label.severity,
                    description: label.text,
                    nextOccurrences: dangerHours.slice(0, 5).map((h) => h.time),
                });
            }
        } catch (e) {
            console.error(`Open-Meteo ${s.name}:`, e.message);
        }
    }
    return results;
}

const SENSORS = [
    { name: "Mendoza", lat: -32.8895, lon: -68.8458 },
    { name: "Barrancas", lat: -32.9127, lon: -68.8851 },
    { name: "San Rafael", lat: -34.6177, lon: -68.3301 },
    { name: "Valle Grande", lat: -34.8294, lon: -68.5065 },
    { name: "El Nihuil", lat: -35.0333, lon: -68.6833 },
    { name: "Gral Alvear", lat: -34.9667, lon: -67.7000 },
];

// Datos de demostración para validar marcadores y panel (sin depender del clima real)
const DEMO_ALERTS = [
    { name: 'Mendoza', lat: -32.8895, lon: -68.8458, type: 'HAIL_RISK' },
    { name: 'San Rafael', lat: -34.6177, lon: -68.3301, type: 'HAIL_RISK' },
];
const DEMO_DANGER = [
    { name: 'Mendoza', lat: -32.8895, lon: -68.8458, type: 'HAIL_RISK', source: 'demo', severity: 'high', description: 'Tormenta con granizo (simulación para validar)', nextOccurrences: [new Date().toISOString().slice(0, 13) + ':00:00'] },
    { name: 'San Rafael', lat: -34.6177, lon: -68.3301, type: 'HAIL_RISK', source: 'demo', severity: 'medium', description: 'Tormenta – riesgo de granizo (simulación)', nextOccurrences: [new Date().toISOString().slice(0, 13) + ':00:00'] },
];

// Marcadores en el mapa: prioridad Open-Meteo (granizo/tormenta), luego OWM; ?demo=1 para validar
app.get('/api/alerts', async (req, res) => {
    if (req.query.demo === '1') {
        return res.json(DEMO_ALERTS);
    }
    const openMeteoAlerts = await getOpenMeteoHailRisk(SENSORS);
    if (openMeteoAlerts.length > 0) {
        return res.json(openMeteoAlerts.map((a) => ({ name: a.name, lat: a.lat, lon: a.lon, type: a.type })));
    }
    const fallbackAlerts = [];
    for (const sensor of SENSORS) {
        try {
            let hasRisk = false;
            try {
                const alertUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${sensor.lat}&lon=${sensor.lon}&appid=${OWM_API_KEY}&lang=es&units=metric&exclude=minutely,hourly,daily`;
                const alertResponse = await axios.get(alertUrl);
                hasRisk = (alertResponse.data?.alerts || []).some(isHailOrStormAlert);
            } catch (e3) {
                try {
                    const url25 = `https://api.openweathermap.org/data/2.5/onecall?lat=${sensor.lat}&lon=${sensor.lon}&appid=${OWM_API_KEY}&lang=es&units=metric&exclude=minutely,hourly,daily`;
                    const r25 = await axios.get(url25);
                    hasRisk = (r25.data?.alerts || []).some(isHailOrStormAlert);
                } catch (_) {}
            }
            if (!hasRisk) {
                const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${sensor.lat}&lon=${sensor.lon}&appid=${OWM_API_KEY}&cnt=4&lang=es&units=metric`;
                const response = await axios.get(forecastUrl);
                hasRisk = (response.data?.list || []).some((entry) => isHailRisk(entry));
            }
            if (hasRisk) {
                fallbackAlerts.push({ name: sensor.name, lat: sensor.lat, lon: sensor.lon, type: 'HAIL_RISK' });
            }
        } catch (e) {
            console.error(`Error sensor ${sensor.name}`);
        }
    }
    res.json(fallbackAlerts);
});

// Panel: precipitaciones peligrosas (Open-Meteo); ?demo=1 para validar
app.get('/api/alerts/danger', async (req, res) => {
    if (req.query.demo === '1') {
        return res.json({ alerts: DEMO_DANGER, source: 'demo' });
    }
    const list = await getOpenMeteoHailRisk(SENSORS);
    res.json({ alerts: list, source: 'openmeteo' });
});

// Alertas crudas de la API (para mostrar en el frontend igual que en la página de OpenWeather)
app.get('/api/alerts/raw', async (req, res) => {
    const lat = req.query.lat ?? -32.8895;
    const lon = req.query.lon ?? -68.8458;
    let list = [];
    try {
        const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&lang=es&units=metric&exclude=minutely,hourly,daily`;
        const r = await axios.get(url);
        list = r.data?.alerts ?? [];
    } catch (e3) {
        try {
            const url25 = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&lang=es&units=metric&exclude=minutely,hourly,daily`;
            const r25 = await axios.get(url25);
            list = r25.data?.alerts ?? [];
        } catch (e25) {
            console.error('Alerts raw error:', e3?.response?.status || e3.message, e25?.response?.status || e25.message);
        }
    }
    res.json({ alerts: list });
});

// En deploy (cuando existe dist): servir frontend y SPA
if (hasDist) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`📡 Servidor Radar en http://localhost:${PORT}`);
});
