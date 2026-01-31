# Desplegar Radar Meteorológico

El proyecto queda listo para un solo servicio: **frontend + API** en la misma URL.

## Opción 1: Render (rápido y gratis)

1. **Subí el código a GitHub** (si aún no está).
   ```bash
   git add .
   git commit -m "Listo para deploy"
   git push origin main
   ```

2. **Entrá a [render.com](https://render.com)** y creá una cuenta (con GitHub).

3. **New → Web Service**, conectá el repo `radar`.

4. **Configuración:**
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Node version:** 20 (o la que uses)

5. **Deploy.** Render corre el build (genera `dist/`) y luego `npm start` (servidor que sirve API + frontend).

6. Te dan una URL tipo `https://radar-xxxx.onrender.com`. Entrá ahí y usá la app.  
   - Modo demo: `https://tu-app.onrender.com/?demo=1`

---

## Opción 2: Railway

1. [railway.app](https://railway.app) → **Start a New Project** → **Deploy from GitHub** (repo `radar`).

2. En **Settings** del servicio:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`

3. **Deploy.** Railway asigna una URL pública.

---

## Variables de entorno (recomendado)

En Render o Railway podés definir:

- `OWM_API_KEY`: tu clave de OpenWeatherMap (ahora está en el código; en producción conviene usar la variable).

Para que el servidor la use, en `server/index.js` cambiá la línea de la clave por:

```js
const OWM_API_KEY = process.env.OWM_API_KEY || "97ee37d865932e519a312aaa0f0773de";
```

---

## Probar en local como en producción

```bash
npm run build
npm start
```

Abrí `http://localhost:3001` (o el puerto que use). El mapa y las alertas usan la misma API en ese puerto.
