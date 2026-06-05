// supabase/functions/gemini-ocr/index.ts
// Extracts fitness activity data from a screenshot using Gemini 2.5 Flash

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const PROMPT = `We are in year 2026. Extract workout/fitness activity data from this screenshot.
Return ONLY valid JSON (no markdown, no code fences):

{
  "calories": number or null,
  "distance_km": number or null,
  "duration_minutes": number or null,
  "date": "YYYY-MM-DD" or null,
  "activity_name": string or null,
  "sport_type": "Run"|"Walk"|"Ride"|"Cycling"|"VirtualRide"|"Swim"|"Padel"|"Tennis"|"Badminton"|"WeightTraining"|"Workout"|"Yoga"|"Pilates"|"Hike"|"Basketball"|"Soccer"|"Rowing"|"CrossFit"|"Elliptical"|"StairStepper"|"Boxing"|null
}

Rules:
- calories: total calories as integer
- distance_km: total distance in kilometers as float
- duration_minutes: total duration in minutes as float
- date: ISO date from the screenshot. If the year is not clearly visible, assume 2026 (the current year). Do NOT guess 2023 or earlier.
- activity_name: the name/title of the activity
- sport_type: guess from activity name, icon, or type displayed. Map common names:
  "lari"/"run"/"running" → "Run"
  "jalan"/"walk"/"walking" → "Walk"
  "sepeda"/"cycle"/"bike"/"cycling"/"gowes" → "Cycling"
  "renang"/"swim"/"swimming" → "Swim"
  "badminton"/"bulutangkis" → "Badminton"
  "tennis"/"tenis" → "Tennis"
  "padel" → "Padel"
  "gym"/"angkat beban"/"weight" → "WeightTraining"
  "yoga" → "Yoga"
  "pilates" → "Pilates"
  "hike"/"hiking"/"mendaki" → "Hike"
  "basket"/"basketball" → "Basketball"
  "sepakbola"/"football"/"soccer"/"futsal" → "Soccer"
  "dayung"/"rowing"/"row" → "Rowing"
  "crossfit"/"cross fit" → "CrossFit"
  "elliptical"/"eliptical" → "Elliptical"
  "stair"/"stepper"/"tangga" → "StairStepper"
  "boxing"/"tinju"/"box" → "Boxing"
  general fitness class → "Workout"
- Leave null for any field not visible in the screenshot`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { image_base64 } = await req.json();
    if (!image_base64) return json({ error: "Missing image_base64" }, 400);

    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, "");

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: "image/jpeg", data: base64Data } },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return json({ error: "Gemini API error", detail: errText }, 502);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const cleanText = rawText.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      return json({ error: "Failed to parse Gemini response", raw_text: rawText }, 500);
    }

    return json({
      calories: parsed.calories ?? null,
      distance_km: parsed.distance_km ?? null,
      duration_minutes: parsed.duration_minutes ?? null,
      date: parsed.date ?? null,
      activity_name: parsed.activity_name ?? null,
      sport_type: parsed.sport_type ?? null,
      raw_text: rawText,
    });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
