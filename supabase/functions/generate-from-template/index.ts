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
const MAX_IMAGE_BYTES = 2_500_000;

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

async function normalizeDataUrl(dataUrl: string): Promise<string> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    if (blob.size <= MAX_IMAGE_BYTES) return dataUrl;

    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height, 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.drawImage(bitmap, 0, 0, width, height);
    const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
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
    if (userImages.length > 4) throw new Error("Maximum 4 user photos");

    const templateDataUrl = await normalizeDataUrl(await urlToDataUrl(templateUrl));
    const normalizedUserImages = await Promise.all(
      userImages.map((img: string) => normalizeDataUrl(img)),
    );

    const instruction =
      prompt ??
      [
        "Edit the FIRST image only.",
        "The first image is the target template scene and body reference.",
        "All remaining images are identity references of the same real user.",
        "Replace the main person's face and identity in the first image with the uploaded user from the reference images.",
        "Keep the original template composition, crop, pose, body position, lighting, background, clothing style, and overall scene intact.",
        "Do not keep the original template person's face.",
        "Do not create a new composition or a different person.",
        "Preserve the uploaded user's exact facial identity, skin tone, hairline, hair color, age, and distinguishing features.",
        "Blend the replacement naturally with matching perspective, shadows, skin texture, and white balance.",
        "Return one photorealistic edited image.",
      ].join("\n");

    const allImages = [templateDataUrl, ...normalizedUserImages];
    const parts: Array<Record<string, unknown>> = allImages.map((url) => {
      const m = url.match(/^data:([^;]+);base64,(.+)$/);
      const mime = m?.[1] ?? "image/png";
      const data = m?.[2] ?? "";
      return { inline_data: { mime_type: mime, data } };
    });
    parts.push({ text: instruction });

    console.log("[generate-from-template] calling", GEMINI_MODEL, "images:", allImages.length);

    const aiRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });

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
