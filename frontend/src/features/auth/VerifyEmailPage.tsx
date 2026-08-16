import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";

import "./LoginPage.css";
import "./VerifyEmailPage.css";

type VerificationLocationState = {
  email?: string;
  pending?: boolean;
};

const constellationNodes = [
  { x: 8, y: 16, delay: 0.1, size: 4 },
  { x: 16, y: 30, delay: 1.2, size: 3 },
  { x: 23, y: 12, delay: 0.5, size: 5 },
  { x: 31, y: 42, delay: 1.8, size: 4 },
  { x: 47, y: 34, delay: 2.1, size: 5 },
  { x: 64, y: 43, delay: 0.2, size: 4 },
  { x: 73, y: 24, delay: 2.4, size: 5 },
  { x: 89, y: 36, delay: 1.7, size: 4 },
  { x: 28, y: 79, delay: 0.8, size: 4 },
  { x: 61, y: 82, delay: 2.0, size: 5 },
  { x: 91, y: 84, delay: 1.4, size: 4 },
];

function storedPendingEmail() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("sheyihub_pending_verification_email") ?? "";
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");
  const location = useLocation();
  const state = (location.state as VerificationLocationState | null) ?? null;

  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const initialEmail = state?.email ?? user?.email ?? storedPendingEmail();

  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const code = useMemo(() => digits.join(""), [digits]);

  // Backwards compatibility: old link emails continue to work.
  const legacyMutation = useMutation({ mutationFn: authApi.verifyEmail });

  useEffect(() => {
    if (uid && token) legacyMutation.mutate({ uid, token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, token]);

  const verifyMutation = useMutation({
    mutationFn: authApi.verifyEmailCode,
    onSuccess: () => {
      updateUser({ email_verified: true });
      sessionStorage.removeItem("sheyihub_pending_verification_email");
      setFormError(null);
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "That code could not be verified. Try again.",
      );
    },
  });

  const resendMutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: (response) => {
      setSecondsLeft(Math.max(1, response.cooldown_seconds || 60));
      setFormError(null);
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "We could not resend the code. Try again shortly.",
      );
    },
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  function changeDigit(index: number, event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setFormError(null);

    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    event.preventDefault();
    const next = Array.from({ length: 6 }, (_, index) => pasted[index] ?? "");
    setDigits(next);
    inputs.current[Math.min(pasted.length, 6) - 1]?.focus();
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!email) {
      setFormError("Enter the email address you registered with.");
      return;
    }

    if (code.length !== 6) {
      setFormError("Enter all 6 digits from your email.");
      return;
    }

    verifyMutation.mutate({ email, code });
  }

  function resendCode() {
    if (!email || secondsLeft > 0) return;
    resendMutation.mutate({ email });
  }

  if (uid && token) {
    const stateName = legacyMutation.isPending
      ? "loading"
      : legacyMutation.isSuccess
        ? "success"
        : legacyMutation.isError
          ? "error"
          : "loading";

    return <PremiumStatusScreen state={stateName} />;
  }

  if (verifyMutation.isSuccess) {
    return <PremiumStatusScreen state="success" />;
  }

  return (
    <main className="premium-auth premium-verify">
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

      <section className="premium-verify__wrap">
        <Link to="/" className="premium-auth__brand" aria-label="SheyiHub home">
          <span className="premium-auth__brand-mark" aria-hidden="true">S</span>
          <span>SheyiHub</span>
        </Link>

        <form className="premium-verify__card" onSubmit={submitCode}>
          <div className="premium-auth__card-glow" aria-hidden="true" />

          <div className="premium-verify__icon" aria-hidden="true">
            <MailCheck size={31} />
          </div>

          <span className="premium-verify__kicker">SECURE EMAIL VERIFICATION</span>
          <h1>Enter your code</h1>
          <p>
            We sent a 6-digit verification code to your email.
            Enter it below to activate your SheyiHub account.
          </p>

          <label className="premium-verify__email-label" htmlFor="verify-email">
            Email
          </label>
          <input
            id="verify-email"
            className="premium-verify__email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              sessionStorage.setItem(
                "sheyihub_pending_verification_email",
                event.target.value,
              );
            }}
          />

          <div
            className="premium-verify__digits"
            onPaste={handlePaste}
            aria-label="Six digit verification code"
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputs.current[index] = element;
                }}
                aria-label={`Verification digit ${index + 1}`}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onChange={(event) => changeDigit(index, event)}
                onKeyDown={(event) => handleKeyDown(index, event)}
              />
            ))}
          </div>

          {formError ? (
            <p role="alert" className="premium-auth__error premium-verify__error">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            className="premium-auth__submit"
            disabled={code.length !== 6 || !email || verifyMutation.isPending}
          >
            {verifyMutation.isPending ? "Verifying..." : "Verify email"}
            {!verifyMutation.isPending ? (
              <ArrowRight size={18} />
            ) : (
              <span className="premium-auth__spinner" />
            )}
          </button>

          <div className="premium-verify__resend">
            <span>Didn't receive the code?</span>
            <button
              type="button"
              onClick={resendCode}
              disabled={!email || secondsLeft > 0 || resendMutation.isPending}
            >
              <RefreshCw
                size={14}
                className={resendMutation.isPending ? "is-spinning" : ""}
              />
              {secondsLeft > 0
                ? `Resend in ${secondsLeft}s`
                : resendMutation.isPending
                  ? "Sending..."
                  : "Resend code"}
            </button>
          </div>

          <div className="premium-verify__security">
            <ShieldCheck size={15} />
            Never share your verification code with anyone.
          </div>

          <Link to="/login" className="premium-verify__back">
            Back to login
          </Link>
        </form>
      </section>
    </main>
  );
}

function PremiumStatusScreen({
  state,
}: {
  state: "loading" | "success" | "error";
}) {
  return (
    <main className="premium-auth premium-verify">
      <div className="premium-auth__aurora premium-auth__aurora--one" />
      <div className="premium-auth__aurora premium-auth__aurora--two" />
      <div className="premium-auth__grid" />

      <section className="premium-verify__wrap">
        <Link to="/" className="premium-auth__brand" aria-label="SheyiHub home">
          <span className="premium-auth__brand-mark" aria-hidden="true">S</span>
          <span>SheyiHub</span>
        </Link>

        <div className="premium-verify__card premium-verify__status">
          {state === "loading" ? (
            <>
              <div className="premium-verify__status-spinner" />
              <h1>Verifying your email</h1>
              <p>Just a moment while SheyiHub confirms your account.</p>
            </>
          ) : state === "success" ? (
            <>
              <div className="premium-verify__icon premium-verify__icon--success">
                <CheckCircle2 size={34} />
              </div>
              <span className="premium-verify__kicker">VERIFIED</span>
              <h1>Email verified</h1>
              <p>
                You're ready to collaborate. Your verified status is now active on
                SheyiHub.
              </p>
              <Link to="/login" className="premium-verify__continue">
                Continue to login
                <ArrowRight size={17} />
              </Link>
            </>
          ) : (
            <>
              <div className="premium-verify__icon premium-verify__icon--error">
                <XCircle size={34} />
              </div>
              <span className="premium-verify__kicker">VERIFICATION FAILED</span>
              <h1>We couldn't verify that link</h1>
              <p>
                The old verification link is invalid or expired. Request a new
                6-digit code instead.
              </p>
              <Link to="/verify-email" className="premium-verify__continue">
                Use a verification code
                <ArrowRight size={17} />
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
