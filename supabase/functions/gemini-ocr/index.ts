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
  "elevation_gain_m": number or null,
  "date": "YYYY-MM-DD" or null,
  "time": "HH:MM" or null,
  "activity_name": string or null,
  "sport_type": "Road Running"|"Trail Running"|"Track Running"|"Treadmill Running"|"Virtual Running"|"Road Cycling"|"Mountain Biking (MTB)"|"Gravel Cycling"|"Indoor Cycling"|"eBike"|"Pool Swimming"|"Open Water Swimming"|"Triathlon"|"Hiking"|"Walking"|"Climbing"|"Strength Training"|"HIIT"|"Cardio"|"Yoga"|"Pilates"|"Elliptical"|"Stair Stepper"|"Indoor Rowing"|"Rowing"|"Kayaking"|"Stand-Up Paddleboarding (SUP)"|"Badminton"|"Tennis"|"Padel"|"Table Tennis"|"Basketball"|"Volleyball"|"Soccer/Football"|"Futsal"|"Boxing"|"Martial Arts"|"Golf"|null
}

Rules:
- calories: total calories as integer
- distance_km: total distance in kilometers as float
- duration_minutes: total duration in minutes as float
- elevation_gain_m: total elevation gain in meters as integer (look for "Elev", "Elevation", "Elev Gain", "Ascent", "Total Ascent")
- date: ISO date from the screenshot (e.g. "2026-06-16"). If the year is not clearly visible, assume 2026 (the current year). Do NOT guess 2023 or earlier.
- time: the activity start time in 24-hour format if visible (e.g. "20:19"). Leave null if not visible.
- activity_name: the name/title of the activity
- sport_type: guess from activity name, icon, or type displayed. Map common names:
  "lari"/"run"/"running"/"jogging" → "Road Running"
  "trail"/"trail run"/"trail running" → "Trail Running"
  "track"/"sprint"/"track running" → "Track Running"
  "treadmill"/"treadmil" → "Treadmill Running"
  "virtual run"/"zwift run"/"virtual running" → "Virtual Running"
  "sepeda"/"cycle"/"bike"/"gowes"/"cycling"/"road bike" → "Road Cycling"
  "mtb"/"mountain bike"/"sepeda gunung"/"mountain biking" → "Mountain Biking (MTB)"
  "gravel"/"gravel bike"/"gravel cycling" → "Gravel Cycling"
  "indoor cycle"/"spin"/"sepeda statis"/"indoor cycling"/"peloton" → "Indoor Cycling"
  "ebike"/"e-bike"/"electric bike"/"sepeda listrik" → "eBike"
  "renang"/"swim"/"swimming"/"berenang"/"pool swim" → "Pool Swimming"
  "open water"/"renang laut"/"renang danau"/"open water swim" → "Open Water Swimming"
  "triathlon"/"triatlon"/"tri" → "Triathlon"
  "hike"/"hiking"/"mendaki"/"naik gunung"/"trekking" → "Hiking"
  "jalan"/"walk"/"walking"/"jalan kaki"/"jalan santai" → "Walking"
  "climbing"/"panjat"/"climb"/"panjat tebing" → "Climbing"
  "gym"/"angkat beban"/"weight"/"strength"/"strength training"/"weight training" → "Strength Training"
  "hiit"/"high intensity"/"interval" → "HIIT"
  "cardio"/"kardio" → "Cardio"
  "yoga" → "Yoga"
  "pilates" → "Pilates"
  "elliptical"/"eliptical" → "Elliptical"
  "stair"/"stepper"/"tangga"/"stair stepper" → "Stair Stepper"
  "indoor row"/"row machine"/"erg"/"rowing machine"/"indoor rowing" → "Indoor Rowing"
  "dayung"/"rowing"/"row"/"mendayung" → "Rowing"
  "kayak"/"kayaking"/"berkayak" → "Kayaking"
  "sup"/"paddleboard"/"paddle"/"stand up paddle" → "Stand-Up Paddleboarding (SUP)"
  "badminton"/"bulutangkis" → "Badminton"
  "tennis"/"tenis"/"tenis lapangan" → "Tennis"
  "padel"/"padel tennis" → "Padel"
  "table tennis"/"pingpong"/"ping pong"/"tenis meja" → "Table Tennis"
  "basket"/"basketball"/"bola basket" → "Basketball"
  "volleyball"/"voli"/"volley"/"bola voli" → "Volleyball"
  "sepakbola"/"football"/"soccer"/"sepak bola" → "Soccer/Football"
  "futsal"/"fut sal"/"indoor soccer" → "Futsal"
  "boxing"/"tinju"/"box"/"boxe" → "Boxing"
  "martial arts"/"bela diri"/"karate"/"taekwondo"/"silat"/"judo"/"jiu jitsu"/"aikido"/"muay thai" → "Martial Arts"
  "golf"/"golfing" → "Golf"
  general fitness class / uncategorized workout → "Cardio"
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
      elevation_gain_m: parsed.elevation_gain_m ?? null,
      date: parsed.date ?? null,
      time: parsed.time ?? null,
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
