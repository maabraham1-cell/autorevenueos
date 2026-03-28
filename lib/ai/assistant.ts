export type AIIntent =
  | "booking_request"
  | "pricing_question"
  | "reschedule"
  | "general_question"
  | "unclear";

export type AIAction =
  | "ask_followup"
  | "send_booking_link"
  | "create_booking_request_draft"
  | "handoff"
  | "none";

export type AIResult = {
  intent: AIIntent;
  confidence: number; // 0..1
  entities: {
    service?: string | null;
    preferred_day?: string | null;
    preferred_time?: string | null;
    customer_name?: string | null;
  };
  action: AIAction;
  reply: string;
  reasoning?: string | null; // internal/debug only
};

export type ProcessInboundMessageOutput = AIResult;

export async function processInboundMessage(params: {
  message: string;
  conversationId?: string | null;
  contactId?: string | null;
  recentMessages?: { role: "user" | "assistant"; content: string }[];
}): Promise<ProcessInboundMessageOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    // Fail safely: do not block the inbox flow.
    return {
      intent: "unclear",
      confidence: 0.1,
      entities: {
        service: null,
        preferred_day: null,
        preferred_time: null,
        customer_name: null,
      },
      action: "handoff",
      reply:
        "Thanks — I can help with booking. One moment while I connect you with someone who can assist.",
      reasoning: "Missing OPENAI_API_KEY",
    };
  }

  const systemPrompt =
    "You are an AI booking assistant for a business.\n\n" +
    "You ONLY help move customers toward booking an appointment.\n\n" +
    "You must:\n" +
    "- classify intent\n" +
    "- extract booking-related info (service, day, time)\n" +
    "- ask short follow-up questions if missing info\n" +
    "- create a booking request draft when enough info exists\n" +
    "- suggest sending a booking link when appropriate\n\n" +
    "You must NOT:\n" +
    "- invent availability\n" +
    "- confirm bookings\n" +
    "- guess pricing\n" +
    "- answer unrelated questions in detail\n\n" +
    'If you are unsure, choose "handoff".\n\n' +
    "Safety note: do not mention specific appointment availability.\n\n" +
    "When action is send_booking_link, include the exact token [[BOOKING_LINK]] in the reply where the booking link should go.\n\n" +
    "Return JSON ONLY in this format:\n" +
    "{\n" +
    'intent: "...",\n' +
    "confidence: number,\n" +
    "entities: {\n" +
    "service: string | null,\n" +
    "preferred_day: string | null,\n" +
    "preferred_time: string | null,\n" +
    "customer_name: string | null\n" +
    "},\n" +
    'action: "...",\n' +
    'reply: "...",\n' +
    "reasoning: string | null\n" +
    "}\n";

  const recent = Array.isArray(params.recentMessages)
    ? params.recentMessages.filter((m) => m?.content && typeof m.content === "string")
    : [];

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add last messages (3-5) as context.
  for (const m of recent.slice(-5)) {
    messages.push({ role: m.role, content: m.content });
  }

  messages.push({
    role: "user",
    content:
      `Current message:\n${params.message}\n\n` +
      (params.conversationId
        ? `Conversation ID: ${params.conversationId}\n`
        : "") +
      (params.contactId ? `Contact ID: ${params.contactId}\n` : ""),
  });

  const temperature = 0.3;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
      // Best-effort: many models support this to keep output machine-readable.
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    // Fail safe.
    return {
      intent: "unclear",
      confidence: 0.1,
      entities: {
        service: null,
        preferred_day: null,
        preferred_time: null,
        customer_name: null,
      },
      action: "handoff",
      reply:
        "Thanks — I can help with booking. One moment while I connect you with someone who can assist.",
      reasoning: "OpenAI request failed",
    };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  const parsed = safeParseAssistantJson(content);
  if (!parsed) {
    return {
      intent: "unclear",
      confidence: 0.1,
      entities: {
        service: null,
        preferred_day: null,
        preferred_time: null,
        customer_name: null,
      },
      action: "handoff",
      reply:
        "Thanks — I can help with booking. One moment while I connect you with someone who can assist.",
      reasoning: "Failed to parse model JSON",
    };
  }

  return applyActionRules(parsed);
}

