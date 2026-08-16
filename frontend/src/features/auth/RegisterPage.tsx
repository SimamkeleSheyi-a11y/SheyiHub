import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  LockKeyhole,
  Mail,
  MailCheck,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/apiClient";

import "./LoginPage.css";
import "./RegisterPage.css";

const constellationNodes = [
  { x: 8, y: 16, delay: 0.1, size: 4 },
  { x: 16, y: 30, delay: 1.2, size: 3 },
  { x: 23, y: 12, delay: 0.5, size: 5 },
  { x: 31, y: 42, delay: 1.8, size: 4 },
  { x: 39, y: 21, delay: 0.9, size: 3 },
  { x: 47, y: 34, delay: 2.1, size: 5 },
  { x: 57, y: 15, delay: 1.5, size: 3 },
  { x: 64, y: 43, delay: 0.2, size: 4 },
  { x: 73, y: 24, delay: 2.4, size: 5 },
  { x: 82, y: 12, delay: 0.7, size: 3 },
  { x: 89, y: 36, delay: 1.7, size: 4 },
  { x: 94, y: 18, delay: 2.8, size: 3 },
  { x: 12, y: 70, delay: 2.3, size: 3 },
  { x: 28, y: 79, delay: 0.8, size: 4 },
  { x: 45, y: 66, delay: 1.1, size: 3 },
  { x: 61, y: 82, delay: 2.0, size: 5 },
  { x: 78, y: 72, delay: 0.4, size: 3 },
  { x: 91, y: 84, delay: 1.4, size: 4 },
];

const featurePills = [
  { icon: MessageCircle, title: "Team chat", text: "Stay connected" },
  { icon: Video, title: "Meetings", text: "Meet face to face" },
  { icon: FolderOpen, title: "Files", text: "Share securely" },
  { icon: UsersRound, title: "Workspaces", text: "Build together" },
];

