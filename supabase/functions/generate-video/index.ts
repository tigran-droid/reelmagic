// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FAL_VIDEO_MODEL = "fal-ai/wan/v2.5/image-to-video";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleGenerateVideoRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const falKey = Deno.env.get("FAL_AI_API_KEY");
    if (!falKey) throw new Error("FAL_AI_API_KEY not configured");

    const body = await req.json();
    const action = body.action ?? "start";

    if (action === "start") {
      const { imageDataUrl, prompt } = body;
      if (!imageDataUrl) throw new Error("imageDataUrl required");
      if (!prompt) throw new Error("prompt required");

      const startRes = await fetch(`https://queue.fal.run/${FAL_VIDEO_MODEL}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          image_url: imageDataUrl,
        }),
      });

      if (!startRes.ok) {
        const text = await startRes.text();
        console.error("fal.ai wan start error", startRes.status, text);
        return jsonResponse({
          error: `Video generation failed to start [${startRes.status}]: ${text.slice(0, 300)}`,
        }, 502);
      }

      const startJson = await startRes.json();
      const requestId = startJson?.request_id;
      if (!requestId) {
        return jsonResponse({ error: "No request_id returned from fal.ai" }, 502);
      }

      return jsonResponse({
        operationName: `${FAL_VIDEO_MODEL}:${requestId}`,
        model: FAL_VIDEO_MODEL,
      });
    }

    if (action === "poll") {
      const { operationName } = body;
      if (!operationName) throw new Error("operationName required");

      const sep = operationName.lastIndexOf(":");
      if (sep === -1) throw new Error("Invalid operationName");
      const model = operationName.slice(0, sep);
      const requestId = operationName.slice(sep + 1);

      const statusRes = await fetch(
        `https://queue.fal.run/${model}/requests/${requestId}/status`,
        { headers: { Authorization: `Key ${falKey}` } },
      );

      if (!statusRes.ok) {
        const t = await statusRes.text();
        console.error("fal.ai status error", statusRes.status, t);
        throw new Error(`Poll failed [${statusRes.status}]: ${t.slice(0, 300)}`);
      }

      const statusJson = await statusRes.json();
      const status = statusJson?.status;

      if (status === "IN_QUEUE" || status === "IN_PROGRESS") {
        return jsonResponse({ done: false });
      }

      if (status !== "COMPLETED") {
        return jsonResponse({
          done: true,
          error: `Video generation ${String(status).toLowerCase() || "failed"}.`,
          errorCode: "VIDEO_FAILED",
          retryable: true,
          model,
        });
      }

      // Fetch result
      const resultRes = await fetch(
        `https://queue.fal.run/${model}/requests/${requestId}`,
        { headers: { Authorization: `Key ${falKey}` } },
      );
      if (!resultRes.ok) {
        const t = await resultRes.text();
        throw new Error(`Result fetch failed [${resultRes.status}]: ${t.slice(0, 200)}`);
      }
      const resultJson = await resultRes.json();
      const videoUri = resultJson?.video?.url ?? resultJson?.video_url ?? resultJson?.url;
      if (!videoUri) {
        console.error("fal.ai no video", JSON.stringify(resultJson).slice(0, 500));
        return jsonResponse({
          done: true,
          error: "Video generation completed but no video URL returned.",
          errorCode: "VIDEO_URL_MISSING",
          retryable: true,
          model,
        });
      }

      // Download and upload to storage
      const vidRes = await fetch(videoUri);
      if (!vidRes.ok) {
        const t = await vidRes.text();
        throw new Error(`Failed to download video [${vidRes.status}]: ${t.slice(0, 200)}`);
      }
      const bytes = new Uint8Array(await vidRes.arrayBuffer());

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

      return jsonResponse({ done: true, videoUrl: pub.publicUrl });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("generate-video error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
}

serve(handleGenerateVideoRequest);
