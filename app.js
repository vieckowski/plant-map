"use strict";

/*
 * Konfiguracja warstwy podkładowej mapy.
 *
 * Domyślnie używane są rastrowe kafelki OpenStreetMap (działa bez klucza API).
 *
 * Aby skorzystać z OpenMapTiles (np. przez MapTiler), wpisz swój klucz API
 * w MAPTILER_KEY poniżej — wtedy mapa automatycznie przełączy się na kafelki
 * oparte o OpenMapTiles. Bez klucza pozostaje czysty OpenStreetMap.
 */
const MAPTILER_KEY = "";

const CSV_URL = "data/growatt_plants.csv";

// Przybliżony środek Polski i startowy poziom przybliżenia.
const POLAND_CENTER = [52.0, 19.2];
const POLAND_ZOOM = 6;

document.addEventListener("DOMContentLoaded", init);

function init() {
  const map = L.map("map", {
    center: POLAND_CENTER,
    zoom: POLAND_ZOOM,
    zoomControl: false,
    // Zoom tylko przyciskami — wyłączamy kółko/gesty, aby przewijanie strony
    // (mapa jest w iframe) nie zmieniało przypadkowo przybliżenia.
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
  });

  // Przyciski + / - w prawym dolnym rogu.
  L.control.zoom({ position: "bottomright" }).addTo(map);

  createBaseLayer().addTo(map);

  fetch(CSV_URL)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Nie udało się wczytać pliku CSV (HTTP ${res.status}).`);
      }
      return res.text();
    })
    .then((text) => {
      const { valid, skipped } = parsePlants(text);
      renderMarkers(map, valid);
      updateStats(valid.length, skipped.length);
    })
    .catch((err) => {
      console.error(err);
      setStats(
        "Błąd wczytywania danych. Uruchom aplikację przez serwer HTTP (patrz README)."
      );
    });
}

function createBaseLayer() {
  if (MAPTILER_KEY) {
    // OpenMapTiles (rastrowy podgląd stylu OSM-Bright od MapTiler).
    return L.tileLayer(
      `https://api.maptiler.com/maps/openstreetmap/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
      {
        maxZoom: 19,
        tileSize: 512,
        zoomOffset: -1,
        attribution:
          '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> ' +
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    );
  }

  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
}

/**
 * Parsuje tekst CSV do listy instalacji.
 * Pomija wiersze z brakującymi lub niepoprawnymi współrzędnymi.
 */
function parsePlants(text) {
  const rows = parseCsv(text);
  const valid = [];
  const skipped = [];

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
      valid.push({ account, power, lat, lng });
    } else {
      skipped.push({ account, raw: cols });
    }
  }

  return { valid, skipped };
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

function renderMarkers(map, plants) {
  const group = L.layerGroup();

  plants.forEach((p) => {
    const marker = L.marker([p.lat, p.lng]);
    marker.bindPopup(buildPopupHtml(p), { closeButton: true });
    group.addLayer(marker);
  });

  map.addLayer(group);
}

function buildPopupHtml(p) {
  const name = escapeHtml(p.account) || "(brak nazwy)";
  const power = Number.isFinite(p.power) ? formatNumber(p.power) : "brak danych";

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

function updateStats(validCount, skippedCount) {
  let msg = `Instalacji na mapie: ${validCount}`;
  if (skippedCount > 0) {
    msg += ` · pominięto (brak/niepoprawne współrzędne): ${skippedCount}`;
  }
  setStats(msg);
}

function setStats(message) {
  const el = document.getElementById("stats");
  if (el) el.textContent = message;
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
