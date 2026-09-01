"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";

interface KnowledgeBaseArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
}

interface KnowledgeBaseProps {
  isOpen: boolean;
  onClose: () => void;
}

const articles: KnowledgeBaseArticle[] = [
  {
    id: "kb-1",
    title: "How do I reset my password?",
    category: "Account",
    tags: ["password", "login", "reset", "account"],
    content:
      "Go to the login page and click 'Forgot password'. Enter your email address and follow the instructions sent to your inbox. If you don't receive the email within 5 minutes, check your spam folder or contact IT support.",
  },
  {
    id: "kb-2",
    title: "VPN connection keeps dropping",
    category: "Network",
    tags: ["vpn", "connection", "network", "wifi", "internet"],
    content:
      "Try disconnecting and reconnecting the VPN. If the issue persists, restart your device, check your internet connection, and ensure your VPN client is up to date. For persistent issues, contact your network administrator.",
  },
  {
    id: "kb-3",
    title: "Printer is not responding",
    category: "Hardware",
    tags: ["printer", "print", "hardware", "offline"],
    content:
      "Ensure the printer is powered on and connected to the network. Try removing and re-adding the printer from your system settings. Restart the printer and your computer. If the issue persists, check for driver updates.",
  },
  {
    id: "kb-4",
    title: "Email sync delay on mobile",
    category: "Email",
    tags: ["email", "outlook", "mail", "sync", "mobile"],
    content:
      "Try signing out and back into your email account on your mobile device. Remove and re-add the account if necessary. Ensure your device has a stable internet connection. Check that push mail is enabled in your email settings.",
  },
  {
    id: "kb-5",
    title: "How to request software installation?",
    category: "Software",
    tags: ["software", "install", "request", "app"],
    content:
      "Submit a ticket under the 'Software' category. Include the software name, version, and your business justification. IT will review your request and typically respond within one business day. Do not install unapproved software on company devices.",
  },
  {
    id: "kb-6",
    title: "Computer is running slow",
    category: "Hardware",
    tags: ["slow", "performance", "lag", "crash", "freezing"],
    content:
      "Restart your device first. Close unnecessary applications and browser tabs. Check for pending Windows/macOS updates. Clear your browser cache and temporary files. If performance issues persist, run a malware scan and contact IT support.",
  },
  {
    id: "kb-7",
    title: "How to set up multi-factor authentication?",
    category: "Account",
    tags: ["mfa", "2fa", "authentication", "security", "login"],
    content:
      "Log in to your account settings and navigate to Security. Select 'Enable Multi-Factor Authentication' and follow the setup wizard. You can use an authenticator app (Google Authenticator, Authy) or SMS verification. Save your backup codes in a secure location.",
  },
  {
    id: "kb-8",
    title: "Monitor display issues",
    category: "Hardware",
    tags: ["monitor", "display", "screen", "flickering", "blank"],
    content:
      "Check all cable connections between your computer and monitor. Try a different video cable or port. Adjust the display resolution and refresh rate in your system settings. Update your graphics drivers. If the monitor is physically damaged, submit a hardware ticket.",
  },
];

const categories = Array.from(new Set(articles.map((a) => a.category)));

export default function KnowledgeBase({ isOpen, onClose }: KnowledgeBaseProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return articles.filter((article) => {
      const matchesCategory =
        selectedCategory === "All" || article.category === selectedCategory;
      const matchesSearch =
        !query ||
        article.title.toLowerCase().includes(query) ||
        article.content.toLowerCase().includes(query) ||
        article.tags.some((tag) => tag.includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const dialogRef = useRef<HTMLDivElement>(null);

  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !dialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !dialogRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.focus();
    };
  }, [isOpen, onClose, getFocusableElements]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 safe-top safe-bottom sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kbTitle"
        tabIndex={-1}
        className="my-2 flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900 sm:my-4 sm:max-h-[85vh]"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h3 id="kbTitle" className="text-lg font-semibold text-foreground">
            Knowledge Base
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 0010.5 18.75a7.5 7.5 0 00-7.5-7.5A7.5 7.5 0 003.75 10.5m0 0L21 21z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for articles, FAQs, and troubleshooting guides..."
              className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-9 pr-4 text-sm text-foreground placeholder-zinc-400 outline-none transition-colors focus:border-foreground focus:ring-1 focus:ring-foreground dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedCategory === "All"
                  ? "bg-foreground text-background"
                  : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === category
                    ? "bg-foreground text-background"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="h-10 w-10 text-zinc-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                No articles found
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Try adjusting your search terms or selecting a different category
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((article) => (
                <div
                  key={article.id}
                  className="rounded-xl border border-zinc-200 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                >
                  <button
                    onClick={() => toggleExpand(article.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {article.title}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {article.category}
                        </span>
                      </div>
                      {expandedId !== article.id && (
                        <p className="mt-1 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {article.content}
                        </p>
                      )}
                    </div>
                    <svg
                      className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform ${
                        expandedId === article.id ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>
                  {expandedId === article.id && (
                    <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        {article.content}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {article.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
