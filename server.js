import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import mqtt from "mqtt";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---- DJI CONFIG ----
const DJI_APP_KEY = process.env.DJI_APP_KEY;
const DJI_LICENSE = process.env.DJI_LICENSE;
const DJI_API_URL = process.env.DJI_API_URL || "https://openapi.dji.com";

// Test route
app.get("/", (req, res) => {
  res.send("Avisafe DJI backend is running ✔");
});

// ---- CONNECT TO DJI MQTT ----
let mqttClient;

function startDJIConnection() {
  console.log("Connecting to DJI Cloud...");

  const options = {
    username: DJI_APP_KEY,
    password: DJI_LICENSE
  };

  // DJI MQTT broker
  const brokerUrl = "mqtts://mqtt-broker.dji.com:8883";

  mqttClient = mqtt.connect(brokerUrl, options);

  mqttClient.on("connect", () => {
    console.log("Connected to DJI Cloud MQTT ✔");
    // Subscribe to your drone topic later
  });

  mqttClient.on("error", (err) => {
    console.error("DJI MQTT Error:", err);
  });
}

startDJIConnection();


// ---- EXAMPLE API ROUTE ----
app.get("/dji/test", async (req, res) => {
  try {
    const response = await axios.get(`${DJI_API_URL}/api/v1/app/version`, {
      headers: { "x-api-key": DJI_APP_KEY }
    });

    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DJI test failed" });
  }
});


// ---- START SERVER ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
