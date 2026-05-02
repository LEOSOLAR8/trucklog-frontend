import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "leaflet/dist/leaflet.css";
import "./index.css";
import App from "./App.tsx";

import L from "leaflet";

type LeafletIconDefaultPrototype = L.Icon.Default & {
  _getIconUrl?: () => string;
};

const defaultIconPrototype = L.Icon.Default.prototype as LeafletIconDefaultPrototype;
delete defaultIconPrototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet/dist/images/marker-shadow.png",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);