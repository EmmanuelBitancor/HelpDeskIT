import { NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW = 60_000;

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getClientIdentifier(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    "anonymous"
  );
}

async function checkRateLimit(identifier: string) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");

    const redis = new Redis({ url: redisUrl, token: redisToken });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_REQUESTS, "1 m"),
      analytics: true,
    });

    const { success, remaining } = await ratelimit.limit(identifier);
    return { success, remaining };
  }

  const now = Date.now();
  const entry = memoryStore.get(identifier);

  if (entry && now > entry.resetAt) {
    memoryStore.delete(identifier);
  }

  const current = memoryStore.get(identifier);

  if (!current) {
    memoryStore.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { success: true, remaining: RATE_LIMIT_REQUESTS - 1 };
  }

  if (current.count >= RATE_LIMIT_REQUESTS) {
    return { success: false, remaining: 0 };
  }

  current.count++;
  return { success: true, remaining: RATE_LIMIT_REQUESTS - current.count };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const identifier = getClientIdentifier(request);
    const rateLimit = await checkRateLimit(identifier);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
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
      "- Do not use bold (**text**) or italics (*text*) markdown formatting " +
      "- Keep responses concise, helpful, and professional.";

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", response.status, errorData);
      return NextResponse.json(
        { error: "Failed to get response from AI service" },
        { status: 502 }
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
