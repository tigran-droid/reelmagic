// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EDIT_MODEL = "gpt-image-1";

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
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

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

    const formData = new FormData();
    formData.append("model", EDIT_MODEL);
    formData.append("prompt", instruction);
    formData.append("size", "1024x1536");

    const templateImage = dataUrlToBlob(templateDataUrl);
    formData.append("image[]", templateImage.blob, `template.${templateImage.extension}`);

    userImages.forEach((image: string, index: number) => {
      const file = dataUrlToBlob(image);
      formData.append("image[]", file.blob, `user-${index + 1}.${file.extension}`);
    });

    const aiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("OpenAI image edit error", aiRes.status, text);
      return jsonResponse(
        { error: `Image edit failed [${aiRes.status}]: ${text.slice(0, 500)}` },
        502,
      );
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