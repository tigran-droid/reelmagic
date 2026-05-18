// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = "google/gemini-2.5-flash-image";
const OPENAI_EDIT_MODEL = "gpt-image-1";

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

function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string; extension: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid data URL");

  const mimeType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const extension = mimeType.split("/")[1] || "png";
  return {
    blob: new Blob([bytes], { type: mimeType }),
    mimeType,
    extension,
  };
}

export async function handleGenerateFromTemplateRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!lovableKey && !openaiKey) {
      throw new Error("No image-edit API key configured (LOVABLE_API_KEY or OPENAI_API_KEY)");
    }

    const { templateUrl, userImages, prompt } = await req.json();
    if (!templateUrl) throw new Error("templateUrl required");
    if (!Array.isArray(userImages) || userImages.length === 0) {
      throw new Error("At least one user photo is required");
    }
    if (userImages.length > 4) throw new Error("Maximum 4 user photos");

    const templateDataUrl = await urlToDataUrl(templateUrl);
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

    // Try Gemini (Lovable AI Gateway) first — far fewer false-positive safety blocks
    // for normal user faces than OpenAI's gpt-image-1.
    if (lovableKey) {
      const content: Array<Record<string, unknown>> = [
        { type: "text", text: instruction },
        { type: "image_url", image_url: { url: templateDataUrl } },
      ];
      for (const img of userImages) {
        content.push({ type: "image_url", image_url: { url: img } });
      }

      const geminiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GEMINI_MODEL,
          messages: [{ role: "user", content }],
          modalities: ["image", "text"],
        }),
      });

      if (geminiRes.ok) {
        const json = await geminiRes.json();
        const url: string | undefined = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (url) return jsonResponse({ imageDataUrl: url });
        console.error("Gemini returned no image", JSON.stringify(json).slice(0, 500));
      } else {
        const text = await geminiRes.text();
        console.error("Gemini image edit error", geminiRes.status, text);
        if (geminiRes.status === 429) {
          return jsonResponse({
            error: "Rate limit reached. Please try again in a moment.",
            errorCode: "RATE_LIMITED",
            fallback: true,
          });
        }
        if (geminiRes.status === 402) {
          return jsonResponse({
            error: "AI credits exhausted. Please add credits to continue.",
            errorCode: "PAYMENT_REQUIRED",
            fallback: true,
          });
        }
        // fall through to OpenAI fallback
      }
    }

    // Fallback: OpenAI gpt-image-1
    if (!openaiKey) {
      return jsonResponse({
        error: "Image edit failed and no fallback provider is configured.",
        errorCode: "AI_IMAGE_EDIT_FAILED",
        fallback: true,
      });
    }

    const formData = new FormData();
    formData.append("model", OPENAI_EDIT_MODEL);
    formData.append("prompt", instruction);
    formData.append("size", "1024x1024");
    formData.append("quality", "low");

    const templateImage = dataUrlToBlob(templateDataUrl);
    formData.append("image[]", templateImage.blob, `template.${templateImage.extension}`);

    userImages.forEach((image: string, index: number) => {
      const file = dataUrlToBlob(image);
      formData.append("image[]", file.blob, `user-${index + 1}.${file.extension}`);
    });

    const aiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("OpenAI image edit error", aiRes.status, text);
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* ignore */ }
      const code = parsed?.error?.code;
      const message = parsed?.error?.message;
      if (code === "moderation_blocked") {
        return jsonResponse({
          error: "The photo was blocked by the image editor's safety system. Please try a different photo.",
          errorCode: "MODERATION_BLOCKED",
          fallback: true,
        });
      }
      return jsonResponse({
        error: message || `Image edit failed [${aiRes.status}]`,
        errorCode: code || "AI_IMAGE_EDIT_FAILED",
        fallback: true,
      });
    }

    const json = await aiRes.json();
    const b64Json = json?.data?.[0]?.b64_json;

    if (!b64Json) {
      console.error("Missing image in edit response", JSON.stringify(json).slice(0, 500));
      return jsonResponse({
        error: json?.error?.message || "The image editor did not return an edited image for this request.",
        errorCode: "AI_IMAGE_EDIT_NO_OUTPUT",
        fallback: true,
      });
    }

    return jsonResponse({ imageDataUrl: `data:image/png;base64,${b64Json}` });
  } catch (e) {
    console.error("generate-from-template error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
}

serve(handleGenerateFromTemplateRequest);