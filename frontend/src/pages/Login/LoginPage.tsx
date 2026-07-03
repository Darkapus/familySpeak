import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSetupStatus, login, setup } from "../../api/auth.js";
import { submitSignupRequest } from "../../api/signupRequests.js";
import { useAuthStore } from "../../store/auth.js";
import { ApiError } from "../../api/client.js";

function Card({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-8 shadow-xl">{children}</div>
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="text-center">
      <p className="text-5xl">💬</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-800">FamilySpeak</h1>
      <p className="text-base text-slate-400">{subtitle}</p>
    </div>
  );
}

function FirstRunSetupForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { accessToken, user } = await setup(username, password, displayName);
      useAuthStore.getState().setSession(accessToken, user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la création du compte");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Header subtitle="Bienvenue ! Crée le compte parent pour démarrer." />
      <div className="space-y-1">
        <label htmlFor="displayName" className="text-base font-semibold text-slate-600">
          Ton nom (ex : Papa)
        </label>
        <input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
          autoComplete="name"
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="username" className="text-base font-semibold text-slate-600">
          Identifiant
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
          Mot de passe (8 caractères min.)
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {error && <p className="text-base text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-emerald-500 py-3 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50"
      >
        {isSubmitting ? "Création..." : "Créer le compte parent 👑"}
      </button>
    </form>
  );
}

function LoginForm({ onRequestAccount }: { onRequestAccount: () => void }) {
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <Header subtitle="Notre messagerie à nous !" />
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
      <button
        type="button"
        onClick={onRequestAccount}
        className="w-full rounded-full border-2 border-emerald-400 bg-emerald-50 py-3 text-base font-bold text-emerald-700 transition hover:bg-emerald-100"
      >
        Pas encore de compte ? Demander un accès enfant 🙋
      </button>
    </form>
  );
}

function SignupRequestForm({ onBackToLogin }: { onBackToLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setIsSubmitting(true);
    try {
      await submitSignupRequest({ username, displayName, password, passwordConfirm });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'envoi de la demande");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-5 text-center">
        <Header subtitle="Demande envoyée !" />
        <p className="text-base text-slate-600">
          Ta demande a été envoyée ! Un parent doit l'approuver avant que tu puisses te connecter. 🎉
        </p>
        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full rounded-full bg-emerald-500 py-3 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-600"
        >
          Retour à la connexion
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Header subtitle="Demander un accès" />
      <div className="space-y-1">
        <label htmlFor="signup-displayName" className="text-base font-semibold text-slate-600">
          Ton prénom
        </label>
        <input
          id="signup-displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
          autoComplete="name"
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="signup-username" className="text-base font-semibold text-slate-600">
          Identifiant souhaité
        </label>
        <input
          id="signup-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
          autoComplete="username"
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="signup-password" className="text-base font-semibold text-slate-600">
          Mot de passe (8 caractères min.)
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="signup-passwordConfirm" className="text-base font-semibold text-slate-600">
          Confirme ton mot de passe
        </label>
        <input
          id="signup-passwordConfirm"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {error && <p className="text-base text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-emerald-500 py-3 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50"
      >
        {isSubmitting ? "Envoi..." : "Envoyer la demande 🙋"}
      </button>
      <button
        type="button"
        onClick={onBackToLogin}
        className="w-full text-center text-sm font-semibold text-slate-400 hover:text-slate-600"
      >
        Retour à la connexion
      </button>
    </form>
  );
}

export function LoginPage() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"login" | "signup-request">("login");

  useEffect(() => {
    fetchSetupStatus()
      .then(({ needsSetup }) => setNeedsSetup(needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  if (needsSetup === null) {
    return <Card />;
  }

  if (needsSetup) {
    return (
      <Card>
        <FirstRunSetupForm />
      </Card>
    );
  }

  return (
    <Card>
      {mode === "login" ? (
        <LoginForm onRequestAccount={() => setMode("signup-request")} />
      ) : (
        <SignupRequestForm onBackToLogin={() => setMode("login")} />
      )}
    </Card>
  );
}
