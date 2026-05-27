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
    | {
        contents?: Array<{
          parts?: Array<{
            text?: string;
            inline_data?: { data?: string };
          }>;
        }>;
        generationConfig?: { responseModalities?: string[] };
      }
    | undefined;
  let geminiUrl = "";

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
      geminiUrl = url;
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
          userImages: ["data:image/png;base64,dXNlci1waG90bw=="],
          prompt: "Make it cinematic and premium.",
        }),
      }),
    );

    const body = await response.json();
    const parts = geminiRequestBody?.contents?.[0]?.parts ?? [];
    const instruction = parts[0]?.text;

    assertEquals(response.status, 200);
    assert(body.imageDataUrl);
    assertEquals(parts.length, 5);
    assertStringIncludes(instruction, "FIRST attached image is the USER appearance reference");
    assertStringIncludes(instruction, "SECOND attached image is the TEMPLATE scene");
    assertStringIncludes(instruction, "Make it cinematic and premium.");
    assertStringIncludes(parts[1]?.text ?? "", "USER APPEARANCE REFERENCE");
    assertEquals(parts[2]?.inline_data?.data, "dXNlci1waG90bw==");
    assertStringIncludes(parts[3]?.text ?? "", "TEMPLATE SCENE ONLY");
    assertEquals(parts[4]?.inline_data?.data, "iVBORw==");
    assertStringIncludes(geminiUrl, "gemini-3.1-flash-image-preview");
    assertEquals(geminiRequestBody?.generationConfig?.responseModalities, ["TEXT", "IMAGE"]);
  } finally {
    fetchStub.restore();
    envStub.restore();
  }
});

Deno.test("does not call the provider twice when the response has no image", async () => {
  const originalEnvGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  let geminiCalls = 0;

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
      geminiCalls += 1;
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "I cannot return an image." }] } }],
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
        }),
      }),
    );

    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(geminiCalls, 1);
    assertEquals(body.fallback, true);
    assertEquals(body.errorCode, "AI_IMAGE_EDIT_NO_OUTPUT");
  } finally {
    fetchStub.restore();
    envStub.restore();
  }
});

Deno.test("uses one provider call for follow-up edits", async () => {
  const originalEnvGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  const modelUrls: string[] = [];
  let geminiRequestBody:
    | {
        contents?: Array<{ parts?: Array<{ text?: string }> }>;
      }
    | undefined;

  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "GOOGLE_GEMINI_API_KEY") return "test-key";
    return originalEnvGet.call(Deno.env, key);
  });

  const fetchStub = stub(globalThis, "fetch", async (input: string | Request | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("generativelanguage.googleapis.com")) {
      modelUrls.push(url);
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
          editImageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
          prompt: "nice chnge possition place",
        }),
      }),
    );

    const body = await response.json();
    const instruction = geminiRequestBody?.contents?.[0]?.parts?.[0]?.text ?? "";

    assertEquals(response.status, 200);
    assertEquals(modelUrls.length, 1);
    assertStringIncludes(modelUrls[0], "gemini-3.1-flash-image-preview");
    assertStringIncludes(instruction, "STRUCTURAL edit");
    assertStringIncludes(instruction, "allowed to recreate the scene");
    assert(body.imageDataUrl);
  } finally {
    fetchStub.restore();
    envStub.restore();
  }
});
