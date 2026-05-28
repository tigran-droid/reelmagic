// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEMPLATE_RECREATE_MODEL = "gemini-2.5-flash-image";
const STRUCTURAL_FOLLOW_UP_EDIT_MODEL = "gemini-3.1-flash-image-preview";
const SIMPLE_FOLLOW_UP_EDIT_MODEL = "gemini-2.5-flash-image";
const MAX_IMAGE_BYTES = 360_000;
const TEMPLATE_MAX_DIM = 640;
const USER_REF_MAX_DIM = 704;
const EDIT_IMAGE_MAX_DIM = 576;
const FUNCTION_BUDGET_MS = 360_000;
const GEMINI_ATTEMPT_TIMEOUT_MS = 300_000;
const MAX_USER_REFS = 1;
const REQUEST_HASH_VERSION = "generate-from-template:user-first:v3";
const COMPLETED_JOB_CACHE_MS = 2 * 60 * 60 * 1000;
const ACTIVE_JOB_REUSE_MS = 6 * 60 * 1000;

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
    const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.76 });
    const buf = new Uint8Array(await out.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return `data:image/jpeg;base64,${btoa(bin)}`;
  } catch {
    return dataUrl;
  }
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

function friendlyGeminiError(status: number, message: string, parsedStatus?: string) {
  if (status === 503 || parsedStatus === "UNAVAILABLE") {
    return "AI image server is busy right now. Please try again in a minute.";
  }
  if (status === 429 || parsedStatus === "RESOURCE_EXHAUSTED") {
    return "AI image generation limit is busy right now. Please wait a little and try again.";
  }
  return `Image edit failed [${status}]: ${message.slice(0, 220)}`;
}

function isFollowUpEditBody(body: Record<string, unknown>) {
  return (
    typeof body.editImageDataUrl === "string" &&
    body.editImageDataUrl.length > 0 &&
    typeof body.prompt === "string" &&
    body.prompt.trim().length > 0
  );
}

function isStructuralFollowUpEdit(prompt: unknown) {
  if (typeof prompt !== "string") return false;
  const text = prompt.toLowerCase();
  return [
    "position",
    "possition",
    "postion",
    "posiiton",
    "place",
    "placement",
    "location",
    "reposition",
    "pose",
    "posing",
    "move",
    "relocate",
    "turn",
    "rotate",
    "stand",
    "standing",
    "sit",
    "sitting",
    "walk",
    "walking",
    "body angle",
    "camera angle",
    "composition",
    "դիրք",
    "դիրքը",
    "պոզ",
    "կեցվածք",
    "տեղափոխ",
    "շրջ",
    "կանգն",
    "նստ",
  ].some((word) => text.includes(word));
}

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashString(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function getImageModelForBody(body: Record<string, unknown>) {
  if (!isFollowUpEditBody(body)) return TEMPLATE_RECREATE_MODEL;
  return isStructuralFollowUpEdit(body.prompt)
    ? STRUCTURAL_FOLLOW_UP_EDIT_MODEL
    : SIMPLE_FOLLOW_UP_EDIT_MODEL;
}

async function buildRequestHash(body: Record<string, unknown>, model: string) {
  const prompt =
    typeof body.prompt === "string" && body.prompt.trim().length > 0
      ? body.prompt.trim()
      : "";

  if (isFollowUpEditBody(body)) {
    const editImageHash = await hashString(String(body.editImageDataUrl));
    return hashString(
      JSON.stringify({
        version: REQUEST_HASH_VERSION,
        mode: "follow-up-edit",
        model,
        prompt,
        editImageHash,
      }),
    );
  }

  const userImages = Array.isArray(body.userImages) ? body.userImages : [];
  const userImageHashes = await Promise.all(
    userImages.slice(0, MAX_USER_REFS).map((img) => hashString(String(img))),
  );

  return hashString(
    JSON.stringify({
      version: REQUEST_HASH_VERSION,
      mode: "template-recreate",
      model,
      templateUrl: typeof body.templateUrl === "string" ? body.templateUrl : "",
      prompt,
      userImageHashes,
    }),
  );
}

function isMissingJobMetadataError(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const message = err?.message ?? "";
  return (
    err?.code === "42703" ||
    message.includes("request_hash") ||
    message.includes("duration_ms") ||
    message.includes("model")
  );
}

async function findReusableJob(supabase: ReturnType<typeof getSupabaseAdmin>, requestHash: string) {
  const completedCutoff = new Date(Date.now() - COMPLETED_JOB_CACHE_MS).toISOString();
  const activeCutoffMs = Date.now() - ACTIVE_JOB_REUSE_MS;

  const { data, error } = await supabase
    .from("image_generation_jobs")
    .select("id,status,image_data_url,error,error_code,created_at,updated_at")
    .eq("request_hash", requestHash)
    .in("status", ["queued", "processing", "completed"])
    .gte("created_at", completedCutoff)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    if (!isMissingJobMetadataError(error)) {
      console.error("[generate-from-template] reusable job lookup failed", error);
    }
    return null;
  }

  const completed = data?.find((job) => job.status === "completed" && job.image_data_url);
  if (completed) return completed;

  return data?.find((job) => {
    if (job.status !== "queued" && job.status !== "processing") return false;
    const touchedAt = Date.parse(job.updated_at ?? job.created_at ?? "");
    return Number.isFinite(touchedAt) && touchedAt >= activeCutoffMs;
  }) ?? null;
}

