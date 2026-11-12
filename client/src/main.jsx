// client/src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { HelmetProvider } from "react-helmet-async";
import { Provider } from "react-redux";
import "./index.css";
import App from "./App.jsx";
import { RoleProvider } from "./context/RoleContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { store } from "./store/store.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { reloadOnceForNewDeploy } from "./utils/reloadOnce.js";

// Vite fires this when a lazy chunk fails to load (stale tab after a deploy).
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForNewDeploy();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <HelmetProvider>
          <ThemeProvider>
            <RoleProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </RoleProvider>
          </ThemeProvider>
        </HelmetProvider>
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
);