function fieldError(
  errors: Record<string, string>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    if (errors[key]) return errors[key];
  }
  return undefined;
}

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.errors) {
          setFieldErrors(
            Object.fromEntries(
              Object.entries(err.errors).map(([key, value]) => [key, value[0]]),
            ),
          );
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    if (password !== confirmPassword) {
      setFieldErrors({ confirm_password: "Passwords do not match." });
      return;
    }

    registerMutation.mutate({
      email,
      password,
      display_name: displayName,
    });
  }

  if (registerMutation.isSuccess) {
    sessionStorage.setItem("sheyihub_pending_verification_email", email);
    return (
      <main className="premium-auth premium-register premium-register--success">
        <div className="premium-auth__aurora premium-auth__aurora--one" />
        <div className="premium-auth__aurora premium-auth__aurora--two" />
        <div className="premium-auth__grid" />

        <div className="premium-auth__constellation" aria-hidden="true">
          {constellationNodes.map((node, index) => (
            <span
              key={index}
              className="premium-auth__star"
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                width: `${node.size}px`,
                height: `${node.size}px`,
                animationDelay: `${node.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="premium-register__success-wrap">
          <Link to="/" className="premium-auth__brand" aria-label="SheyiHub home">
            <span className="premium-auth__brand-mark" aria-hidden="true">S</span>
            <span>SheyiHub</span>
          </Link>

          <section className="premium-register__success-card">
            <div className="premium-register__success-icon" aria-hidden="true">
              <MailCheck size={34} />
            </div>

            <span className="premium-register__success-kicker">ONE LAST STEP</span>
            <h1>Check your email</h1>
            <p>
              We sent a verification link to <strong>{email}</strong>.
              Open it to activate your SheyiHub account.
            </p>

            <div className="premium-register__success-note">
              <ShieldCheck size={17} aria-hidden="true" />
              Your account stays protected until your email is verified.
            </div>

            <Link
              to="/verify-email"
              state={{ email }}
              className="premium-register__back"
            >
              Enter verification code
              <ArrowRight size={17} />
            </Link>

            <Link to="/login" className="premium-register__secondary-link">
              Back to login
            </Link>
          </section>

          <p className="premium-auth__fineprint">Welcome to the hub.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="premium-auth premium-register">
      <div className="premium-auth__aurora premium-auth__aurora--one" />
      <div className="premium-auth__aurora premium-auth__aurora--two" />
      <div className="premium-auth__grid" />

      <div className="premium-auth__constellation" aria-hidden="true">
        {constellationNodes.map((node, index) => (
          <span
            key={index}
            className="premium-auth__star"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              width: `${node.size}px`,
              height: `${node.size}px`,
              animationDelay: `${node.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="premium-auth__wave" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className="premium-auth__content premium-register__content">
        <div className="premium-auth__hero premium-register__hero">
          <Link to="/" className="premium-auth__brand" aria-label="SheyiHub home">
            <span className="premium-auth__brand-mark" aria-hidden="true">S</span>
            <span>SheyiHub</span>
          </Link>

          <div className="premium-auth__eyebrow">
            <Sparkles size={15} />
            Your workspace starts here
          </div>

          <h1>
            Build together.
            <br />
            From the <span>first hello.</span>
          </h1>

          <p className="premium-auth__lead">
            Create your SheyiHub account and bring conversations, meetings, files
            and teamwork into one connected workspace.
          </p>

          <div className="premium-auth__features premium-register__features">
            {featurePills.map(({ icon: Icon, title, text }) => (
              <div className="premium-auth__feature" key={title}>
                <span>
                  <Icon size={18} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="premium-register__promise-card">
            <div className="premium-register__promise-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span>Built for trusted collaboration</span>
              <p>
                Your email is verified before protected workspace actions are unlocked.
              </p>
            </div>
            <CheckCircle2 size={19} />
          </div>
        </div>

        <div className="premium-auth__form-column premium-register__form-column">
          <div className="premium-auth__security-chip">
            <ShieldCheck size={15} />
            Secure account creation
          </div>

          <form className="premium-auth__card premium-register__card" onSubmit={handleSubmit}>
            <div className="premium-auth__card-glow" aria-hidden="true" />

            <div className="premium-auth__card-brand">
              <span
                className="premium-auth__brand-mark premium-auth__brand-mark--small"
                aria-hidden="true"
              >
                S
              </span>
              <strong>SheyiHub</strong>
            </div>

            <div className="premium-auth__form-heading premium-register__heading">
              <h2>Create your account</h2>
              <p>Start collaborating in a workspace built around your team.</p>
            </div>

            <div className="premium-auth__field">
              <label htmlFor="register-display-name">Display name</label>
              <div
                className={`premium-auth__input-wrap ${
                  fieldError(fieldErrors, "display_name", "displayName")
                    ? "premium-register__input--error"
                    : ""
                }`}
              >
                <UserRound size={18} aria-hidden="true" />
                <input
                  id="register-display-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  required
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
              {fieldError(fieldErrors, "display_name", "displayName") ? (
                <p className="premium-register__field-error">
                  {fieldError(fieldErrors, "display_name", "displayName")}
                </p>
              ) : null}
            </div>

            <div className="premium-auth__field">
              <label htmlFor="register-email">Email</label>
              <div
                className={`premium-auth__input-wrap ${
                  fieldError(fieldErrors, "email")
                    ? "premium-register__input--error"
                    : ""
                }`}
              >
                <Mail size={18} aria-hidden="true" />
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              {fieldError(fieldErrors, "email") ? (
                <p className="premium-register__field-error">
                  {fieldError(fieldErrors, "email")}
                </p>
              ) : null}
            </div>

            <div className="premium-register__password-grid">
              <div className="premium-auth__field">
                <label htmlFor="register-password">Password</label>
                <div
                  className={`premium-auth__input-wrap ${
                    fieldError(fieldErrors, "password")
                      ? "premium-register__input--error"
                      : ""
                  }`}
                >
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Create password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </div>

              <div className="premium-auth__field">
                <label htmlFor="register-confirm-password">Confirm password</label>
                <div
                  className={`premium-auth__input-wrap ${
                    fieldError(fieldErrors, "confirm_password")
                      ? "premium-register__input--error"
                      : ""
                  }`}
                >
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="register-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
              </div>
            </div>

            {fieldError(fieldErrors, "password") ? (
              <p className="premium-register__field-error">
                {fieldError(fieldErrors, "password")}
              </p>
            ) : null}

            {fieldError(fieldErrors, "confirm_password") ? (
              <p className="premium-register__field-error">
                {fieldError(fieldErrors, "confirm_password")}
              </p>
            ) : null}

            <div className="premium-register__password-meter" aria-live="polite">
              <div className="premium-register__meter-bars" aria-hidden="true">
                {[1, 2, 3, 4].map((bar) => (
                  <span key={bar} className={passwordScore >= bar ? "is-active" : ""} />
                ))}
              </div>
              <small>
                {password.length === 0
                  ? "Use at least 8 characters."
                  : passwordScore <= 1
                    ? "Password strength: basic"
                    : passwordScore === 2
                      ? "Password strength: good"
                      : "Password strength: strong"}
              </small>
            </div>

            {formError ? (
              <p role="alert" className="premium-auth__error">
                {formError}
              </p>
            ) : null}

            <button
              className="premium-auth__submit"
              type="submit"
              disabled={
                !email ||
                !password ||
                !confirmPassword ||
                !displayName ||
                registerMutation.isPending
              }
            >
              <span>
                {registerMutation.isPending ? "Creating account..." : "Create account"}
              </span>
              {!registerMutation.isPending ? (
                <ArrowRight size={19} />
              ) : (
                <span className="premium-auth__spinner" />
              )}
            </button>

            <div className="premium-auth__trust-row">
              <div>
                <ShieldCheck size={15} />
                Protected
              </div>
              <div>
                <MailCheck size={15} />
                Email verification
              </div>
            </div>

            <p className="premium-auth__signup premium-register__login-link">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </form>

          <p className="premium-auth__fineprint">
            One account. One workspace for everything your team builds.
          </p>
        </div>
      </section>
    </main>
  );
}
