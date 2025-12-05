import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---- ENV VARS ----
const SUPABASE_URL = process.env.SUPABASE_URL; // f.eks. https://abcxyz.supabase.co
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DJI_APP_KEY = process.env.DJI_APP_KEY;          // fra DJI Developer
const DJI_LICENSE_KEY = process.env.DJI_LICENSE_KEY;  // Basic License Key
const DJI_API_URL = process.env.DJI_API_URL || "https://openapi.dji.com";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i env!");
}

// ---- HJELPEFUNKSJON: skriv EN posisjon til Supabase via REST ----
async function insertTelemetry({ drone_id, lat, lon, alt = null, raw = null }) {
  const url = `${SUPABASE_URL}/rest/v1/drone_telemetry`;

  const payload = { drone_id, lat, lon, alt, raw };

  const res = await axios.post(url, payload, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }
  });

  return res.data;
}

// ---- HJELPEFUNKSJON: bulk insert til Supabase ----
async function insertTelemetryBulk(items) {
  const url = `${SUPABASE_URL}/rest/v1/drone_telemetry`;

  const res = await axios.post(url, items, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }
  });

  return res.data;
}

// ---- HEALTHCHECK ----
app.get("/", (req, res) => {
  res.send("Avisafe DJI backend ✔ Render → Supabase klar");
});

// ---- TEST-ROUTE: manuelt kall for å sjekke at alt funker ----
// Bruk f.eks. POSTMAN/Insomnia eller curl.
app.post("/test-insert", async (req, res) => {
  try {
    const {
      drone_id = "test-drone",
      lat = 63.4,
      lon = 10.4,
      alt = 100,
      raw = null
    } = req.body || {};

    const data = await insertTelemetry({ drone_id, lat, lon, alt, raw });

    res.json({ ok: true, data });
  } catch (err) {
    console.error("❌ Feil ved test-insert:", err.response?.data || err.message);
    res
      .status(500)
      .json({ ok: false, error: err.response?.data || err.message });
  }
});

// ---- FAKE DJI TELEMETRY: slik vi kommer til å behandle ekte DJI-data ----
app.post("/dji/telemetry", async (req, res) => {
  try {
    const body = req.body;

    // Tillat både ett objekt og array
    const items = Array.isArray(body) ? body : [body];

    const cleaned = items.map((msg) => {
      // Forventet DJI-aktig struktur:
      // {
      //   drone_sn: "ABCDE12345",
      //   timestamp: 1733412345000,
      //   position: { lat: 63.421, lng: 10.435, alt: 115 },
      //   flight_status: "IN_AIR",
      //   battery: 86,
      //   speed: 12.3
      // }

      const position = msg.position || msg.pos || {};

      const lat =
        position.lat ??
        position.latitude ??
        null;

      const lon =
        position.lng ??
        position.lon ??
        position.longitude ??
        null;

      const alt =
        position.alt ??
        position.altitude ??
        null;

      const droneId =
        msg.drone_sn ??
        msg.drone_id ??
        "unknown-dji";

      return {
        drone_id: droneId,
        lat,
        lon,
        alt,
        raw: msg
      };
    });

    const valid = cleaned.filter((c) => c.lat !== null && c.lon !== null);

    if (valid.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Ingen gyldige posisjoner (lat/lon mangler)"
      });
    }

    const data = await insertTelemetryBulk(valid);

    res.json({
      ok: true,
      received: items.length,
      stored: data.length,
      data
    });
  } catch (err) {
    console.error("❌ Feil i /dji/telemetry:", err.response?.data || err.message);
    res
      .status(500)
      .json({ ok: false, error: err.response?.data || err.message });
  }
});

// ---- (VALGFRITT) DJI TEST-ENDPOINT – bare for å se at nøkler funker ut ----
app.get("/dji/test", async (req, res) => {
  try {
    const response = await axios.get(`${DJI_API_URL}/api/v1/app/version`, {
      headers: {
        "x-api-key": DJI_APP_KEY
      }
    });

    res.json({ ok: true, data: response.data });
  } catch (err) {
    console.error("❌ DJI test feilet:", err.response?.data || err.message);
    res
      .status(500)
      .json({ ok: false, error: err.response?.data || err.message });
  }
});

// ---- START SERVER ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
  console.log("SUPABASE_URL:", SUPABASE_URL ? "OK" : "Mangler");
});
