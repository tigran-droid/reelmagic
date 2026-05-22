// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
];
const MAX_IMAGE_BYTES = 480_000;
const TEMPLATE_MAX_DIM = 768;
const USER_REF_MAX_DIM = 768;
const EDIT_IMAGE_MAX_DIM = 768;
const FUNCTION_BUDGET_MS = 360_000;
const GEMINI_ATTEMPT_TIMEOUT_MS = 120_000;
const GEMINI_RETRY_DELAYS_MS = [1_500];
const MAX_USER_REFS = 1;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function extractImageDataUrl(json: Record<string, unknown>): string | undefined {
  const respParts = json?.candidates?.[0]?.content?.parts ?? [];
  for (const p of respParts) {
    const inline = p?.inline_data ?? p?.inlineData;
    if (inline?.data) {
      const mime = inline.mime_type ?? inline.mimeType ?? "image/png";
      return `data:${mime};base64,${inline.data}`;
    }

    const file = p?.file_data ?? p?.fileData;
    const uri = file?.file_uri ?? file?.fileUri;
    if (typeof uri === "string" && uri.length > 0) return uri;
  }
  return undefined;
}

function extractTextResponse(json: Record<string, unknown>): string {
  const respParts = json?.candidates?.[0]?.content?.parts ?? [];
  return respParts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n")
    .slice(0, 500);
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const mime = res.headers.get("content-type") || "image/png";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return `data:${mime};base64,${btoa(bin)}`;
}