async function insertImageJob(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  requestHash: string,
  model: string,
) {
  const insertWithMetadata = await supabase
    .from("image_generation_jobs")
    .insert({ status: "processing", request_hash: requestHash, model })
    .select("id")
    .single();

  if (!insertWithMetadata.error) return insertWithMetadata;
  if (!isMissingJobMetadataError(insertWithMetadata.error)) return insertWithMetadata;

  return supabase
    .from("image_generation_jobs")
    .insert({ status: "processing" })
    .select("id")
    .single();
}

async function buildGeminiParts(body: Record<string, unknown>) {
  const { templateUrl, userImages, prompt, editImageDataUrl } = body;
  const isFollowUpEdit = isFollowUpEditBody(body);
  const isStructuralEdit = isStructuralFollowUpEdit(prompt);
  const outputInstruction =
    "You must return exactly one generated image. Do not answer with text only.";

  let instruction = "";
  let allImages: string[] = [];
  let imageLabels: string[] = [];

  if (isFollowUpEdit) {
    allImages = [await normalizeDataUrl(editImageDataUrl, EDIT_IMAGE_MAX_DIM)];
    imageLabels = ["CURRENT CHAT IMAGE TO EDIT. This is the exact image that must be edited."];
    instruction = isStructuralEdit
      ? [
          "You will receive one already generated chat image.",
          "This request is a STRUCTURAL edit: the user is asking to change pose, position, movement, camera angle, or composition.",
          "Create a new full image based on the current chat image and clearly apply the requested structural change.",
          "It is allowed to recreate the scene as needed to satisfy the requested position or pose change.",
          "Preserve the same person, face identity, hair, outfit style, general setting, lighting, color grading, and photorealistic quality unless the user explicitly asks otherwise.",
          "Do not return a text explanation. Return exactly one final image.",
          `User edit request: ${prompt.trim()}`,
        ].join("\n")
      : [
          "You will receive one already generated chat image.",
          "Apply ONLY the user's requested local edit to this exact image.",
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
    allImages = [...normalizedUserImages, templateDataUrl];
    imageLabels = [
      ...normalizedUserImages.map(
        (_, index) =>
          `IMAGE ${index + 1} - USER APPEARANCE REFERENCE. The final person must look like this uploaded user: face shape, eyes, nose, mouth, skin tone, age, hair color, hair texture and recognizable appearance.`,
      ),
      `IMAGE ${normalizedUserImages.length + 1} - TEMPLATE SCENE ONLY. Use only the pose, composition, body placement, clothing, background, lighting, camera angle and style. Do NOT use this person's face, hair, skin tone, age or identity.`,
    ];

    const BASE_TEMPLATE_INSTRUCTION = [
      "You will receive multiple images.",
      "The FIRST attached image is the USER appearance reference and has priority for the main subject's face, hair, skin tone, age and recognizable look.",
      "The SECOND attached image is the TEMPLATE scene; use it for composition, framing, pose, lighting, color grading, wardrobe, background and overall style.",
      "The user provided the appearance reference photo for this creation.",
      "Create the TEMPLATE scene with the main subject looking like the USER from Image 1.",
      "Do NOT keep the template person's face, hair, skin tone, age or identity.",
      "If the template person's appearance conflicts with the user photo, ignore the template person's appearance completely.",
      "Treat the template person as a pose/scene mannequin only.",
      "Do NOT copy the user's clothing, background, pose or lighting from Image 1; those come from Image 2.",
      "If any app note conflicts with these image roles, Image 1 remains the person and Image 2 remains the scene.",
      "If the request is difficult, still return your best photorealistic image instead of a text explanation.",
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
  model: string,
) {
  const remainingMs = FUNCTION_BUDGET_MS - (Date.now() - startedAt);
  if (remainingMs < 20_000) {
    return {
      ok: false,
      error: "Image generation is taking longer than usual. Please wait a little and try again.",
      errorCode: "AI_IMAGE_TIMEOUT",
    };
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  console.log("[generate-from-template] calling", model, attempt, "images:", imageCount);

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
          responseModalities: ["IMAGE"],
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
    if (!extractImageDataUrl(json)) {
      console.warn(
        "[generate-from-template] model returned no image",
        model,
        extractTextResponse(json),
      );
    }
    return { ok: true, json, modelText: extractTextResponse(json) };
  }

  const text = await aiRes.text();
  const parsed = parseGeminiError(text);
  console.error("Gemini image error", aiRes.status, parsed.message);
  return {
    ok: false,
    error: friendlyGeminiError(aiRes.status, parsed.message, parsed.status),
    errorCode:
      aiRes.status === 429 || parsed.status === "RESOURCE_EXHAUSTED"
        ? "RATE_LIMITED"
        : aiRes.status === 402
          ? "PAYMENT_REQUIRED"
          : aiRes.status === 503 || parsed.status === "UNAVAILABLE"
            ? "AI_IMAGE_MODEL_BUSY"
            : "AI_IMAGE_EDIT_FAILED",
  };
}

async function generateImage(body: Record<string, unknown>, geminiKey: string) {
  const startedAt = Date.now();
  const t0 = Date.now();
  const { parts, imageCount } = await buildGeminiParts(body);
  const model = getImageModelForBody(body);
  console.log("[generate-from-template] image prep ms:", Date.now() - t0);

  const result = await callGemini(geminiKey, parts, imageCount, startedAt, "primary", model);
  if (!result.ok) return { error: result.error, errorCode: result.errorCode, fallback: true };

  let imageDataUrl = extractImageDataUrl(result.json);
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
  if (!error) return;
  if (isMissingJobMetadataError(error)) {
    const fallbackPatch = { ...patch };
    delete fallbackPatch.request_hash;
    delete fallbackPatch.duration_ms;
    delete fallbackPatch.model;
    const retry = await supabase
      .from("image_generation_jobs")
      .update({ ...fallbackPatch, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    if (!retry.error) return;
    console.error("[generate-from-template] job update retry failed", retry.error);
    return;
  }
  console.error("[generate-from-template] job update failed", error);
}

async function processImageJob(jobId: string, body: Record<string, unknown>, geminiKey: string) {
  const startedAt = Date.now();
  try {
    const result = await generateImage(body, geminiKey);
    const durationMs = Date.now() - startedAt;
    if (result.imageDataUrl) {
      await updateJob(jobId, {
        status: "completed",
        image_data_url: result.imageDataUrl,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      });
      return;
    }

    await updateJob(jobId, {
      status: "failed",
      error: result.error || "Image generation failed",
      error_code: result.errorCode || "AI_IMAGE_EDIT_FAILED",
      duration_ms: durationMs,
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
      const model = getImageModelForBody(body);
      const requestHash = await buildRequestHash(body, model);
      const reusableJob = await findReusableJob(supabase, requestHash);
      if (reusableJob?.status === "completed" && reusableJob.image_data_url) {
        return jsonResponse({
          imageDataUrl: reusableJob.image_data_url,
          cached: true,
        });
      }
      if (reusableJob) {
        return jsonResponse({
          operationName: reusableJob.id,
          done: false,
          reused: true,
        });
      }

      const { data, error } = await insertImageJob(supabase, requestHash, model);
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
