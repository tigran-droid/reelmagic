import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { stub } from "https://deno.land/std@0.168.0/testing/mock.ts";
import { handleGenerateVideoRequest } from "./index.ts";

Deno.test("starts generation with requested Veo fallback model", async () => {
  const originalEnvGet = Deno.env.get;

  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "GOOGLE_AI_STUDIO_API_KEY") return "test-key";
    return originalEnvGet.call(Deno.env, key);
  });

  const fetchStub = stub(globalThis, "fetch", async (input: string | Request | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/models/veo-3.1-lite-generate-preview:predictLongRunning")) {
      return new Response(
        JSON.stringify({
          name: "models/veo-3.1-lite-generate-preview/operations/test-op",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    throw new Error(`Unexpected fetch URL in test: ${url}`);
  });

  try {
    const response = await handleGenerateVideoRequest(
      new Request("http://localhost/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          model: "veo-3.1-lite-generate-preview",
          prompt: "Animate this portrait naturally",
          imageDataUrl: "data:image/png;base64,ZmFrZQ==",
        }),
      }),
    );

    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.model, "veo-3.1-lite-generate-preview");
    assertEquals(body.operationName, "models/veo-3.1-lite-generate-preview/operations/test-op");
  } finally {
    fetchStub.restore();
    envStub.restore();
  }
});

Deno.test("returns provider filter reason when Veo omits video url", async () => {
  const originalEnvGet = Deno.env.get;

  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "GOOGLE_AI_STUDIO_API_KEY") return "test-key";
    return originalEnvGet.call(Deno.env, key);
  });

  const fetchStub = stub(globalThis, "fetch", async (input: string | Request | URL, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/operations/test-op")) {
      return new Response(
        JSON.stringify({
          done: true,
          response: {
            generateVideoResponse: {
              raiMediaFilteredCount: 1,
              raiMediaFilteredReasons: [
                "Sorry, we can't create videos from input images containing celebrity or their likenesses. Please remove the reference and try again.",
              ],
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    throw new Error(`Unexpected fetch URL in test: ${url}`);
  });

  try {
    const response = await handleGenerateVideoRequest(
      new Request("http://localhost/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "poll", operationName: "models/veo-3.0-fast-generate-001/operations/test-op" }),
      }),
    );

    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.done, true);
    assertEquals(body.filtered, true);
    assertEquals(body.errorCode, "VIDEO_FILTERED");
    assertEquals(
      body.error,
      "Sorry, we can't create videos from input images containing celebrity or their likenesses. Please remove the reference and try again.",
    );
  } finally {
    fetchStub.restore();
    envStub.restore();
  }
});