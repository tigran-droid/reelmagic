// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// Keep template at higher quality (it defines the final scene),
// downscale identity refs more aggressively — they only need to convey face.
const MAX_IMAGE_BYTES = 450_000;
const TEMPLATE_MAX_DIM = 896;
const USER_REF_MAX_DIM = 640;
const GEMINI_TIMEOUT_MS = 210_000;
const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRY_DELAYS_MS = [2_000, 6_000];
// Hard cap on identity refs sent to the model. More images = much slower
// inference with negligible quality gain past 2 good shots.
const MAX_USER_REFS = 1;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    if (blob.size <= MAX_IMAGE_BYTES) return dataUrl;

    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height, 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

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

export async function handleGenerateFromTemplateRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const { templateUrl, userImages, prompt } = await req.json();
    if (!templateUrl) throw new Error("templateUrl required");
    if (!Array.isArray(userImages) || userImages.length === 0) {
      throw new Error("At least one user photo is required");
    }

    // Cap identity references — extra refs slow the model significantly
    // without improving facial fidelity.
    const trimmedUserImages = userImages.slice(0, MAX_USER_REFS);

    const t0 = Date.now();
    // Fetch + normalize template AND user refs fully in parallel.
    const [templateDataUrl, ...normalizedUserImages] = await Promise.all([
      urlToDataUrl(templateUrl).then((u) => normalizeDataUrl(u, TEMPLATE_MAX_DIM)),
      ...trimmedUserImages.map((img: string) =>
        normalizeDataUrl(img, USER_REF_MAX_DIM),
      ),
    ]);
    console.log("[generate-from-template] image prep ms:", Date.now() - t0);

    // Default prompt — general, NOT just a face swap. Each template can
    // override this from the admin panel (e.g. "swap face only" vs
    // "replace the entire body"). Kept ~10 lines for clarity.
    const DEFAULT_INSTRUCTION = [
      "You will receive multiple images.",
      "Image 1 is the TEMPLATE scene — keep its composition, framing, pose, lighting, color grading, wardrobe, background and overall style exactly as shown.",
      "The remaining images are REFERENCE photos of the USER — use them ONLY as the identity source (face, hair, skin tone, distinctive features, approximate body shape).",
      "Recreate the TEMPLATE scene so that the main subject IS the USER from the reference photos.",
      "Do NOT keep the template person's face — fully replace it with the user's identity from the reference images.",
      "Do NOT copy the user's clothing, background, pose or lighting from the reference photos — those come ONLY from the template.",
      "Preserve the user's exact facial identity and likeness; do not invent a new or generic person.",
      "Keep the result photorealistic, sharp and consistent with the template's camera and lens.",
      "Return exactly ONE final edited image.",
    ].join("\n");
    const outputInstruction =
      "You must return exactly one generated image. Do not answer with text only.";
    const instruction = (typeof prompt === "string" && prompt.trim().length > 0)
      ? `${prompt.trim()}\n\n${outputInstruction}`
      : `${DEFAULT_INSTRUCTION}\n${outputInstruction}`;

    // Put the instruction FIRST so the model reads the role of each image
    // before seeing them, then the template, then the user refs.
    const parts: Array<Record<string, unknown>> = [{ text: instruction }];
    const allImages = [templateDataUrl, ...normalizedUserImages];
    for (const url of allImages) {
      const m = url.match(/^data:([^;]+);base64,(.+)$/);
      const mime = m?.[1] ?? "image/png";
      const data = m?.[2] ?? "";
      parts.push({ inline_data: { mime_type: mime, data } });
    }

    async function callGemini(requestParts: Array<Record<string, unknown>>, attempt: string) {
      let lastError:
        | { status: number; message: string; parsedStatus?: string }
        | undefined;

      for (let i = 0; i < GEMINI_MAX_ATTEMPTS; i++) {
        const attemptLabel = `${attempt}-${i + 1}/${GEMINI_MAX_ATTEMPTS}`;
        console.log("[generate-from-template] calling", GEMINI_MODEL, attemptLabel, "images:", allImages.length);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
        const tFetch = Date.now();
        let aiRes: Response;
        try {
          aiRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: requestParts }],
              generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
            }),
            signal: controller.signal,
          });
        } catch (e) {
          clearTimeout(timeoutId);
          const aborted = e instanceof Error && e.name === "AbortError";
          console.error("Gemini request failed", e);
          return {
            ok: false,
            response: jsonResponse({
              error: aborted
                ? "Image generation is taking longer than usual. Try one clear face photo or retry in a moment."
                : `Image generation request failed: ${e instanceof Error ? e.message : String(e)}`,
              errorCode: aborted ? "AI_IMAGE_TIMEOUT" : "AI_IMAGE_EDIT_FAILED",
              fallback: true,
            }),
          };
        }
        clearTimeout(timeoutId);
        console.log("[generate-from-template] gemini ms:", Date.now() - tFetch);

        if (aiRes.ok) return { ok: true, json: await aiRes.json() };

        const text = await aiRes.text();
        const parsed = parseGeminiError(text);
        console.error("Gemini image error", aiRes.status, parsed.message);
        lastError = {
          status: aiRes.status,
          message: parsed.message,
          parsedStatus: parsed.status,
        };

        if (
          i < GEMINI_MAX_ATTEMPTS - 1 &&
          isRetryableGeminiStatus(aiRes.status, parsed.status)
        ) {
          await sleep(GEMINI_RETRY_DELAYS_MS[i] ?? 6_000);
          continue;
        }

        break;
      }

      const status = lastError?.status ?? 500;
      const parsedStatus = lastError?.parsedStatus;
      const message = lastError?.message ?? "Unknown image generation error";
      const errorCode =
        status === 429 || parsedStatus === "RESOURCE_EXHAUSTED"
          ? "RATE_LIMITED"
          : status === 402
            ? "PAYMENT_REQUIRED"
            : status === 503 || parsedStatus === "UNAVAILABLE"
              ? "AI_IMAGE_MODEL_BUSY"
              : "AI_IMAGE_EDIT_FAILED";

      return {
        ok: false,
        response: jsonResponse({
          error: friendlyGeminiError(status, message, parsedStatus),
          errorCode,
          fallback: true,
        }),
      };
    }

    let result = await callGemini(parts, "primary");
    if (!result.ok) return result.response;

    let imageDataUrl = extractImageDataUrl(result.json);
    if (!imageDataUrl) {
      console.warn("Gemini returned no image on primary attempt", JSON.stringify(result.json).slice(0, 500));
      const retryParts = [
        {
          text: `${instruction}\n\nRetry because the previous response did not include image data. Generate the edited image now. No explanation, no text-only answer.`,
        },
        ...parts.slice(1),
      ];
      result = await callGemini(retryParts, "retry-image-only");
      if (!result.ok) return result.response;
      imageDataUrl = extractImageDataUrl(result.json);
    }

    if (!imageDataUrl) {
      console.error("Gemini returned no image after retry", JSON.stringify(result.json).slice(0, 500));
      return jsonResponse({
        error: "The image editor did not return an image. Try a clearer face photo or another template.",
        errorCode: "AI_IMAGE_EDIT_NO_OUTPUT",
        fallback: true,
      });
    }

    if (imageDataUrl.startsWith("http")) {
      try {
        imageDataUrl = await urlToDataUrl(imageDataUrl);
      } catch (e) {
        console.error("Failed to inline AI image", e);
      }
    }

    return jsonResponse({ imageDataUrl });
  } catch (e) {
    console.error("generate-from-template error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
}

serve(handleGenerateFromTemplateRequest);
