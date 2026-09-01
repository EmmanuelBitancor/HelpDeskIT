import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/_lib/auth";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";

// Vercel serverless function timeout — the fallback matrix can
// run up to ~25 s, so we need headroom beyond the default 10 s.
export const maxDuration = 30;

const GEMINI_API_VERSIONS = ["v1beta", "v1"];
const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

interface ChatMessage {
  role: string;
  parts: { text: string }[];
}

interface NvidiaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function toNvidiaMessages(contents: ChatMessage[]): NvidiaMessage[] {
  const messages: NvidiaMessage[] = [];
  for (const msg of contents) {
    if (msg.role === "user" || msg.role === "assistant" || msg.role === "system") {
      const text = msg.parts.map((p) => p.text).join("");
      if (text) messages.push({ role: msg.role, content: text });
    }
  }
  return messages;
}

async function callNvidia(
  apiKey: string,
  messages: NvidiaMessage[],
  signal: AbortSignal,
): Promise<Response> {
  const body = {
    model: "meta/llama-3.3-70b-instruct",
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  };

  return fetch(NVIDIA_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify(body),
  });
}

function extractNvidiaReply(data: unknown): string {
  const parsed = data as { choices?: { message?: { content?: string } }[] };
  return parsed.choices?.[0]?.message?.content || "";
}

async function callOpenAI(
  apiKey: string,
  messages: NvidiaMessage[],
  signal: AbortSignal,
): Promise<Response> {
  const body = {
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  };

  return fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify(body),
  });
}

