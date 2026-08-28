import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/_lib/auth";
import { checkRateLimit, getClientIdentifier } from "@/app/api/_lib/ratelimit";

// Vercel serverless function timeout — the Gemini fallback matrix can
// run up to ~25 s, so we need headroom beyond the default 10 s.
export const maxDuration = 30;

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
    if (!apiKey) {
      return NextResponse.json({ error: "Chatbot not configured" }, { status: 500 });
    }

    const systemPrompt =
      "You are HelpBot, an IT support assistant for HelpDeskIT. " +
      "You MUST ONLY respond to questions related to IT support, technology issues, hardware, software, networking, " +
      "passwords, VPN, email, printers, devices, systems administration, cybersecurity, and similar technical problems. " +
      "If a user asks about non-IT topics, politely decline and ask them to ask about IT-related issues instead. " +
      "Format your response in clean, readable text: " +
      "- Use simple bullet points with hyphens (-) instead of asterisks (*) " +
      "- When listing steps or items, put each one on its own line " +
      "- Do not use bold (**text**) or italics (*text**) markdown formatting " +
      "- Keep responses concise, helpful, and professional.";

    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (history && Array.isArray(history)) {
      const supportedRoles = new Set(["user", "assistant", "system"]);
      let totalTextSize = 0;
      for (const msg of history) {
        if (contents.length >= 20) break;
        if (
          typeof msg === "object" &&
          msg !== null &&
          typeof msg.role === "string" &&
          supportedRoles.has(msg.role) &&
          typeof msg.text === "string"
        ) {
          const text = msg.text;
          if (totalTextSize + text.length > 10000) break;
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

    const models = (process.env.GEMINI_CHATBOT_MODELS || "gemini-2.5-flash,gemini-2.5-pro,gemini-2.0-flash")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    const apiVersions = ["v1beta", "v1"];

    let response: Response = new Response(null, { status: 500 });
    let lastError: { status: number; body: string } | null = null;
    const OVERALL_BUDGET_MS = 25_000;
    const deadline = Date.now() + OVERALL_BUDGET_MS;
    let deadlineReached = false;
    let fatal = false;

    for (const apiVersion of apiVersions) {
      for (const model of models) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          console.log("[chatbot] overall deadline reached, aborting fallback matrix");
          deadlineReached = true;
          break;
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
        console.log(`[chatbot] trying ${apiVersion}/${model}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), Math.min(10_000, remaining));

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
                maxOutputTokens: 512,
              },
            }),
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            console.log(`[chatbot] success with ${apiVersion}/${model}`);
            break;
          }

          const errorData = await response.text();
          console.error(`[chatbot] ${apiVersion}/${model} failed:`, response.status, errorData);
          lastError = { status: response.status, body: errorData };

          if (response.status === 404) continue;
          response = new Response(null, { status: response.status });
          fatal = true;
          break;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error(`[chatbot] ${apiVersion}/${model} network error:`, fetchError);
          lastError = { status: 500, body: String(fetchError) };
          response = new Response(null, { status: 500 });
          fatal = true;
          break;
        }
      }

      if (deadlineReached || fatal || response.ok) break;
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
      return NextResponse.json(
        {
          error: upstreamError,
          details: process.env.NODE_ENV === "development" ? body : undefined,
        },
        { status: status >= 500 ? 502 : status },
      );
    }

    const data = await response.json();
    const botReply =
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
