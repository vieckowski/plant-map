"use strict";

// Darmowy podkład wektorowy OpenFreeMap (bez klucza API), styl Liberty.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const CSV_URL = "data/growatt_plants.csv";

// Startowy widok: środek Polski (MapLibre używa kolejności [lng, lat]).
const POLAND_CENTER = [19.2, 52.0];
const POLAND_ZOOM = 5;

document.addEventListener("DOMContentLoaded", init);

function init() {
  const map = new maplibregl.Map({
    container: "map",
    style: STYLE_URL,
    center: POLAND_CENTER,
    zoom: POLAND_ZOOM,
  });

  // Przyciski + / - w prawym dolnym rogu (bez kompasu).
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "bottom-right"
  );

  map.on("load", () => {
    fetch(CSV_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Nie udało się wczytać pliku CSV (HTTP ${res.status}).`);
        }
        return res.text();
      })
      .then((text) => {
        const { features } = parsePlants(text);
        addPlantsLayer(map, features);
        fitToFeatures(map, features);
      })
      .catch((err) => console.error(err));
  });
}

/**
 * Parsuje tekst CSV do listy obiektów GeoJSON (punktów).
 * Pomija wiersze z brakującymi lub niepoprawnymi współrzędnymi.
 */
function parsePlants(text) {
  const rows = parseCsv(text);
  const features = [];
  let skipped = 0;

  // Pierwszy wiersz to nagłówek.
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length < 4) continue;
    if (cols.every((c) => c.trim() === "")) continue;

    const account = (cols[0] || "").trim();
    const power = parseFloat(cols[1]);
    const lat = parseFloat(cols[2]);
    const lng = parseFloat(cols[3]);

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat > -90 &&
      lat < 90 &&
      lng > -180 &&
      lng < 180
    ) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          account,
          power: Number.isFinite(power) ? power : null,
        },
      });
    } else {
      skipped++;
    }
  }

  return { features, skipped };
}

/**
 * Minimalny parser CSV obsługujący pola w cudzysłowach.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // ignoruj
    } else {
      field += ch;
    }
  }

  // ostatnie pole / wiersz
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Dodaje punkty instalacji jako warstwę kół renderowaną przez GPU
 * oraz obsługę popupów po kliknięciu.
 */
function addPlantsLayer(map, features) {
  map.addSource("plants", {
    type: "geojson",
    data: { type: "FeatureCollection", features },
  });

  map.addLayer({
    id: "plants-circles",
    type: "circle",
    source: "plants",
    paint: {
      // Promień rośnie wraz z przybliżeniem.
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        4,
        10,
        7,
        14,
        10,
      ],
      "circle-color": "#f59e0b",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.9,
    },
  });

  const popup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: "260px",
  });

  map.on("mouseenter", "plants-circles", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "plants-circles", () => {
    map.getCanvas().style.cursor = "";
  });

  map.on("click", "plants-circles", (e) => {
    const f = e.features[0];
    const coords = f.geometry.coordinates.slice();
    popup.setLngLat(coords).setHTML(buildPopupHtml(f.properties)).addTo(map);
  });
}

/** Dopasowuje widok mapy tak, aby objąć wszystkie instalacje. */
function fitToFeatures(map, features) {
  if (!features.length) return;
  const bounds = new maplibregl.LngLatBounds();
  features.forEach((f) => bounds.extend(f.geometry.coordinates));
  map.fitBounds(bounds, { padding: 40, maxZoom: 12, duration: 0 });
}

function buildPopupHtml(props) {
  const name = escapeHtml(props.account) || "(brak nazwy)";
  const power =
    props.power !== null && props.power !== undefined
      ? formatNumber(props.power)
      : "brak danych";

  return `
    <div class="popup">
      <p class="popup-title">${name}</p>
      <p class="popup-row">
        <span class="label">Moc zainstalowana:</span>
        <span class="value">${power} kWp</span>
      </p>
    </div>
  `;
}

function formatNumber(n) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 3 }).format(n);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