function safeParseAssistantJson(content: unknown): ProcessInboundMessageOutput | null {
  if (typeof content !== "string") return null;

  // The model should return JSON only, but we defensively extract the first object.
  const trimmed = content.trim();
  const maybeObj = trimmed.startsWith("{") ? trimmed : extractFirstJsonObject(trimmed);
  if (!maybeObj) return null;

  try {
    const json = JSON.parse(maybeObj) as {
      intent?: unknown;
      action?: unknown;
      confidence?: unknown;
      reply?: unknown;
      entities?: {
        service?: unknown;
        preferred_day?: unknown;
        preferred_time?: unknown;
        customer_name?: unknown;
      } | null;
      reasoning?: unknown;
    };

    const intent: unknown = json.intent;
    const action: unknown = json.action;
    const confidence: unknown = json.confidence;
    const reply: unknown = json.reply;
    const entities = json.entities ?? {};

    const allowedIntents = new Set([
      "booking_request",
      "pricing_question",
      "reschedule",
      "general_question",
      "unclear",
    ]);
    const allowedActions = new Set([
      "ask_followup",
      "send_booking_link",
      "create_booking_request_draft",
      "handoff",
      "none",
    ]);

    const isAllowedIntent = typeof intent === "string" && allowedIntents.has(intent);
    const isAllowedAction = typeof action === "string" && allowedActions.has(action);
    const isConfidenceNumber = typeof confidence === "number" && Number.isFinite(confidence);

    if (!isAllowedIntent || !isAllowedAction || typeof reply !== "string" || !isConfidenceNumber) {
      return null;
    }

    const entitiesObj =
      entities && typeof entities === "object"
        ? (entities as {
            service?: unknown;
            preferred_day?: unknown;
            preferred_time?: unknown;
            customer_name?: unknown;
          })
        : {};

    const reasoning =
      typeof json.reasoning === "string" || json.reasoning === null
        ? (json.reasoning as string | null)
        : null;

    const confidenceClamped = Math.max(0, Math.min(1, confidence as number));

    return {
      intent: intent as ProcessInboundMessageOutput["intent"],
      confidence: confidenceClamped,
      entities: {
        service:
          typeof entitiesObj.service === "string" ? entitiesObj.service : null,
        preferred_day:
          typeof entitiesObj.preferred_day === "string"
            ? entitiesObj.preferred_day
            : null,
        preferred_time:
          typeof entitiesObj.preferred_time === "string"
            ? entitiesObj.preferred_time
            : null,
        customer_name:
          typeof entitiesObj.customer_name === "string"
            ? entitiesObj.customer_name
            : null,
      },
      action: action as ProcessInboundMessageOutput["action"],
      reply,
      reasoning,
    };
  } catch {
    return null;
  }
}

function applyActionRules(output: ProcessInboundMessageOutput): ProcessInboundMessageOutput {
  const entities = output.entities ?? {};

  const hasService = !!(entities.service && String(entities.service).trim().length > 0);
  const hasDay = !!(entities.preferred_day && String(entities.preferred_day).trim().length > 0);
  const hasTime = !!(entities.preferred_time && String(entities.preferred_time).trim().length > 0);
  const hasDayOrTime = hasDay || hasTime;

  // Phase-2 bounded decision rules (no auto-confirmation, no guessing).
  let action: ProcessInboundMessageOutput["action"] = output.action;
  let reply = output.reply;

  // Confidence can trigger handoff when we're not sure.
  if (output.confidence < 0.35) {
    action = "handoff";
    reply =
      "Thanks — I can help with booking. One moment while I connect you with someone who can assist.";
    return { ...output, action, reply };
  }

  if (output.intent === "unclear") {
    action = "handoff";
    reply =
      "Thanks — I can help with booking. One moment while I connect you with someone who can assist.";
  } else if (output.intent === "pricing_question" || output.intent === "general_question") {
    action = "handoff";
    reply =
      "Thanks — I can help with booking. Someone will get back to you with pricing details shortly.";
  } else if (output.intent === "reschedule") {
    action = "handoff";
    reply =
      "Thanks — I can help with booking. One moment while I connect you with someone who can assist with rescheduling.";
  } else if (output.intent === "booking_request") {
    if (!hasService || !hasDayOrTime) {
      action = "ask_followup";
    } else {
      // If the model explicitly requested sending the booking link and we have the info, allow it.
      if (output.action === "send_booking_link") {
        action = "send_booking_link";
      } else {
        action = "create_booking_request_draft";
      }
    }
  }

  // If handoff is chosen, ensure we don't accidentally include a booking link token.
  if (action === "handoff") {
    reply = reply.replaceAll("[[BOOKING_LINK]]", "").trim();
  }

  return { ...output, action, reply };
}

function extractFirstJsonObject(text: string): string | null {
  // Naive but effective for our bounded response: find the first {...} block.
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

