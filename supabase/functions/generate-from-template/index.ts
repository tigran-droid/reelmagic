// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

export async function handleGenerateFromTemplateRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");

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
        "TASK: Identity swap into a target template photo.",
        "",
        "IMAGE ROLES:",
        "- Image 1 is the TARGET TEMPLATE scene.",
        "- Images 2+ are reference photos of the SAME real user.",
        "",
        "EDIT GOAL:",
        "Replace the main person in Image 1 with the person from Images 2+.",
        "Keep the template scene from Image 1: same pose, composition, camera angle, crop, lighting direction, wardrobe style, background, props, and color mood.",
        "",
        "CRITICAL:",
        "- Do NOT recreate the original template person's face.",
        "- Do NOT keep the template person's identity.",
        "- The output must look like the uploaded user inserted into the template scene.",
        "- Preserve the uploaded user's exact identity: face shape, eyes, brows, nose, lips, jawline, skin tone, hairline, hair color, and distinguishing marks.",
        "- Preserve the uploaded user's age and gender presentation.",
        "- If needed, adapt hair styling slightly to fit the template, but keep identity unmistakably the same.",
        "- Match perspective, shadows, white balance, skin texture, and realism so the edit looks like a natural photo edit.",
        "- Keep one person only in the main subject position unless the template clearly contains more than one main subject.",
        "- Do not add new people, new accessories, or a different background.",
        "- Do not stylize, beautify, cartoonize, or change ethnicity.",
        "",
        "OUTPUT:",
        "A single photorealistic edited portrait where the uploaded user has replaced the template subject while the template scene remains intact.",
      ].join("\n");

    // Build Gemini parts: instruction text + template image + user images
    const dataUrlToInline = (dataUrl: string) => {
      const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
      if (!m) throw new Error("Invalid data URL");
      return { inline_data: { mime_type: m[1], data: m[2] } };
    };

    const parts: any[] = [
      dataUrlToInline(templateDataUrl),
      ...userImages.map((u: string) => dataUrlToInline(u)),
      { text: instruction },
    ];

    const model = "gemini-2.5-flash-image";
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      },
    );

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("Google AI error", aiRes.status, text);
      return jsonResponse(
        { error: `Image generation failed [${aiRes.status}]: ${text.slice(0, 500)}` },
        502,
      );
    }

    const json = await aiRes.json();
    const candidate = json?.candidates?.[0];
    const respParts = candidate?.content?.parts ?? [];
    const imgPart = respParts.find((p: any) => p?.inline_data || p?.inlineData);
    const inline = imgPart?.inline_data ?? imgPart?.inlineData;
    if (!inline?.data) {
      console.error("Missing image in Gemini response", JSON.stringify(json).slice(0, 500));
      const finishReason = candidate?.finishReason ?? null;
      const finishMessage = candidate?.finishMessage ?? null;

      return jsonResponse({
        error:
          finishReason === "IMAGE_OTHER"
            ? "Couldn't generate a photo from this combination. Try a clearer face photo, a different template, or try again."
            : finishMessage || "AI response missing image data",
        errorCode:
          finishReason === "IMAGE_OTHER"
            ? "AI_RESPONSE_MISSING_IMAGE"
            : "AI_IMAGE_GENERATION_FAILED",
        fallback: true,
        finishReason,
      });
    }
    const mime = inline.mime_type ?? inline.mimeType ?? "image/png";
    const imageDataUrl = `data:${mime};base64,${inline.data}`;

    return jsonResponse({ imageDataUrl });
  } catch (e) {
    console.error("generate-from-template error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
}

serve(handleGenerateFromTemplateRequest);