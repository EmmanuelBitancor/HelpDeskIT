"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { roleRoutes } from "@/context/authTypes";
import ForgotPasswordModal from "./settings/components/ForgotPasswordModal";
import OtpModal from "./components/OtpModal";
import Loading from "@/components/Loading";

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { signIn, rememberMe: savedRememberMe, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmShowPassword, setConfirmShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(savedRememberMe);
  const [mobileView, setMobileView] = useState<"panel" | "form">("form");
  const trustHighlights = [
    "Smart ticket triage",
    "Faster response times",
    "SLA tracking built in",
  ];
  const isSubmitting = loading || isLoading;

  useEffect(() => {
    if (user?.role && pathname === "/") {
      router.replace(roleRoutes[user.role]);
    }
  }, [pathname, router, user?.role]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError("");
  };

  const handleOtpVerified = async () => {
    setIsOtpModalOpen(false);
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn(signupEmail, signupPassword, rememberMe);
      if (result.ok && result.role) {
        router.replace(roleRoutes[result.role]);
      } else {
        setError(result.error ?? "Your account was created, but we couldn't sign you in automatically. Please sign in manually.");
      }
    } catch {
      setError("An unexpected error occurred");
    }

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("The passwords you entered do not match. Please try again.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "We couldn't create your account. Please try again.");
        setIsLoading(false);
        return;
      }

      setSignupEmail(email);
      setSignupPassword(password);
      setIsOtpModalOpen(true);
    } catch {
      setError("An unexpected error occurred. Please refresh the page and try again.");
    }

    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    const result = await signIn(email, password, rememberMe);
    if (result.ok && result.role) {
      router.replace(roleRoutes[result.role]);
    } else {
      setError(result.error ?? "Invalid email or password. Please try again.");
    }
    setIsLoading(false);
  };

  // Show loading screen while checking auth state
  if (loading) {
    return <Loading />;
  }

  // Redirect logged-in users to their dashboard after render completes
  if (user?.role && pathname === "/") {
    return <Loading />;
  }

  return (
    <div className="auth-shell">
      <style>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-100%) translateY(-50%);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(-50%);
          }
        }
        @keyframes slideOutLeft {
          from {
            opacity: 1;
            transform: translateX(-50%) translateY(-50%);
          }
          to {
            opacity: 0;
            transform: translateX(-100%) translateY(-50%);
          }
        }
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%) translateY(-50%);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(-50%);
          }
        }
        @keyframes slideOutRight {
          from {
            opacity: 1;
            transform: translateX(-50%) translateY(-50%);
          }
          to {
            opacity: 0;
            transform: translateX(100%) translateY(-50%);
          }
        }
        @media (max-width: 768px) {
          .auth-grid {
            display: flex !important;
            align-items: center;
            justify-content: center;
            position: relative;
            min-height: 100vh;
          }
          .auth-side-panel {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translateX(-50%) translateY(-50%);
            width: 90%;
            max-width: 400px;
            ${mobileView === "panel" ? "animation: slideInLeft 0.4s ease-out forwards;" : "animation: slideOutLeft 0.4s ease-out forwards; pointer-events: none;"}
            cursor: pointer;
          }
          .auth-side-panel:hover {
            opacity: 0.9;
          }
          .auth-card {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translateX(-50%) translateY(-50%);
            width: 90%;
            max-width: 400px;
            ${mobileView === "form" ? "animation: slideInRight 0.4s ease-out forwards;" : "animation: slideOutRight 0.4s ease-out forwards; pointer-events: none;"}
          }
          .mobile-back-button {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            margin-bottom: 16px;
            background: transparent;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            color: #1f2937;
            font-size: 14px;
            transition: all 0.3s;
          }
          .mobile-back-button:hover {
            background: #f3f4f6;
          }
        }
        @media (min-width: 769px) {
          .mobile-back-button {
            display: none !important;
          }
          .auth-side-panel {
            cursor: default !important;
          }
        }
      `}</style>

      <div className="auth-grid">
        <aside 
          className="auth-side-panel"
          onClick={() => {
            if (window.innerWidth <= 768) {
              setMobileView("form");
            }
          }}
        >
          <div className="auth-badge">HelpDeskIT</div>
          <div className="auth-side-content">
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes spinReverse {
                from { transform: rotate(360deg); }
                to { transform: rotate(0deg); }
              }
              .icon-spinner {
                animation: spin 6s linear infinite;
              }
              .icon-spinner-reverse {
                animation: spinReverse 8s linear infinite;
              }
            `}</style>
            <div className="flex justify-center mb-8">
              <div style={{
                position: "relative",
                width: "200px",
                height: "200px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {/* Spinning outer ring of symbols */}
                <div className="icon-spinner" style={{
                  position: "absolute",
                  width: "200px",
                  height: "200px"
                }}>
                  {/* Gear symbol - top */}
                  <div style={{
                    position: "absolute",
                    top: "-10px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "24px"
                  }}>⚙️</div>
                  {/* Wrench symbol - top right */}
                  <div style={{
                    position: "absolute",
                    top: "15px",
                    right: "15px",
                    fontSize: "24px"
                  }}>🔧</div>
                  {/* Hammer symbol - right */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    right: "-10px",
                    transform: "translateY(-50%)",
                    fontSize: "24px"
                  }}>🔨</div>
                  {/* Wrench symbol - bottom right */}
                  <div style={{
                    position: "absolute",
                    bottom: "15px",
                    right: "15px",
                    fontSize: "24px"
                  }}>🔧</div>
                  {/* Gear symbol - bottom */}
                  <div style={{
                    position: "absolute",
                    bottom: "-10px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "24px"
                  }}>⚙️</div>
                  {/* Wrench symbol - bottom left */}
                  <div style={{
                    position: "absolute",
                    bottom: "15px",
                    left: "15px",
                    fontSize: "24px"
                  }}>🔧</div>
                  {/* Hammer symbol - left */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "-10px",
                    transform: "translateY(-50%)",
                    fontSize: "24px"
                  }}>🔨</div>
                  {/* Wrench symbol - top left */}
                  <div style={{
                    position: "absolute",
                    top: "15px",
                    left: "15px",
                    fontSize: "24px"
                  }}>🔧</div>
                </div>

                {/* Center circular image */}
                <div style={{
                  position: "relative",
                  zIndex: 10,
                  width: "150px",
                  height: "150px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "4px solid #1f2937",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f3f4f6"
                }}>
                  <img 
                    src="/helpdesk-icon.png" 
                    alt="HelpDesk Icon" 
                    style={{
                      width: "120px",
                      height: "120px",
                      objectFit: "contain"
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="auth-eyebrow">Support operations, simplified</p>
            <h1>Keep your team responsive without the chaos.</h1>
            <p className="auth-subtext">
Manage tickets, coordinate teams, and keep every escalation moving with a clearer view of service health.
            </p>

            <div className="auth-pill-row">
{trustHighlights.map((item) => (
  <span key={item} className="auth-pill">
    {item}
  </span>
))}
            </div>

     
          </div>
        </aside>

        <main className="auth-card">
          <button
            type="button"
            onClick={() => setMobileView("panel")}
            className="mobile-back-button"
          >
            <span>←</span>
            Back to About
          </button>
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
{isSignUp ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
{isSignUp ? "Set up your workspace and start supporting your users." : "Sign in to your HelpDeskIT account to continue."}
            </p>
          </div>

          <div className="mb-6 flex justify-center">
            <div className="auth-toggle">
<button
  type="button"
  onClick={() => {
    setIsSignUp(false);
    setError("");
  }}
  className={`auth-toggle-button ${!isSignUp ? "is-active" : ""}`}
>
  Sign In
</button>
<button
  type="button"
  onClick={() => {
    setIsSignUp(true);
    setError("");
  }}
  className={`auth-toggle-button ${isSignUp ? "is-active" : ""}`}
>
  Sign Up
</button>
            </div>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleSubmit} className="space-y-4">
            {isSignUp && (
<div>
  <label htmlFor="name" className="block text-sm font-medium text-foreground">
    Full Name
  </label>
  <input
    id="name"
    type="text"
    autoComplete="name"
    required
    value={name}
    onChange={(e) => setName(e.target.value)}
    className="auth-input mt-1"
    placeholder="Enter your full name"
  />
</div>
            )}

            <div>
<label htmlFor="email" className="block text-sm font-medium text-foreground">
  Email Address
</label>
<input
  id="email"
  type="email"
  autoComplete="username"
  required
  value={email}
  onChange={handleChange}
  className="auth-input mt-1"
  placeholder="you@company.com"
/>
            </div>

            <div>
<label htmlFor="password" className="block text-sm font-medium text-foreground">
  Password
</label>
<div className="relative mt-1">
  <input
    id="password"
    type={showPassword ? "text" : "password"}
    autoComplete={isSignUp ? "new-password" : "current-password"}
    required
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    className="auth-input block w-full pr-10"
    placeholder="Enter your password"
  />
  <button
    type="button"
    aria-label={showPassword ? "Hide password" : "Show password"}
    onClick={() => setShowPassword((v) => !v)}
    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-zinc-500 hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200 focus:outline-none"
  >
    {showPassword ? (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      </svg>
    ) : (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )}
  </button>
</div>
            </div>

            {isSignUp && (
<div>
  <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
    Confirm Password
  </label>
  <div className="relative mt-1">
    <input
      id="confirmPassword"
      type={confirmShowPassword ? "text" : "password"}
      autoComplete="new-password"
      required
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      className="auth-input block w-full pr-10"
      placeholder="Re-enter your password"
    />
    <button
      type="button"
      aria-label={confirmShowPassword ? "Hide password" : "Show password"}
      onClick={() => setConfirmShowPassword((v) => !v)}
      className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-zinc-500 hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200 focus:outline-none"
    >
      {confirmShowPassword ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )}
    </button>
  </div>
</div>
            )}

            {!isSignUp && (
<div className="flex items-center">
  <input
    id="rememberMe"
    type="checkbox"
    checked={rememberMe}
    onChange={(e) => setRememberMe(e.target.checked)}
    className="h-4 w-4 rounded border-zinc-300 text-foreground focus:ring-foreground focus:ring-offset-0 dark:border-zinc-700 dark:bg-zinc-900"
  />
  <label htmlFor="rememberMe" className="ml-2 block cursor-pointer select-none text-sm text-zinc-600 dark:text-zinc-400">
    Stay logged in
  </label>
</div>
            )}

            {error && (
<p role="alert" className="text-sm text-red-600 dark:text-red-400">
  {error}
</p>
            )}

            <button
type="submit"
disabled={isSubmitting}
className="auth-primary-button"
            >
{isSubmitting ? (isSignUp ? "Creating your account..." : "Signing you in...") : isSignUp ? "Create Account" : "Sign In"}
            </button>

            {!isSignUp && (
<div className="text-center">
  <button
    type="button"
    onClick={() => setIsForgotPasswordOpen(true)}
    className="text-sm font-medium text-foreground underline hover:no-underline"
  >
    Forgot your password?
  </button>
</div>
            )}
          </form>
        </main>
      </div>

      {isForgotPasswordOpen && (
        <ForgotPasswordModal isOpen={isForgotPasswordOpen} onClose={() => setIsForgotPasswordOpen(false)} />
      )}
      <OtpModal
        isOpen={isOtpModalOpen}
        onClose={() => setIsOtpModalOpen(false)}
        email={signupEmail}
        onVerified={handleOtpVerified}
      />
    </div>
  );
}
