// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) throw new Error("Invalid image data URL");
  const mime = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

serve(async (req) => {
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

    const tplRes = await fetch(templateUrl);
    if (!tplRes.ok) throw new Error(`Failed to fetch template (${tplRes.status})`);
    const tplBlob = await tplRes.blob();

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append(
      "prompt",
      prompt ??
        "Recreate the EXACT composition, pose, lighting, color grading, outfit style, background, props and overall aesthetic of the FIRST image (the template), but replace the person/people in it with the person/people shown in the FOLLOWING reference photos. Preserve the reference person's facial identity, skin tone, hair and distinguishing features faithfully — do not distort, beautify, or alter the face. Keep the result photorealistic and high quality.",
    );
    // Cost-optimized: medium quality + square = ~$0.04/image (was ~$0.20)
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("n", "1");
    form.append("image[]", tplBlob, "template.png");

    userImages.forEach((dataUrl: string, i: number) => {
      const blob = dataUrlToBlob(dataUrl);
      const ext = (blob.type.split("/")[1] || "png").split("+")[0];
      form.append("image[]", blob, `user-${i}.${ext}`);
    });

    const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      console.error("OpenAI error", openaiRes.status, text);
      return new Response(
        JSON.stringify({ error: `OpenAI image edit failed [${openaiRes.status}]: ${text.slice(0, 500)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await openaiRes.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI response missing image data");

    return new Response(
      JSON.stringify({ imageDataUrl: `data:image/png;base64,${b64}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-from-template error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});