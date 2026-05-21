type InvokeOptions<TBody> = {
  body: TBody;
  signal?: AbortSignal;
};

function getSupabaseFunctionConfig() {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      "Missing Supabase environment variables. Connect Supabase in Lovable Cloud.",
    );
  }

  return { supabaseUrl, publishableKey };
}

async function readFunctionResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessageFromBody(body: unknown) {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (typeof body !== "object") return "";

  const value = body as { error?: unknown; message?: unknown; details?: unknown };
  if (typeof value.error === "string") return value.error;
  if (typeof value.message === "string") return value.message;
  if (typeof value.details === "string") return value.details;

  return "";
}

export async function invokeEdgeFunction<TBody, TResult>(
  name: string,
  options: InvokeOptions<TBody>,
): Promise<TResult> {
  const { supabaseUrl, publishableKey } = getSupabaseFunctionConfig();
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${publishableKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(options.body),
    signal: options.signal,
  });

  const parsedBody = await readFunctionResponse(response);
  if (!response.ok) {
    const bodyMessage = getErrorMessageFromBody(parsedBody);
    throw new Error(
      `Function error ${response.status}: ${
        bodyMessage || response.statusText || "Request failed"
      }`,
    );
  }

  return parsedBody as TResult;
}
