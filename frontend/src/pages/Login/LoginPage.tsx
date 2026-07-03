import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../api/auth.js";
import { useAuthStore } from "../../store/auth.js";
import { ApiError } from "../../api/client.js";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { accessToken, user } = await login(username, password);
      useAuthStore.getState().setSession(accessToken, user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <p className="text-5xl">💬</p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-800">FamilySpeak</h1>
          <p className="text-base text-slate-400">Notre messagerie à nous !</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="username" className="text-base font-semibold text-slate-600">
            Ton identifiant
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-base font-semibold text-slate-600">
            Ton mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-base text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-emerald-500 py-3 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50"
        >
          {isSubmitting ? "Connexion..." : "C'est parti ! 🚀"}
        </button>
      </form>
    </div>
  );
}
