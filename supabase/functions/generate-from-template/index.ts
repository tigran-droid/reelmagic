// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FAL_MODEL = "fal-ai/bytedance/seedream/v4/edit";
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
    const falKey = Deno.env.get("FAL_AI_API_KEY");
    if (!falKey) throw new Error("FAL_AI_API_KEY not configured");

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

    const image_urls = [templateDataUrl, ...normalizedUserImages];

    const falRes = await fetch(`https://fal.run/${FAL_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: instruction,
        image_urls,
        num_images: 1,
        max_images: 1,
        enable_safety_checker: false,
      }),
    });

    if (!falRes.ok) {
      const text = await falRes.text();
      console.error("fal.ai seedream error", falRes.status, text);
      return jsonResponse({
        error: `Image edit failed [${falRes.status}]: ${text.slice(0, 300)}`,
        errorCode: falRes.status === 429 ? "RATE_LIMITED" : "AI_IMAGE_EDIT_FAILED",
        fallback: true,
      }, falRes.status === 429 ? 200 : 200);
    }

    const json = await falRes.json();
    const imageUrl = json?.images?.[0]?.url ?? json?.image?.url;
    if (!imageUrl) {
      console.error("fal.ai returned no image", JSON.stringify(json).slice(0, 500));
      return jsonResponse({
        error: "The image editor did not return an image.",
        errorCode: "AI_IMAGE_EDIT_NO_OUTPUT",
        fallback: true,
      });
    }

    // Return either remote URL or fetch and inline if you want data URL.
    // Client expects imageDataUrl — fetch and inline.
    let imageDataUrl = imageUrl;
    if (imageUrl.startsWith("http")) {
      try {
        imageDataUrl = await urlToDataUrl(imageUrl);
      } catch (e) {
        console.error("Failed to inline fal image", e);
      }
    }

    return jsonResponse({ imageDataUrl });
  } catch (e) {
    console.error("generate-from-template error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
}

serve(handleGenerateFromTemplateRequest);