async function normalizeDataUrl(dataUrl: string, maxDim: number): Promise<string> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height, 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    if (blob.size <= MAX_IMAGE_BYTES && scale === 1) return dataUrl;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.drawImage(bitmap, 0, 0, width, height);
    const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
    const buf = new Uint8Array(await out.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return `data:image/jpeg;base64,${btoa(bin)}`;
  } catch {
    return dataUrl;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGeminiError(text: string) {
  try {
    const parsed = JSON.parse(text);
    const err = parsed?.error;
    return {
      code: typeof err?.code === "number" ? err.code : undefined,
      status: typeof err?.status === "string" ? err.status : undefined,
      message: typeof err?.message === "string" ? err.message : text,
    };
  } catch {
    return { message: text };
  }
}

function isRetryableGeminiStatus(status: number, parsedStatus?: string) {
  return (
    status === 429 ||
    status === 404 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    parsedStatus === "UNAVAILABLE" ||
    parsedStatus === "RESOURCE_EXHAUSTED"
  );
}

function friendlyGeminiError(status: number, message: string, parsedStatus?: string) {
  if (status === 503 || parsedStatus === "UNAVAILABLE") {
    return "AI image server is busy right now. Please try again in a minute.";
  }
  if (status === 429 || parsedStatus === "RESOURCE_EXHAUSTED") {
    return "AI image generation limit is busy right now. Please wait a little and try again.";
  }
  return `Image edit failed [${status}]: ${message.slice(0, 220)}`;
}

async function buildGeminiParts(body: Record<string, unknown>) {
  const { templateUrl, userImages, prompt, editImageDataUrl } = body;
  const isFollowUpEdit =
    typeof editImageDataUrl === "string" &&
    editImageDataUrl.length > 0 &&
    typeof prompt === "string" &&
    prompt.trim().length > 0;
  const outputInstruction =
    "You must return exactly one generated image. Do not answer with text only.";

  let instruction = "";
  let allImages: string[] = [];
  let imageLabels: string[] = [];

  if (isFollowUpEdit) {
    allImages = [await normalizeDataUrl(editImageDataUrl, EDIT_IMAGE_MAX_DIM)];
    imageLabels = ["CURRENT CHAT IMAGE TO EDIT. This is the exact image that must be edited."];
    instruction = [
      "You will receive one already generated chat image.",
      "Apply ONLY the user's requested edit to this exact image.",
      "Do not recreate the scene from scratch.",
      "Do not change the face, identity, hair, pose, background, camera angle, lighting, composition, or text unless the user explicitly asks.",
      `User edit request: ${prompt.trim()}`,
      "Return the full edited image.",
      "No explanation.",
    ].join("\n");
  } else {
    if (!templateUrl) throw new Error("templateUrl required");
    if (!Array.isArray(userImages) || userImages.length === 0) {
      throw new Error("At least one user photo is required");
    }

    const trimmedUserImages = userImages.slice(0, MAX_USER_REFS);
    const [templateDataUrl, ...normalizedUserImages] = await Promise.all([
      urlToDataUrl(String(templateUrl)).then((u) => normalizeDataUrl(u, TEMPLATE_MAX_DIM)),
      ...trimmedUserImages.map((img: string) =>
        normalizeDataUrl(img, USER_REF_MAX_DIM),
      ),
    ]);
    allImages = [templateDataUrl, ...normalizedUserImages];
    imageLabels = [
      "IMAGE 1 - TEMPLATE SCENE ONLY. Use only the pose, composition, body placement, clothing, background, lighting, camera angle and style. Do NOT use this person's face, hair, skin tone, age or identity.",
      ...normalizedUserImages.map(
        (_, index) =>
          `IMAGE ${index + 2} - USER IDENTITY REFERENCE. The final person must look like this user: face shape, eyes, nose, mouth, skin tone, age, hair color, hair texture and recognizable identity.`,
      ),
    ];

    const BASE_TEMPLATE_INSTRUCTION = [
      "You will receive multiple images.",
      "Image 1 is the TEMPLATE scene; keep its composition, framing, pose, lighting, color grading, wardrobe, background and overall style exactly as shown.",
      "The remaining images are REFERENCE photos of the USER; use them ONLY as the identity source.",
      "Recreate the TEMPLATE scene so that the main subject IS the USER from the reference photos.",
      "The final image must be clearly recognizable as the USER from Image 2, not as the person from the template.",
      "Treat the template person as a pose/scene mannequin only, not as a character to keep.",
      "Do NOT keep the template person's face; fully replace it with the user's identity from the reference images.",
      "Do NOT generate a new similar-looking person. Preserve the user's face shape, eyes, nose, mouth, skin tone, age, hair color and hair texture as much as the scene allows.",
      "Do NOT copy the user's clothing, background, pose or lighting from the reference photos; those come ONLY from the template.",
      "If any app note conflicts with the identity replacement rules, the identity replacement rules win.",
      "Preserve the user's exact facial identity and likeness.",
      "Keep the result photorealistic, sharp and consistent with the template's camera and lens.",
      "Return exactly ONE final edited image.",
    ].join("\n");

    const extraPrompt =
      typeof prompt === "string" && prompt.trim().length > 0
        ? [
            "Additional template notes from the app:",
            prompt.trim(),
            "These notes can describe the scene or style, but they must NOT override the identity replacement rules above.",
          ].join("\n")
        : "";

    instruction = [
      BASE_TEMPLATE_INSTRUCTION,
      extraPrompt,
      outputInstruction,
    ].filter(Boolean).join("\n\n");
  }

  const parts: Array<Record<string, unknown>> = [{ text: instruction }];
  for (let i = 0; i < allImages.length; i++) {
    const url = allImages[i];
    const label = imageLabels[i];
    if (label) parts.push({ text: label });
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    const mime = m?.[1] ?? "image/png";
    const data = m?.[2] ?? "";
    parts.push({ inline_data: { mime_type: mime, data } });
  }

  return { parts, instruction, imageCount: allImages.length };
}

async function callGemini(
  geminiKey: string,
  requestParts: Array<Record<string, unknown>>,
  imageCount: number,
  startedAt: number,
  attempt: string,
) {
  let lastError:
    | { status: number; message: string; parsedStatus?: string; model?: string }
    | undefined;
  let lastTextOnlyJson: Record<string, unknown> | undefined;

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const remainingMs = FUNCTION_BUDGET_MS - (Date.now() - startedAt);
    if (remainingMs < 20_000) {
      return {
        ok: false,
        error: "Image generation is taking longer than usual. Please wait a little and try again.",
        errorCode: "AI_IMAGE_TIMEOUT",
      };
    }

    const model = GEMINI_MODELS[i];
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const attemptLabel = `${attempt}-${i + 1}/${GEMINI_MODELS.length}`;
    console.log("[generate-from-template] calling", model, attemptLabel, "images:", imageCount);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, Math.max(10_000, remainingMs - 10_000)),
    );
    const tFetch = Date.now();
    let aiRes: Response;
    try {
      aiRes = await fetch(`${geminiUrl}?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: requestParts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            responseFormat: { image: { aspectRatio: "3:4" } },
          },
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      const aborted = e instanceof Error && e.name === "AbortError";
      console.error("Gemini request failed", e);
      return {
        ok: false,
        error: aborted
          ? "Image generation is taking longer than usual. Please wait a little and try again."
          : `Image generation request failed: ${e instanceof Error ? e.message : String(e)}`,
        errorCode: aborted ? "AI_IMAGE_TIMEOUT" : "AI_IMAGE_EDIT_FAILED",
      };
    }
    clearTimeout(timeoutId);
    console.log("[generate-from-template] gemini ms:", Date.now() - tFetch);

    if (aiRes.ok) {
      const json = await aiRes.json();
      if (extractImageDataUrl(json)) return { ok: true, json };

      lastTextOnlyJson = json;
      console.warn(
        "[generate-from-template] model returned no image",
        model,
        extractTextResponse(json),
      );
      if (i < GEMINI_MODELS.length - 1) continue;
      return { ok: true, json, modelText: extractTextResponse(json) };
    }

    const text = await aiRes.text();
    const parsed = parseGeminiError(text);
    console.error("Gemini image error", aiRes.status, parsed.message);
    lastError = {
      status: aiRes.status,
      message: parsed.message,
      parsedStatus: parsed.status,
      model,
    };

    if (i < GEMINI_MODELS.length - 1) {
      const retryable =
        isRetryableGeminiStatus(aiRes.status, parsed.status) ||
        aiRes.status === 400;
      if (retryable && FUNCTION_BUDGET_MS - (Date.now() - startedAt) > 35_000) {
        await sleep(GEMINI_RETRY_DELAYS_MS[i] ?? 1_500);
        continue;
      }
    }

    break;
  }

  if (lastTextOnlyJson) {
    return {
      ok: true,
      json: lastTextOnlyJson,
      modelText: extractTextResponse(lastTextOnlyJson),
    };
  }

  const status = lastError?.status ?? 500;
  const parsedStatus = lastError?.parsedStatus;
  return {
    ok: false,
    error: friendlyGeminiError(status, lastError?.message ?? "Unknown image generation error", parsedStatus),
    errorCode:
      status === 429 || parsedStatus === "RESOURCE_EXHAUSTED"
        ? "RATE_LIMITED"
        : status === 402
          ? "PAYMENT_REQUIRED"
          : status === 503 || parsedStatus === "UNAVAILABLE"
            ? "AI_IMAGE_MODEL_BUSY"
            : "AI_IMAGE_EDIT_FAILED",
  };
}

function buildSoftVisualFallbackInstruction(body: Record<string, unknown>) {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const editImageDataUrl =
    typeof body.editImageDataUrl === "string" && body.editImageDataUrl.length > 0
      ? body.editImageDataUrl
      : "";

  if (editImageDataUrl && prompt) {
    return [
      "Create one photorealistic edited image from the provided current chat image.",
      "Apply the user's edit request naturally while keeping the same person, scene, composition and lighting.",
      `User edit request: ${prompt}`,
      "Return an image result. Do not return text only.",
    ].join("\n");
  }

  return [
    "Create one photorealistic vertical image using the provided references.",
    "IMAGE 1 is the scene template: use its pose, body placement, outfit, background, lighting, camera angle and overall style.",
    "IMAGE 2 is the user's visual reference: make the main subject generally resemble this uploaded person, including hair, skin tone, facial features and overall look.",
    "Produce a new original image that combines the scene template with the uploaded user's appearance.",
    "Return an image result. Do not return text only.",
  ].join("\n");
}

async function generateImage(body: Record<string, unknown>, geminiKey: string) {
  const startedAt = Date.now();
  const t0 = Date.now();
  const { parts, imageCount } = await buildGeminiParts(body);
  console.log("[generate-from-template] image prep ms:", Date.now() - t0);

  let result = await callGemini(geminiKey, parts, imageCount, startedAt, "primary");
  if (!result.ok) return { error: result.error, errorCode: result.errorCode, fallback: true };

  let imageDataUrl = extractImageDataUrl(result.json);
  if (!imageDataUrl) {
    const retryParts = [
      {
        text: buildSoftVisualFallbackInstruction(body),
      },
      ...parts.slice(1),
    ];
    console.warn(
      "[generate-from-template] retrying with visual fallback after no image",
      result.modelText || "",
    );
    result = await callGemini(geminiKey, retryParts, imageCount, startedAt, "soft-visual-reference");
    if (!result.ok) return { error: result.error, errorCode: result.errorCode, fallback: true };
    imageDataUrl = extractImageDataUrl(result.json);
  }

  if (!imageDataUrl) {
    const modelText = extractTextResponse(result.json) || result.modelText || "";
    const detail = modelText
      ? ` AI replied with text instead: ${modelText.slice(0, 220)}`
      : "";
    return {
      error: `The image editor did not return an image.${detail}`,
      errorCode: "AI_IMAGE_EDIT_NO_OUTPUT",
      fallback: true,
    };
  }

  if (imageDataUrl.startsWith("http")) {
    try {
      imageDataUrl = await urlToDataUrl(imageDataUrl);
    } catch (e) {
      console.error("Failed to inline AI image", e);
    }
  }

  return { imageDataUrl };
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("image_generation_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) console.error("[generate-from-template] job update failed", error);
}

async function processImageJob(jobId: string, body: Record<string, unknown>, geminiKey: string) {
  try {
    const result = await generateImage(body, geminiKey);
    if (result.imageDataUrl) {
      await updateJob(jobId, {
        status: "completed",
        image_data_url: result.imageDataUrl,
        completed_at: new Date().toISOString(),
      });
      return;
    }

    await updateJob(jobId, {
      status: "failed",
      error: result.error || "Image generation failed",
      error_code: result.errorCode || "AI_IMAGE_EDIT_FAILED",
      completed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[generate-from-template] background job failed", e);
    await updateJob(jobId, {
      status: "failed",
      error: e instanceof Error ? e.message : "Unknown error",
      error_code: "AI_IMAGE_EDIT_FAILED",
      completed_at: new Date().toISOString(),
    });
  }
}

export async function handleGenerateFromTemplateRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const body = await req.json();
    const action = body.action ?? "generate";

    if (action === "poll") {
      const operationName = body.operationName;
      if (!operationName) throw new Error("operationName required");

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("image_generation_jobs")
        .select("status,image_data_url,error,error_code")
        .eq("id", operationName)
        .single();
      if (error) throw new Error(`Image job lookup failed: ${error.message}`);

      if (data.status === "processing" || data.status === "queued") {
        return jsonResponse({ done: false, status: data.status });
      }
      if (data.status === "completed") {
        return jsonResponse({ done: true, imageDataUrl: data.image_data_url });
      }
      return jsonResponse({
        done: true,
        error: data.error || "Image generation failed",
        errorCode: data.error_code || "AI_IMAGE_EDIT_FAILED",
        fallback: true,
      });
    }

    if (action === "start") {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("image_generation_jobs")
        .insert({ status: "processing" })
        .select("id")
        .single();
      if (error) throw new Error(`Image job create failed: ${error.message}`);

      const task = processImageJob(data.id, body, geminiKey);
      const waitUntil = globalThis.EdgeRuntime?.waitUntil;
      if (typeof waitUntil === "function") waitUntil(task);
      else task.catch((e) => console.error("[generate-from-template] job task failed", e));

      return jsonResponse({ operationName: data.id, done: false });
    }

    const result = await generateImage(body, geminiKey);
    return jsonResponse(result);
  } catch (e) {
    console.error("generate-from-template error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
}

serve(handleGenerateFromTemplateRequest);
