import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import BroadCameraPage from "./pages/BroadCameraPage";
import "./index.css";

const isBroadCameraRoute =
  window.location.pathname === "/camera" || window.location.pathname.endsWith("/camera");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isBroadCameraRoute ? <BroadCameraPage /> : <App />}
  </StrictMode>,
);
