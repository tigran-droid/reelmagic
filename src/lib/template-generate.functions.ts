import { createServerFn } from "@tanstack/react-start";

type Input = {
  templateUrl: string;
  userImages: string[]; // data URLs (data:image/...;base64,...)
  prompt?: string;
};

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data URL");
  const mime = match[1];
  const b64 = match[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export const generateFromTemplate = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => {
    if (!input?.templateUrl) throw new Error("templateUrl required");
    if (!Array.isArray(input?.userImages) || input.userImages.length === 0) {
      throw new Error("At least one user photo is required");
    }
    if (input.userImages.length > 4) {
      throw new Error("Maximum 4 user photos");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    // Fetch the template image from its public URL
    const tplRes = await fetch(data.templateUrl);
    if (!tplRes.ok) throw new Error(`Failed to fetch template image (${tplRes.status})`);
    const tplBlob = await tplRes.blob();

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append(
      "prompt",
      data.prompt ??
        "Recreate the exact composition, pose, lighting, color grading, outfit style, background, props and overall aesthetic of the FIRST image (the template), but replace the person/people in it with the person/people shown in the FOLLOWING reference photos. Preserve the reference person's facial identity, skin tone, hair and distinguishing features faithfully — do not distort, beautify, or alter the face. Keep the result photorealistic and high quality."
    );
    form.append("size", "1024x1536");
    form.append("n", "1");

    // Template MUST be first so the prompt's "FIRST image" wording is correct
    form.append("image[]", tplBlob, "template.png");
    data.userImages.forEach((dataUrl, i) => {
      const blob = dataUrlToBlob(dataUrl);
      const ext = (blob.type.split("/")[1] || "png").split("+")[0];
      form.append("image[]", blob, `user-${i}.${ext}`);
    });

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI image edit failed [${res.status}]: ${text.slice(0, 500)}`);
    }

    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI response missing image data");

    return { imageDataUrl: `data:image/png;base64,${b64}` };
  });