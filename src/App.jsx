import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import L from 'leaflet';

// Icono Normal (Ubicación)
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- NUEVO: Icono de GRANIZO Personalizado ---
const createHailIcon = () => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: "<div class='hail-icon'>⚡</div>",
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
};

// En producción la API está en el mismo origen; en dev en localhost:3001
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

// Datos demo locales: siempre se muestran con ?demo=1 aunque el servidor falle
const DEMO_ALERTS = [
    { name: 'Mendoza', lat: -32.8895, lon: -68.8458, type: 'HAIL_RISK' },
    { name: 'San Rafael', lat: -34.6177, lon: -68.3301, type: 'HAIL_RISK' },
];
const DEMO_DANGER = [
    { name: 'Mendoza', description: 'Tormenta con granizo (simulación para validar)', nextOccurrences: [new Date().toISOString().slice(0, 13) + ':00:00'] },
    { name: 'San Rafael', description: 'Tormenta – riesgo de granizo (simulación)', nextOccurrences: [new Date().toISOString().slice(0, 13) + ':00:00'] },
];

function App() {
  const position = [-34.6177, -68.3301];
  const radarLayerUrl = `${API_BASE}/api/radar/{z}/{x}/{y}`;
  
  const [alerts, setAlerts] = useState([]);
  const [dangerAlerts, setDangerAlerts] = useState([]);

  const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';

  const fetchAlerts = async () => {
    if (isDemo) {
      setAlerts(DEMO_ALERTS);
      setDangerAlerts(DEMO_DANGER);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/alerts`);
      const data = await res.json();
      setAlerts(data);
    } catch (e) {
      console.error("Error buscando alertas", e);
    }
  };

  const fetchDangerAlerts = async () => {
    if (isDemo) {
      setDangerAlerts(DEMO_DANGER);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/alerts/danger`);
      const data = await res.json();
      setDangerAlerts(data.alerts || []);
    } catch (e) {
      console.error("Error precipitaciones peligrosas", e);
      setDangerAlerts([]);
    }
  };

  useEffect(() => {
    if (isDemo) {
      setAlerts(DEMO_ALERTS);
      setDangerAlerts(DEMO_DANGER);
      return;
    }
    fetchAlerts();
    fetchDangerAlerts();
    const interval = setInterval(() => {
      fetchAlerts();
      fetchDangerAlerts();
    }, 60000);
    return () => clearInterval(interval);
  }, [isDemo]);

  return (
    <div className="app">
      <MapContainer center={position} zoom={9} className="map-container" zoomControl={false}>
        
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png" opacity={0.8} zIndex={500} />
        <TileLayer url={radarLayerUrl} opacity={0.92} zIndex={100} className="radar-layer" />

        <Marker position={position}>
          <Popup>San Rafael</Popup>
        </Marker>

        {/* --- RENDERIZADO DE ALERTAS DE GRANIZO --- */}
        {alerts.map((alert, index) => (
            <Marker 
                key={index} 
                position={[alert.lat, alert.lon]} 
                icon={createHailIcon()} // Usamos el icono rojo que parpadea
            >
                <Popup>
                    <strong style={{color:'red'}}>⚠ ALERTA DE TORMENTA</strong><br/>
                    Posible Granizo en {alert.name}
                </Popup>
            </Marker>
        ))}

      </MapContainer>

      {isDemo && (
        <div className="demo-badge">Modo demo – alertas simuladas</div>
      )}
      {/* Panel: precipitaciones peligrosas con posible granizo (Open-Meteo) */}
      <div className="alerts-panel">
        <h3 className="alerts-panel-title">
          Precipitaciones peligrosas {isDemo ? '(demo)' : '(Open-Meteo)'}
        </h3>
        {dangerAlerts.length === 0 ? (
          <p className="alerts-panel-empty">No se detecta tormenta ni granizo en las próximas 48 h en la zona.</p>
        ) : (
          <ul className="alerts-list">
            {dangerAlerts.map((a, i) => (
              <li key={i} className="alert-item">
                <strong>{a.name}</strong>
                <p>{a.description}</p>
                {a.nextOccurrences?.length > 0 && (
                  <span className="alert-time">
                    Próximas ventanas: {a.nextOccurrences.slice(0, 3).map((t) => new Date(t).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })).join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Leyenda */}
      <div className="legend-container">
        <div className="legend-labels">
            <span>GRANIZO</span>
            <span>INTENSO</span>
            <span>MODERADO</span>
            <span>LLUVIA</span>
            <span>LLOVIZNA</span>
        </div>
        <div className="legend-bar"></div>
      </div>
    </div>
  );
}

export default App;