import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthBootstrap } from "./hooks/useAuthBootstrap.js";
import { usePwaAutoReload } from "./hooks/usePwaAutoReload.js";
import { RequireAuth } from "./components/RequireAuth.js";
import { IosInstallHint } from "./components/IosInstallHint.js";
import { LoginPage } from "./pages/Login/LoginPage.js";
import { ConversationsPage } from "./pages/Conversations/ConversationsPage.js";

export function App() {
  useAuthBootstrap();
  usePwaAutoReload();

  return (
    <BrowserRouter>
      <IosInstallHint />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <ConversationsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
