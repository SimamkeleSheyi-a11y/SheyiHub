import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  FolderOpen,
  LockKeyhole,
  Mail,
  MessageCircle,
  PenTool,
  ShieldCheck,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";

import "./LoginPage.css";

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
  { icon: MessageCircle, title: "Team chat", text: "Real-time messaging" },
  { icon: Video, title: "Meetings", text: "Video + screen share" },
  { icon: FolderOpen, title: "Files", text: "Secure file sharing" },
  { icon: PenTool, title: "Whiteboard", text: "Create together" },
];

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.access);
      navigate(from, { replace: true });
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    loginMutation.mutate({ email, password });
  }

  return (
    <main className="premium-auth">
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

      <section className="premium-auth__content">
        <div className="premium-auth__hero">
          <Link to="/" className="premium-auth__brand" aria-label="SheyiHub home">
            <span className="premium-auth__brand-mark" aria-hidden="true">S</span>
            <span>SheyiHub</span>
          </Link>

          <div className="premium-auth__eyebrow">
            <Sparkles size={15} />
            All-in-one collaboration platform
          </div>

          <h1>
            One workspace.
            <br />
            Every way to <span>collaborate.</span>
          </h1>

          <p className="premium-auth__lead">
            Chat, meet, share and create together in one beautifully connected workspace.
          </p>

          <div className="premium-auth__features">
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

          <div className="premium-auth__preview" aria-hidden="true">
            <div className="premium-auth__preview-sidebar">
              <div className="premium-auth__preview-logo">
                <span className="premium-auth__mini-mark">S</span>
                <strong>SheyiHub</strong>
              </div>
              <small>WORKSPACE</small>
              <div className="premium-auth__workspace-chip">Product Team</div>
              <nav>
                <span className="is-active">Home</span>
                <span>Messages</span>
                <span>Meetings</span>
                <span>Files</span>
                <span>Whiteboard</span>
              </nav>
            </div>

            <div className="premium-auth__preview-main">
              <div className="premium-auth__preview-heading">
                <div>
                  <strong>Welcome back 👋</strong>
                  <small>Here&apos;s what&apos;s happening in your workspace.</small>
                </div>
                <div className="premium-auth__avatars">
                  <i />
                  <i />
                  <i />
                </div>
              </div>

              <div className="premium-auth__stats">
                <div><small>Unread messages</small><strong>24</strong></div>
                <div><small>Upcoming meetings</small><strong>3</strong></div>
                <div><small>Tasks due</small><strong>8</strong></div>
              </div>

              <div className="premium-auth__activity">
                <small>RECENT ACTIVITY</small>
                <div><i /><span><strong>Ami shared a file</strong><small>Q2_Product_Strategy.pdf</small></span><em>2m</em></div>
                <div><i /><span><strong>Sarah commented</strong><small>Website Redesign</small></span><em>15m</em></div>
                <div><i /><span><strong>Meeting starting soon</strong><small>Product Daily Standup</small></span><em>1h</em></div>
              </div>
            </div>

            <div className="premium-auth__preview-meeting">
              <small>UPCOMING</small>
              <strong>Product Daily Standup</strong>
              <span>Today · 10:00 AM</span>
              <button type="button" tabIndex={-1}>Join meeting</button>
            </div>
          </div>
        </div>

        <div className="premium-auth__form-column">
          <div className="premium-auth__security-chip">
            <ShieldCheck size={15} />
            Secure workspace access
          </div>

          <form className="premium-auth__card" onSubmit={handleSubmit}>
            <div className="premium-auth__card-glow" aria-hidden="true" />

            <div className="premium-auth__card-brand">
              <span className="premium-auth__brand-mark premium-auth__brand-mark--small" aria-hidden="true">S</span>
              <strong>SheyiHub</strong>
            </div>

            <div className="premium-auth__form-heading">
              <h2>Welcome back</h2>
              <p>Sign in to continue to your workspace</p>
            </div>

            <div className="premium-auth__field">
              <label htmlFor="login-email">Email</label>
              <div className="premium-auth__input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="premium-auth__field">
              <div className="premium-auth__label-row">
                <label htmlFor="login-password">Password</label>
                <Link to="/reset-password">Forgot password?</Link>
              </div>
              <div className="premium-auth__input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            {formError ? (
              <p role="alert" className="premium-auth__error">
                {formError}
              </p>
            ) : null}

            <button
              className="premium-auth__submit"
              type="submit"
              disabled={!email || !password || loginMutation.isPending}
            >
              <span>{loginMutation.isPending ? "Signing in..." : "Log in"}</span>
              {!loginMutation.isPending ? <ArrowRight size={19} /> : <span className="premium-auth__spinner" />}
            </button>

            <div className="premium-auth__trust-row">
              <div><ShieldCheck size={15} /> Protected</div>
              <div><Zap size={15} /> Real-time</div>
            </div>

            <p className="premium-auth__signup">
              New to SheyiHub? <Link to="/register">Create an account</Link>
            </p>
          </form>

          <p className="premium-auth__fineprint">
            Collaboration without the clutter.
          </p>
        </div>
      </section>
    </main>
  );
}
