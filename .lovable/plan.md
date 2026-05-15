# Switch `generate-from-template` to Nano Banana 2

Փոխարինել OpenAI `gpt-image-1`-ը Lovable AI Gateway-ի `google/gemini-3.1-flash-image-preview` (Nano Banana 2) մոդելով։

## Ինչ կփոխվի

**Ֆայլ:** `supabase/functions/generate-from-template/index.ts`

- Հեռացնել `OPENAI_API_KEY`-ի օգտագործումը, փոխարենը կարդալ `LOVABLE_API_KEY`-ը (արդեն set է որպես secret)
- Հեռացնել `multipart/form-data` + OpenAI `/v1/images/edits` endpoint-ը
- Փոխարինել `https://ai.gateway.lovable.dev/v1/chat/completions` JSON request-ով՝
  - `model: "google/gemini-3.1-flash-image-preview"`
  - `modalities: ["image", "text"]`
  - `messages` → մեկ user message որը պարունակում է՝
    - text prompt (նույն style-transfer instruction-ը, safety-friendly)
    - template image-ը որպես `image_url` (fetch արած URL-ից → base64 data URL)
    - user-ի photo(ներ)-ը որպես `image_url` (արդեն data URL-ներ են)
- Response-ից կարդալ `choices[0].message.images[0].image_url.url` (արդեն `data:image/png;base64,...` ֆորմատով է)
- Վերադարձնել frontend-ին նույն shape-ով՝ `{ imageDataUrl }` → **frontend-ում ոչ մի փոփոխություն պետք չէ**

## Error handling

Ավելացնել Lovable AI-ի standard error responses-ները:
- `429` → "Rate limit exceeded, please try again in a moment"
- `402` → "AI credits exhausted, please add funds in Lovable workspace"
- Մյուս error-ները → forward 502 status-ով (ինչպես հիմա)

## Համեմատության workflow (քո կողմից)

1. Plan-ը approve անելուց հետո ես deploy կանեմ նոր version-ը
2. Գնում ես `/feed` → "Create yours" նույն template-ով
3. Upload նույն photo(ները) ինչ նախորդ անգամ
4. Համեմատում ես՝
   - **Որակ** (face likeness, style match, detail)
   - **Արագություն** (~5–15s vs ~20–60s)
   - **Արժեք** (~$0.04 vs ~$0.07–0.25)
   - **Safety filter rejection rate** (Gemini-ն սովորաբար ավելի permissive է քան OpenAI-ը)

## Հետո

Եթե Nano Banana 2-ի արդյունքը գոհացուցիչ է → կարող ենք ամբողջությամբ delete անել `OPENAI_API_KEY` dependency-ն։
Եթե ոչ → 1 line փոփոխությամբ revert ենք անում gpt-image-1-ին։

## Չենք փոխում

- `src/routes/feed.tsx` (frontend) — request/response shape նույնն է
- Database schema, storage buckets
- Որևէ այլ edge function
