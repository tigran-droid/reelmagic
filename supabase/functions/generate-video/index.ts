// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "veo-3.0-fast-generate-001";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

function dataUrlToBase64(dataUrl: string): { base64: string; mimeType: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid image data URL");
  return { mimeType: m[1], base64: m[2] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");

    const body = await req.json();
    const action = body.action ?? "start";

    if (action === "start") {
      const { imageDataUrl, prompt } = body;
      if (!imageDataUrl) throw new Error("imageDataUrl required");
      if (!prompt) throw new Error("prompt required");

      const { base64, mimeType } = dataUrlToBase64(imageDataUrl);

      const startRes = await fetch(
        `${BASE}/models/${MODEL}:predictLongRunning?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [
              {
                prompt,
                image: { bytesBase64Encoded: base64, mimeType },
              },
            ],
            parameters: {
              aspectRatio: "9:16",
              personGeneration: "allow_all",
            },
          }),
        },
      );

      if (!startRes.ok) {
        const t = await startRes.text();
        console.error("Veo start error", startRes.status, t);
        return new Response(
          JSON.stringify({
            error: `Video generation failed to start [${startRes.status}]: ${t.slice(0, 500)}`,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const startJson = await startRes.json();
      const operationName = startJson?.name;
      if (!operationName) throw new Error("No operation name returned");

      return new Response(
        JSON.stringify({ operationName }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "poll") {
      const { operationName } = body;
      if (!operationName) throw new Error("operationName required");

      const pollRes = await fetch(
        `${BASE}/${operationName}?key=${apiKey}`,
        { method: "GET" },
      );
      if (!pollRes.ok) {
        const t = await pollRes.text();
        console.error("Veo poll error", pollRes.status, t);
        throw new Error(`Poll failed [${pollRes.status}]: ${t.slice(0, 300)}`);
      }
      const json = await pollRes.json();

      if (!json.done) {
        return new Response(
          JSON.stringify({ done: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (json.error) {
        return new Response(
          JSON.stringify({ done: true, error: json.error.message ?? "Generation failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Locate the video URI from the response (shape varies slightly)
      const resp = json.response ?? {};
      const samples =
        resp.generateVideoResponse?.generatedSamples ??
        resp.generatedSamples ??
        resp.generated_videos ??
        resp.videos ??
        [];
      const first = samples[0];
      const videoUri =
        first?.video?.uri ??
        first?.video?.url ??
        first?.uri ??
        first?.videoUri ??
        null;

      if (!videoUri) {
        console.error("No video uri in response", JSON.stringify(json).slice(0, 800));
        return new Response(
          JSON.stringify({ done: true, error: "Video URL missing in response" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Download the video bytes (Google URI needs the api key)
      const fetchUrl = videoUri.includes("?")
        ? `${videoUri}&key=${apiKey}`
        : `${videoUri}?key=${apiKey}`;
      const vidRes = await fetch(fetchUrl);
      if (!vidRes.ok) {
        const t = await vidRes.text();
        throw new Error(`Failed to download generated video [${vidRes.status}]: ${t.slice(0, 200)}`);
      }
      const bytes = new Uint8Array(await vidRes.arrayBuffer());

      // Upload to Supabase storage
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const path = `generated/${crypto.randomUUID()}.mp4`;
      const { error: upErr } = await supabase.storage
        .from("video-files")
        .upload(path, bytes, { contentType: "video/mp4", upsert: false });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
      const { data: pub } = supabase.storage.from("video-files").getPublicUrl(path);

      return new Response(
        JSON.stringify({ done: true, videoUrl: pub.publicUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("generate-video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});