function extractOpenAIReply(data: unknown): string {
  const parsed = data as { choices?: { message?: { content?: string } }[] };
  return parsed.choices?.[0]?.message?.content || "";
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const identifier = getClientIdentifier(request, authResult.user.id);
    const rateLimit = await checkRateLimit(identifier, "chatbot");

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }

    const bodyResult = await parseJsonBody<{ message: string; history?: unknown }>(request);
    if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: 400 });

    const { message, history } = bodyResult.data;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY_CHATBOT;
    const apiKeyBackup = process.env.GEMINI_API_KEY_BACKUP;
    const nvidiaApiKey = process.env.NVIDIA_API_KEY;
    const openAiApiKey = process.env.OPENAI_API_KEY;
    const apiKeys = [apiKey, apiKeyBackup].filter((key): key is string => Boolean(key));
    if (apiKeys.length === 0 && !nvidiaApiKey && !openAiApiKey) {
      return NextResponse.json({ error: "Chatbot not configured" }, { status: 500 });
    }

  const systemPrompt =
  "You are HelpBot, a friendly IT support assistant for HelpDeskIT. " +
  "You ONLY help with technical issues related to: " +
  "PCs, desktops, laptops, notebooks, smartphones, cellphones, tablets, WiFi, routers, networking, " +
  "software installation, operating systems (Windows, macOS, Linux, iOS, Android), " +
  "hardware problems, drivers, peripherals, printers, email, VPN, passwords, cybersecurity, " +
  "and IT troubleshooting in general. " +
  "If a user asks about ANY non-technical topic — including personal advice, entertainment, " +
  "politics, news, health, relationships, cooking, sports, or anything outside IT — " +
  "politely decline and say you are only here for IT support. " +
  "Be conversational, helpful, and encouraging. Use simple language. " +
  "Format responses as clean text with short bullet points using hyphens (-). " +
  "Do not use bold, italics, or asterisks. " +
  "Detect the language the user is writing in and always respond in that same language. " +
  "You are fluent in English, Filipino (Tagalog), and Philippine regional dialects including " +
  "Bisaya/Cebuano and Boholano. " +
  "If the user writes in Tagalog, reply fully in Tagalog. " +
  "If the user writes in Bisaya, Cebuano, or Boholano dialect, reply in that same dialect. " +
  "Match the user's language naturally — do not mix languages unless the user does so first. " +
  "Technical terms (e.g. WiFi, browser, driver, password) may remain in English as they are universally understood.";

    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (history && Array.isArray(history)) {
      const supportedRoles = new Set(["user", "assistant", "system"]);
      let totalTextSize = 0;
      for (const msg of history) {
        if (contents.length >= 30) break;
        if (
          typeof msg === "object" &&
          msg !== null &&
          typeof msg.role === "string" &&
          supportedRoles.has(msg.role) &&
          typeof msg.text === "string"
        ) {
          const text = msg.text;
          if (totalTextSize + text.length > 15000) break;
          totalTextSize += text.length;
          contents.push({
            role: msg.role === "user" ? "user" : msg.role === "assistant" ? "model" : "user",
            parts: [{ text }],
          });
        }
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const models = (process.env.GEMINI_CHATBOT_MODELS || "gemini-2.5-flash,gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    const apiVersions = ["v1beta", "v1"];

    let response: Response = new Response(null, { status: 500 });
    let lastError: { status: number; body: string } | null = null;
    const OVERALL_BUDGET_MS = 25_000;
    const deadline = Date.now() + OVERALL_BUDGET_MS;
    let deadlineReached = false;
    let usedBackupKey = false;

    for (const apiKey of apiKeys) {
      let tryNextKey = false;

      for (const apiVersion of apiVersions) {
        for (const model of models) {
          const remaining = deadline - Date.now();
          if (remaining <= 0) {
            console.log("[chatbot] overall deadline reached, aborting fallback matrix");
            deadlineReached = true;
            break;
          }

          const geminiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
          console.log(`[chatbot] trying ${apiVersion}/${model}${apiKey !== apiKeys[0] ? " (backup key)" : ""}`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), Math.min(7_000, remaining));

          try {
            response = await fetch(geminiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              signal: controller.signal,
              body: JSON.stringify({
                contents,
                systemInstruction: {
                  parts: [{ text: systemPrompt }],
                },
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
              },
              }),
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              console.log(`[chatbot] success with ${apiVersion}/${model}`);
              usedBackupKey = apiKey !== apiKeys[0];
              tryNextKey = false;
              break;
            }

            const errorData = await response.text();
            console.error(`[chatbot] ${apiVersion}/${model} failed:`, response.status, errorData);
            lastError = { status: response.status, body: errorData };

            if (response.status === 404) continue;
            if (response.status === 401 || response.status === 403) {
              console.log(`[chatbot] auth error, switching to next key...`);
              tryNextKey = true;
              break;
            }

            response = new Response(null, { status: response.status });
            tryNextKey = false;
            break;
          } catch (fetchError) {
            clearTimeout(timeoutId);
            console.error(`[chatbot] ${apiVersion}/${model} network/timeout error:`, fetchError);
            lastError = { status: 500, body: String(fetchError) };
            response = new Response(null, { status: 500 });
            // On timeout/network error, skip to the next model instead of
            // retrying the same slow model on the next API version.
            continue;
          }
        }

        if (response.ok || tryNextKey) break;
      }

      if (response.ok) break;
    }

    // NVIDIA fallback — tried only after all Gemini keys/models fail.
    if (!response.ok && nvidiaApiKey) {
      console.log("[chatbot] all Gemini models failed, trying NVIDIA...");
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), Math.min(7_000, remaining));

        try {
          response = await callNvidia(nvidiaApiKey, toNvidiaMessages(contents), controller.signal);
          clearTimeout(timeoutId);

          if (response.ok) {
            console.log("[chatbot] success with NVIDIA");
            usedBackupKey = true;
          } else {
            const errorData = await response.text();
            console.error("[chatbot] NVIDIA failed:", response.status, errorData);
            lastError = { status: response.status, body: errorData };
            response = new Response(null, { status: response.status });
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error("[chatbot] NVIDIA network/timeout error:", fetchError);
          lastError = { status: 500, body: String(fetchError) };
          response = new Response(null, { status: 500 });
        }
      }
    }

    // OpenAI fallback — tried last, with a tight 5s timeout to stay within
    // the 10–20s response budget.
    if (!response.ok && openAiApiKey) {
      console.log("[chatbot] all Gemini/NVIDIA models failed, trying OpenAI...");
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), Math.min(5_000, remaining));

        try {
          response = await callOpenAI(openAiApiKey, toNvidiaMessages(contents), controller.signal);
          clearTimeout(timeoutId);

          if (response.ok) {
            console.log("[chatbot] success with OpenAI");
            usedBackupKey = true;
          } else {
            const errorData = await response.text();
            console.error("[chatbot] OpenAI failed:", response.status, errorData);
            lastError = { status: response.status, body: errorData };
            response = new Response(null, { status: response.status });
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error("[chatbot] OpenAI network/timeout error:", fetchError);
          lastError = { status: 500, body: String(fetchError) };
          response = new Response(null, { status: 500 });
        }
      }
    }

    if (!response.ok) {
      if (Date.now() >= deadline) {
        console.error("[chatbot] overall deadline exceeded");
        return NextResponse.json(
          { error: "AI service unavailable", details: "Overall timeout exceeded" },
          { status: 504 },
        );
      }

      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      console.log("[chatbot] all models failed, checking available models...");
      try {
        const listResp = await fetch(listUrl, {
          signal: AbortSignal.timeout(Math.max(1_000, Math.min(5_000, deadline - Date.now()))),
        });
        if (listResp.ok) {
          const listData = await listResp.json();
          const availableModels = (listData.models || [])
            .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
              m.supportedGenerationMethods?.includes("generateContent") ?? false,
            )
            .map((m: { name: string }) => m.name);
          console.log("[chatbot] available models:", availableModels);
          lastError = {
            status: lastError?.status ?? 404,
            body: `No compatible models found. Available: ${availableModels.slice(0, 5).join(", ")}${availableModels.length > 5 ? "..." : ""}`,
          };
        }
      } catch {
        // ignore list error
      }

      const status = lastError?.status ?? 500;
      const body = lastError?.body ?? "Unknown error";
      console.error("[chatbot] all models failed, last error:", status, body);
      const upstreamError = status >= 500 ? "AI service unavailable" : "AI request failed";
      let errorDetails = process.env.NODE_ENV === "development" ? body : undefined;
      if (usedBackupKey) {
        errorDetails = errorDetails ? `Backup key was also tried. ${errorDetails}` : "Backup key was also tried.";
      }
      if (nvidiaApiKey) {
        errorDetails = errorDetails ? `NVIDIA fallback was also tried. ${errorDetails}` : "NVIDIA fallback was also tried.";
      }
      if (openAiApiKey) {
        errorDetails = errorDetails ? `OpenAI fallback was also tried. ${errorDetails}` : "OpenAI fallback was also tried.";
      }
      return NextResponse.json(
        {
          error: upstreamError,
          details: errorDetails,
        },
        { status: status >= 500 ? 502 : status },
      );
    }

    const data = await response.json();
    const botReply =
      extractOpenAIReply(data) ||
      extractNvidiaReply(data) ||
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I couldn't generate a response. Please try again.";

    return NextResponse.json({
      reply: botReply,
      remaining: rateLimit.remaining,
    });
  } catch (error) {
    console.error("Chatbot API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function parseJsonBody<T = unknown>(request: NextRequest): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}
