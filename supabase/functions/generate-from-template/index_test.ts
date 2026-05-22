import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { stub } from "https://deno.land/std@0.168.0/testing/mock.ts";
import { handleGenerateFromTemplateRequest } from "./index.ts";

Deno.test("returns fallback JSON when provider omits image data", async () => {
  const originalEnvGet = Deno.env.get;

  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "GOOGLE_GEMINI_API_KEY") return "test-key";
    return originalEnvGet.call(Deno.env, key);
  });

  const fetchStub = stub(globalThis, "fetch", async (input: string | Request | URL, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url === "https://example.com/template.png") {
      return new Response(Uint8Array.from([137, 80, 78, 71]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }

    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  try {
    const response = await handleGenerateFromTemplateRequest(
      new Request("http://localhost/generate-from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateUrl: "https://example.com/template.png",
          userImages: ["data:image/png;base64,iVBORw0KGgo="],
        }),
      }),
    );

    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.fallback, true);
    assertEquals(body.errorCode, "AI_IMAGE_EDIT_NO_OUTPUT");
  } finally {
    fetchStub.restore();
    envStub.restore();
  }
});

Deno.test("keeps identity replacement rules when a template prompt is provided", async () => {
  const originalEnvGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  let geminiRequestBody:
    | { contents?: Array<{ parts?: Array<{ text?: string }> }> }
    | undefined;

  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "GOOGLE_GEMINI_API_KEY") return "test-key";
    return originalEnvGet.call(Deno.env, key);
  });

  const fetchStub = stub(globalThis, "fetch", async (input: string | Request | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url === "https://example.com/template.png") {
      return new Response(Uint8Array.from([137, 80, 78, 71]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }

    if (url.includes("generativelanguage.googleapis.com")) {
      geminiRequestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inline_data: {
                      mime_type: "image/png",
                      data: "iVBORw0KGgo=",
                    },
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return originalFetch(input, init);
  });

  try {
    const response = await handleGenerateFromTemplateRequest(
      new Request("http://localhost/generate-from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateUrl: "https://example.com/template.png",
          userImages: ["data:image/png;base64,iVBORw0KGgo="],
          prompt: "Make it cinematic and premium.",
        }),
      }),
    );

    const body = await response.json();
    const parts = geminiRequestBody?.contents?.[0]?.parts ?? [];
    const instruction = parts[0]?.text;

    assertEquals(response.status, 200);
    assert(body.imageDataUrl);
    assertEquals(parts.length, 3);
    assertStringIncludes(instruction, "fully replace it with the user's identity");
    assertStringIncludes(instruction, "Make it cinematic and premium.");
  } finally {
    fetchStub.restore();
    envStub.restore();
  }
});
