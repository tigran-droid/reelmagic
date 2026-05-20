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
const MAX_IMAGE_BYTES = 600_000;
const TEMPLATE_MAX_DIM = 1024;
const USER_REF_MAX_DIM = 768;
// Hard cap on identity refs sent to the model. More images = much slower
// inference with negligible quality gain past 2 good shots.
const MAX_USER_REFS = 2;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    const instruction = (typeof prompt === "string" && prompt.trim().length > 0)
      ? prompt
      : DEFAULT_INSTRUCTION;

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

    console.log("[generate-from-template] calling", GEMINI_MODEL, "images:", allImages.length);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 140_000);
    const tFetch = Date.now();
    let aiRes: Response;
    try {
      aiRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      const aborted = e instanceof Error && e.name === "AbortError";
      console.error("Gemini request failed", e);
      return jsonResponse({
        error: aborted
          ? "Image generation took too long. Please try again."
          : `Image generation request failed: ${e instanceof Error ? e.message : String(e)}`,
        errorCode: aborted ? "AI_IMAGE_TIMEOUT" : "AI_IMAGE_EDIT_FAILED",
        fallback: true,
      });
    }
    clearTimeout(timeoutId);
    console.log("[generate-from-template] gemini ms:", Date.now() - tFetch);

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("Gemini image error", aiRes.status, text);
      const errorCode =
        aiRes.status === 429
          ? "RATE_LIMITED"
          : aiRes.status === 402
            ? "PAYMENT_REQUIRED"
            : "AI_IMAGE_EDIT_FAILED";
      return jsonResponse({
        error: `Image edit failed [${aiRes.status}]: ${text.slice(0, 300)}`,
        errorCode,
        fallback: true,
      });
    }

    const json = await aiRes.json();
    let imageDataUrl: string | undefined;
    const respParts = json?.candidates?.[0]?.content?.parts ?? [];
    for (const p of respParts) {
      const inline = p?.inline_data ?? p?.inlineData;
      if (inline?.data) {
        const mime = inline.mime_type ?? inline.mimeType ?? "image/png";
        imageDataUrl = `data:${mime};base64,${inline.data}`;
        break;
      }
    }
    if (!imageDataUrl) {
      console.error("Gemini returned no image", JSON.stringify(json).slice(0, 500));
      return jsonResponse({
        error: "The image editor did not return an image.",
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
