import { NextResponse } from "next/server";
import { getAdPreset } from "@/lib/adPresets";
import { dataUrlToInline, reasonJson } from "@/lib/gemini";
import { hasGeminiKey, isDryRun } from "@/lib/models";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vision autofill: reads the uploaded product photo and fills the selected
 * preset's fields with grounded values — brand read off the pack, plated
 * form inferred from the product, a background color reasoned from the
 * packaging palette, and a price ONLY if one is printed (never invented).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      presetId: string;
      imageDataUrl?: string;
    };
    const preset = getAdPreset(body.presetId);
    if (!body.imageDataUrl) {
      return NextResponse.json({ error: "imageDataUrl is required" }, { status: 400 });
    }

    if (!hasGeminiKey() || isDryRun()) {
      return NextResponse.json({
        mock: true,
        values: Object.fromEntries(preset.fields.map((f) => [f.key, f.example])),
        rationale:
          "Demo mode — example values loaded. With a Gemini key, these fields are read and reasoned from your actual photo.",
      });
    }

    const fieldInstructions = preset.fields
      .map((f) => `- ${f.key} ("${f.label}"): ${f.autofill}`)
      .join("\n");

    const responseSchema = {
      type: "object",
      properties: {
        values: {
          type: "object",
          properties: Object.fromEntries(
            preset.fields.map((f) => [f.key, { type: "string" }]),
          ),
          required: preset.fields.map((f) => f.key),
        },
        rationale: {
          type: "string",
          description:
            "One or two sentences explaining the key creative choices (especially the background color) so the user can judge them.",
        },
      },
      required: ["values", "rationale"],
    } as const;

    const result = await reasonJson({
      prompt: `You are a creative director prepping a short product ad in the "${preset.name}" style: ${preset.hook}

Study the attached product photo and fill in each field below. Ground everything in what is actually visible; where a field asks for a creative choice, reason from the product's category and packaging design. Keep each value concise (one phrase or sentence, ready to slot into a video prompt).

Fields:
${fieldInstructions}

Then write a short rationale for your key choices.`,
      image: dataUrlToInline(body.imageDataUrl),
      responseSchema,
      validate: (raw) => raw as { values: Record<string, string>; rationale: string },
    });

    // Belt-and-braces: never let a hallucinated value through for fields the
    // hint marks as read-only-from-packaging when the model returned filler.
    const values = Object.fromEntries(
      preset.fields.map((f) => [f.key, (result.values[f.key] ?? "").trim()]),
    );

    return NextResponse.json({ mock: false, values, rationale: result.rationale });
  } catch (e) {
    console.error("ad autofill failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Photo analysis failed" },
      { status: 500 },
    );
  }
}
