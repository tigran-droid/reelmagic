import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { stub } from "https://deno.land/std@0.168.0/testing/mock.ts";
import { handleGenerateFromTemplateRequest } from "./index.ts";

Deno.test("returns fallback JSON when provider omits image data", async () => {
  const originalEnvGet = Deno.env.get;

  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "OPENAI_API_KEY") return "test-key";
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