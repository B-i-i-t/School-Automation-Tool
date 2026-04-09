import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

interface GenerateRequest {
  personalGoalKeywords: string;
  reflectionKeywords: string;
  behaviorMemo?: string;
}

interface GenerateResponse {
  personalGoal: string;
  reflection: string;
  behaviors: {
    fiveMinEarly: string;
    greeting: string;
    listening: string;
    concentration: string;
  };
}

interface ErrorResponse {
  error: string;
}

interface GeminiGenerateRequestBody {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig: {
    temperature: number;
  };
}

interface GeminiGenerateResponseBody {
  candidates?: GeminiCandidate[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
}

interface GeminiPart {
  text?: string;
}

type JsonObject = Record<string, unknown>;

const DEFAULT_ALLOWED_ORIGIN = "http://localhost:3000";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN ?? DEFAULT_ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(
  status: number,
  body: GenerateResponse | ErrorResponse,
): HttpResponseInit {
  return {
    status,
    headers: {
      ...getCorsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
    },
    jsonBody: body,
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function parseRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseOptionalString(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function parseGenerateRequest(payload: unknown): GenerateRequest | null {
  if (!isJsonObject(payload)) {
    return null;
  }

  const personalGoalKeywords = parseRequiredString(payload.personalGoalKeywords);
  const reflectionKeywords = parseRequiredString(payload.reflectionKeywords);
  const behaviorMemo = parseOptionalString(payload.behaviorMemo);

  if (!personalGoalKeywords || !reflectionKeywords || behaviorMemo === null) {
    return null;
  }

  return {
    personalGoalKeywords,
    reflectionKeywords,
    ...(behaviorMemo ? { behaviorMemo } : {}),
  };
}

function parseBehaviorResponse(value: unknown): GenerateResponse["behaviors"] | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const fiveMinEarly = parseRequiredString(value.fiveMinEarly);
  const greeting = parseRequiredString(value.greeting);
  const listening = parseRequiredString(value.listening);
  const concentration = parseRequiredString(value.concentration);

  if (!fiveMinEarly || !greeting || !listening || !concentration) {
    return null;
  }

  return {
    fiveMinEarly,
    greeting,
    listening,
    concentration,
  };
}

function extractJson(text: string): string {
  const stripped = text.trim();
  // ```json ... ``` や ``` ... ``` を除去
  const fenceMatch = stripped.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const unfenced = (fenceMatch?.[1] ?? stripped).trim();

  const jsonStartIndex = unfenced.indexOf("{");

  if (jsonStartIndex === -1) {
    return unfenced;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = jsonStartIndex; index < unfenced.length; index += 1) {
    const character = unfenced[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === "\\") {
        isEscaped = true;
        continue;
      }

      if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return unfenced.slice(jsonStartIndex, index + 1);
      }
    }
  }

  return unfenced;
}

function parseGenerateResponse(payloadText: string): GenerateResponse | null {
  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(extractJson(payloadText)) as unknown;
  } catch {
    return null;
  }

  if (!isJsonObject(parsedPayload)) {
    return null;
  }

  const personalGoal = parseRequiredString(parsedPayload.personalGoal);
  const reflection = parseRequiredString(parsedPayload.reflection);
  const behaviors = parseBehaviorResponse(parsedPayload.behaviors);

  if (!personalGoal || !reflection || !behaviors) {
    return null;
  }

  return {
    personalGoal: personalGoal.slice(0, 16),
    reflection,
    behaviors,
  };
}

function buildPrompt(requestBody: GenerateRequest): string {
  const behaviorMemoSection = requestBody.behaviorMemo
    ? `以下のメモも文章に反映してください：「${requestBody.behaviorMemo}」\n`
    : "";

  return `あなたは学校の週次振り返りシートの記入を補助するアシスタントです。
以下の全項目を一括で生成してください。

【個人目標】
キーワード: ${requestBody.personalGoalKeywords}
→ 16字以内の目標文を1つ生成してください。

【振り返り】
キーワード: ${requestBody.reflectionKeywords}
→ 160字ちょうどの文を1つ生成してください。
- 1つの段落として自然な文章にすること
- 具体的な行動・成果・課題を含めること
- 箇条書きや改行を使わないこと

【行動項目】
以下の4項目について「できた」前提で40字程度の理由文を生成してください。
毎回異なる表現・言い回し・具体例を使うこと。
${behaviorMemoSection}- 5分前行動：授業・活動の5分前には準備を完了させた
- 挨拶は元気よく：登校・授業開始時に大きな声で挨拶した
- 話を聞く姿勢を正す：発言者の方を向き背筋を伸ばして聞いた
- 集中力を高めてやる：私語をせず課題・授業に集中して取り組んだ

以下のJSON形式のみで返答してください。前後の説明文や\`\`\`は絶対に含めないこと：
{
  "personalGoal": "...",
  "reflection": "...",
  "behaviors": {
    "fiveMinEarly": "...",
    "greeting": "...",
    "listening": "...",
    "concentration": "..."
  }
}`;
}

function getGeneratedText(responseBody: GeminiGenerateResponseBody): string | null {
  const parts = responseBody.candidates?.[0]?.content?.parts;

  if (!parts || parts.length === 0) {
    return null;
  }

  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  return text.length > 0 ? text : null;
}

function createGeminiRequestBody(prompt: string): GeminiGenerateRequestBody {
  return {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.9,
    },
  };
}

export async function generate(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return {
      status: 200,
      headers: getCorsHeaders(),
    };
  }

  let requestPayload: unknown;

  try {
    requestPayload = (await request.json()) as unknown;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON request body." });
  }

  const generateRequest = parseGenerateRequest(requestPayload);

  if (!generateRequest) {
    return jsonResponse(400, { error: "Invalid request body." });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonResponse(500, { error: "GEMINI_API_KEY is not configured." });
  }

  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const prompt = buildPrompt(generateRequest);
  const requestBody = createGeminiRequestBody(prompt);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let geminiResponseText: string;

  try {
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    geminiResponseText = await geminiResponse.text();

    if (!geminiResponse.ok) {
      context.error("Gemini API returned a non-success status.", {
        status: geminiResponse.status,
        body: geminiResponseText,
      });
      return jsonResponse(500, { error: "Gemini API request failed." });
    }
  } catch (error: unknown) {
    context.error("Gemini API request failed.", error);
    return jsonResponse(500, { error: "Gemini API request failed." });
  }

  let geminiResponseBody: GeminiGenerateResponseBody;

  try {
    geminiResponseBody = JSON.parse(geminiResponseText) as GeminiGenerateResponseBody;
  } catch (error: unknown) {
    context.error("Failed to parse Gemini API response body.", error);
    return jsonResponse(500, { error: "Failed to parse Gemini API response." });
  }

  const generatedText = getGeneratedText(geminiResponseBody);

  if (!generatedText) {
    context.error("Gemini API response did not contain generated text.", geminiResponseBody);
    return jsonResponse(500, { error: "Gemini API response did not contain generated text." });
  }

  const generateResponse = parseGenerateResponse(generatedText);

  if (!generateResponse) {
    context.error("Failed to parse generated JSON payload.", generatedText);
    return jsonResponse(500, { error: "Failed to parse generated JSON payload." });
  }

  return jsonResponse(200, generateResponse);
}

app.http("generate", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: generate,
});
