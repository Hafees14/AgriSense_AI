import json
import logging
import re
from typing import List, Tuple

import httpx

from apps.api.core.config import settings

logger = logging.getLogger("agrisense.llm")

LANGUAGE_NAMES = {
    "en": "English",
    "si": "Sinhala (Sri Lanka)",
    "ta": "Tamil (Sri Lanka)",
}

BASE_SYSTEM_PROMPT = """You are AgriSense AI's agricultural extension assistant, speaking with
smallholder and commercial farmers. Behave like an experienced agricultural extension officer:
- Ask clarifying follow-up questions (crop, symptoms, duration, weather, region) before giving
  firm treatment or fertilizer recommendations, unless the farmer has already given enough detail.
- Ground answers in established agricultural practice; do not invent chemical dosages.
- Keep responses concise and practical for a mobile chat interface.
- If farmer context is provided below, use it naturally (e.g. reference their farm, their last
  diagnosis, or current weather risk) instead of asking the farmer to repeat information you
  already have.
"""

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "nex-agi/nex-n2.5-mini:free"
OPENROUTER_FALLBACK_MODELS = [
    "nex-agi/nex-n2.5-pro:free",
    "inclusionai/ling-3.0-flash-vl:free",
]


class LLMConfigError(RuntimeError):
    """Raised when LLM_API_KEY is missing or obviously malformed."""


def _clean_api_key() -> str:
    key = (settings.LLM_API_KEY or "").strip()
    if key.startswith(("'", '"')) and key.endswith(("'", '"')) and len(key) > 1:
        key = key[1:-1].strip()
    return key


def _has_valid_api_key() -> bool:
    api_key = _clean_api_key()
    return bool(api_key and api_key.lower() not in {"changeme", "your-api-key-here", "sk-ant-...", "sk-or-..."})


def _require_api_key() -> str:
    if not _has_valid_api_key():
        raise LLMConfigError(
            "LLM_API_KEY is missing or still a placeholder. Set a real OpenRouter API key "
            "(from https://openrouter.ai/keys) in apps/api/.env (no surrounding quotes) and "
            "restart the api container."
        )
    return _clean_api_key()


async def _chat_completion(messages: list[dict], max_tokens: int = 500) -> str:
    api_key = _require_api_key()
    models_to_try = [OPENROUTER_MODEL, *OPENROUTER_FALLBACK_MODELS]
    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model_id in models_to_try:
            try:
                response = await client.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "AgriSense AI",
                    },
                    json={
                        "model": model_id,
                        "max_tokens": max_tokens,
                        "messages": messages,
                    },
                )
                if response.status_code == 404:
                    last_error = LLMConfigError(
                        f"OpenRouter model '{model_id}' returned 404 (likely retired). Trying fallback model..."
                    )
                    continue
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as exc:
                last_error = exc
                continue

    raise LLMConfigError(
        "All configured OpenRouter models are unavailable. Check https://openrouter.ai/api/v1/models."
    ) from last_error


# ---------------------------------------------------------------------------
# Built-in Agricultural Knowledge & Multi-Turn Extension Engine
# ---------------------------------------------------------------------------

CROP_REGEXES = {
    "coconut": r"\b(coconuts?|coconute?s?|cocunut|cocnut|coco|pol|palms?|tree|trees)\b|පොල්|තැඹිලි|தென்னை|தேங்காய்",
    "tomato": r"\b(tomatoes?|tomatos?|tamatos?|thakkali)\b|තක්කාලි|தக்காளி",
    "chilli": r"\b(chillies?|chilies?|chilli|chili|peppers?|miris)\b|මිරිස්|மிளகாய்",
    "rice": r"\b(rice|paddy|padi|goyam|vee)\b|වී|ගොයම්|කුඹුර|நெல்",
    "tea": r"\b(tea|the)\b|තේ|தேயிலை",
    "banana": r"\b(bananas?|kesel)\b|කෙසෙල්|வாழை",
    "potato": r"\b(potatoes?|alu)\b|අර්තාපල්|உருளைக்கிழங்கு",
    "onion": r"\b(onions?|lunu)\b|ලූනු|வெங்காயம்",
}

SYMPTOM_REGEXES = {
    "leaf_curl": r"\b(curls?|curling|crinkle|crinkled|twisted|rolled|cupped)\b|රැලි|නැමුණු|சுருள்",
    "yellowing": r"\b(yellow|yellowing|chlorosis|pale)\b|කහ|මஞ்சள்",
    "watering": r"\b(water|watering|moisture|irrigate|irrigation|drought|dry|wilt|wilting|droop|drooping)\b|වතුර|තෙත|වාරි|මැළව|நீர்|பாசனம்|வாடல்",
    "fertilizer": r"\b(fertilizers?|fertilisers?|urea|npk|manure|compost|nutrients?|feeding|potash|mop|tsp|dap)\b|පොහොර|යූරියා|කොම්පෝස්ට්|உரம்|யூரியா|சாணம்",
    "pest": r"\b(pests?|insects?|bugs?|worms?|caterpillars?|mites?|aphids?|thrips?|whiteflies?|whitefly|beetles?|weevils?|borers?|hoppers?)\b|පළිබෝධ|කෘමි|මැක්කන්|පණුවන්|කුරුමිණි|මයිටා|பூச்சி|புழு|வண்டு|அசுவினி|பேன்",
    "disease": r"\b(diseases?|blight|spots?|blast|rot|rots|fungus|fungal|mold|mould|mildew|anthracnose|lesions?)\b|රෝග|අංගමාරය|ලප|කුණු|පාළුව|දිලීර|நோய்|புள்ளி|அழுகல்|குலை",
    "greeting": r"^(hi|hello|hey|ayubowan|vanakkam|good morning|good afternoon|good evening|හායි|ආයුබෝවන්|வணக்கம்)[\s\!.]*$",
}


def _parse_context_summary(context_block: str) -> dict:
    summary = {"farm": "", "diagnosis": "", "weather_alert": ""}
    if not context_block:
        return summary
    for line in context_block.splitlines():
        clean = line.strip().lstrip("- ")
        if clean.startswith("Farm:"):
            summary["farm"] = clean
        elif "Most recent diagnosis:" in clean:
            summary["diagnosis"] = clean.replace("Most recent diagnosis:", "").strip()
        elif "Current weather-derived risk:" in clean:
            summary["weather_alert"] = clean.replace("Current weather-derived risk:", "").strip()
    return summary


def _detect_crop(new_msg: str, history: list[tuple[str, str]], fallback_diag: str = "") -> str:
    # 1. Direct match in the current message
    for crop, pattern in CROP_REGEXES.items():
        if re.search(pattern, new_msg, re.IGNORECASE):
            return crop

    # 2. Match in recent user turns from conversation history
    for role, text in reversed(history):
        if role == "user":
            for crop, pattern in CROP_REGEXES.items():
                if re.search(pattern, text, re.IGNORECASE):
                    return crop

    # 3. Match from latest diagnosis if present
    if fallback_diag:
        diag_lower = fallback_diag.lower()
        for crop in CROP_REGEXES:
            if crop in diag_lower:
                return crop

    return ""


def _generate_built_in_reply(
    history: list[tuple[str, str]],
    new_message: str,
    context_block: str = "",
    language: str = "en",
) -> tuple[str, list[str]]:
    """Generates comprehensive, multi-turn agricultural extension advice without
    requiring an external LLM API key. Supports English, Sinhala, and Tamil.
    """
    msg = new_message.strip()
    ctx = _parse_context_summary(context_block)
    crop = _detect_crop(msg, history, ctx["diagnosis"])

    is_greeting = bool(re.search(SYMPTOM_REGEXES["greeting"], msg.lower()))
    is_leaf_curl = bool(re.search(SYMPTOM_REGEXES["leaf_curl"], msg.lower()))
    is_yellowing = bool(re.search(SYMPTOM_REGEXES["yellowing"], msg.lower()))
    is_watering = bool(re.search(SYMPTOM_REGEXES["watering"], msg.lower()))
    is_fertilizer = bool(re.search(SYMPTOM_REGEXES["fertilizer"], msg.lower()))
    is_pest = bool(re.search(SYMPTOM_REGEXES["pest"], msg.lower()))
    is_disease = bool(re.search(SYMPTOM_REGEXES["disease"], msg.lower()))

    # Context tag
    tag_en = f"*(Ref: {ctx['farm']})*\n\n" if ctx["farm"] else ""
    tag_si = f"*(සටහන: {ctx['farm']})*\n\n" if ctx["farm"] else ""
    tag_ta = f"*(குறிப்பு: {ctx['farm']})*\n\n" if ctx["farm"] else ""

    # Pure greeting with no crop mentioned
    if is_greeting and not crop:
        if language == "si":
            reply = (
                f"{tag_si}**ආයුබෝවන්! මම AgriSense AI ඔබේ කෘෂිකාර්මික සහායකයා වෙමි.**\n\n"
                "මම ඔබට පහත සඳහන් කාරණා සඳහා සහාය වීමට සූදානම්:\n"
                "- **බෝග රෝග සහ දිලීර හඳුනාගැනීම** (තක්කාලි, වී, මිරිස්, තේ, පොල් ආදී බෝග).\n"
                "- **පළිබෝධ පාලනය** (කොහොඹ තෙල්, උගුල් සහ ඒකාබද්ධ පළිබෝධ පාලන ක්‍රම).\n"
                "- **පොහොර සහ පෝෂණ කළමනාකරණය** (යූරියා, TSP, MOP සහ කොම්පෝස්ට්).\n"
                "- **ජල කළමනාකරණය සහ කාලගුණ අවදානම්**.\n\n"
                "ඔබට ඇති ගැටලුව හෝ ඔබේ බෝගයේ දක්නට ලැබෙන රෝග ලක්ෂණ විස්තර කරන්න."
            )
            follow_ups = [
                "ඔබ වගා කරන ප්‍රධාන බෝගය කුමක්ද?",
                "ඔබේ ශාකවල කොළ රැලිවීම හෝ ලප ඇතිවීමේ ලක්ෂණ පවතීද?",
                "ඔබට අවශ්‍ය පොහොර පිළිබඳ උපදෙස්ද නැතහොත් රෝග පාලනයද?",
            ]
        elif language == "ta":
            reply = (
                f"{tag_ta}**வணக்கம்! நான் AgriSense AI, உங்கள் வேளாண் விரிவாக்க உதவியாளர்.**\n\n"
                "பின்வரும் விவசாய தேவைகளில் உங்களுக்கு வழிகாட்ட நான் தயாராக உள்ளேன்:\n"
                "- **பயிர் நோய்கள் மற்றும் பூசணக் கட்டுப்பாடு** (நெல், தக்காளி, மிளகாய், தேயிலை, தென்னை).\n"
                "- **பூச்சி மேலாண்மை** (வேப்ப எண்ணெய் மற்றும் இயற்கை தீர்வுகள்).\n"
                "- **உர மேலாண்மை** (யூரியா, டிஏபி, பொட்டாஷ் மற்றும் இயற்கை உரங்கள்).\n"
                "- **நீர்ப்பாசனம் மற்றும் வானிலை ஆலோசனைகள்**.\n\n"
                "உங்கள் பயிரில் நீங்கள் சந்திக்கும் பிரச்சினை அல்லது அறிகுறிகளைக் குறிப்பிடுங்கள்."
            )
            follow_ups = [
                "நீங்கள் என்ன பயிர் சாகுபடி செய்கிறீர்கள்?",
                "இலைகளில் சுருட்டை அல்லது புள்ளிகள் போன்ற அறிகுறிகள் உள்ளதா?",
                "உரங்கள் பற்றிய வழிகாட்டல் தேவையா அல்லது பூச்சி கட்டுப்பாடா?",
            ]
        else:
            reply = (
                f"{tag_en}**Hello! I am AgriSense AI, your agricultural extension assistant.**\n\n"
                "I'm here to provide practical, field-tested guidance on:\n"
                "- **Crop Disease & Fungal Identification** (Coconut, Tomato, Rice, Chilli, Tea, etc.).\n"
                "- **Integrated Pest Management** (Organic neem treatments, sticky traps, biological controls).\n"
                "- **Fertilizer & Soil Nutrition** (Basal programs, topdressing splits, compost).\n"
                "- **Watering & Weather Risk Management**.\n\n"
                "Tell me about your crop, any symptoms you're seeing, or what guidance you need."
            )
            follow_ups = [
                "Which crop are you currently growing?",
                "Are you noticing symptoms like leaf curling, spots, or yellowing?",
                "Would you like advice on disease treatment, pest control, or fertilizers?",
            ]
        return reply, follow_ups

    # -----------------------------------------------------------------------
    # CROP 1: COCONUT
    # -----------------------------------------------------------------------
    if crop == "coconut":
        if is_pest or "beetle" in msg.lower() or "weevil" in msg.lower():
            if language == "si":
                reply = (
                    f"{tag_si}**පොල් වගාවේ ප්‍රධාන පළිබෝධකයන් සහ පාලනය:**\n\n"
                    "1. **කළු කුරුමිණියා (Black Rhinoceros Beetle):**\n"
                    "   - *හානිය:* ලපටි ගොබය සහ කොළ සිදුරු කරයි. කොළ දිගහැරුණු පසු V හැඩයට කැපී පෙනේ.\n"
                    "   - *පාලනය:* ගොබය පිරිසිදු කර ඉහළම කොළ කිහිලි තුළට නැප්තලීන් බෝල (Naphthalene balls 3-4ක්) හෝ ලුණු සහ වැලි මිශ්‍රණයක් දමන්න. කුණු වූ පොල් කොටන් ඉවත් කරන්න.\n"
                    "2. **රතු කුරුමිණියා (Red Palm Weevil):**\n"
                    "   - *හානිය:* කඳ ඇතුළත කා දමයි. කඳෙන් දුඹුරු පැහැ යුෂ ගැලීම සහ ඇතුළතින් හැපෙන ශබ්දය ඇසීම.\n"
                    "   - *පාලනය:* පැණි උගුල් (Pheromone traps) භාවිත කරන්න. කඳේ ඇති තුවාල තාර ගා වසන්න."
                )
                follow_ups = [
                    "කොළවල V හැඩයේ කැපුම් දක්නට ලැබේද?",
                    "කඳෙන් දුඹුරු දියරයක් ගැලීමක් හෝ සිදුරු දක්නට තිබේද?",
                    "පොල් ගස්වල වයස අවුරුදු කීයක් පමණ වේද?",
                ]
            elif language == "ta":
                reply = (
                    f"{tag_ta}**தென்னை மரத்தின் முக்கிய பூச்சிகள் மற்றும் மேலாண்மை:**\n\n"
                    "1. **காண்டாமிருக வண்டு (Rhinoceros Beetle):**\n"
                    "   - *சேதம்:* இளம் குருத்துகளைத் தாக்கி துளையிடுகிறது. இலைகள் விரியும்போது V வடிவில் வெட்டப்பட்டது போல் காணப்படும்.\n"
                    "   - *தீர்வு:* மட்டைகளின் இடுக்குகளில் 3-4 அந்துருண்டைகள் (Naphthalene balls) அல்லது மணல்-உப்பு கலவையை வைக்கவும். மக்கிப்போன மரங்களை அழிக்கவும்.\n"
                    "2. **சிவப்பு கூன்வண்டு (Red Palm Weevil):**\n"
                    "   - *சேதம்:* மரத்தின் தண்டுப் பகுதியை உட்சென்று துளைக்கும். பழுப்பு நிற திரவம் வடியும்.\n"
                    "   - *தீர்வு:* இனக்கவர்ச்சிப் பொறிகளைப் (Pheromone traps) பயன்படுத்தவும். தண்டு காயங்களுக்கு தார் பூசவும்."
                )
                follow_ups = [
                    "இலைகளில் V வடிவ வெட்டுகள் காணப்படுகின்றனவா?",
                    "தண்டில் துளைகள் அல்லது பழுப்பு திரவம் வழிகிறதா?",
                    "தென்னை மரங்களின் வயது என்ன?",
                ]
            else:
                reply = (
                    f"{tag_en}**Coconut Pest Management Guide:**\n\n"
                    "1. **Black Rhinoceros Beetle (*Oryctes rhinoceros*):**\n"
                    "   - **Symptoms:** Characteristic **V-shaped cuts** on opened fronds and holes drilled into the crown.\n"
                    "   - **Control:** Clean the crown and place 3-4 naphthalene balls or a 50:50 mixture of coarse sand and common salt in the topmost leaf axils. Destroy rotting palm logs and breeding manure heaps nearby.\n"
                    "2. **Red Palm Weevil (*Rhynchophorus ferrugineus*):**\n"
                    "   - **Symptoms:** Chewing sounds inside the trunk, oozing thick brown sap, and central fronds wilting or toppling.\n"
                    "   - **Control:** Install aggregation pheromone traps with food lures. Seal any trunk wounds with coir tar or mud immediately to prevent egg-laying."
                )
                follow_ups = [
                    "Are you seeing geometric V-shaped cuts on the fronds?",
                    "Is there any dark brown sap oozing from holes in the trunk?",
                    "What is the approximate age of your coconut trees?",
                ]
            return reply, follow_ups

        if is_yellowing or is_fertilizer:
            if language == "si":
                reply = (
                    f"{tag_si}**පොල් ගස්වල කොළ කහවීම සහ පොහොර නිර්දේශය:**\n\n"
                    "- **යටි කොළ කහවීම:** පොටෑසියම් (Potassium - MOP) හෝ මැග්නීසියම් (Magnesium) ඌනතාවය නිසා සිදුවේ.\n"
                    "- **පොල් පර්යේෂණ ආයතන (CRI) නිර්දේශිත පොහොර:**\n"
                    "  - පලදාව දරන වැඩිහිටි ගසකට වසරකට CRI වැඩිහිටි පොල් පොහොර මිශ්‍රණය (APM) හෝ යූරියා 800g + එපාල ශ්‍රී ලංකා රොක් පොස්පේට් (ERP) 900g + මියුරියේට් ඔෆ් පොටෑෂ් (MOP) 1.6kg යොදන්න.\n"
                    "  - කොළ කහවීම සඳහා ගසකට ඩොලමයිට් හෝ කීසරයිට් (Magnesium) 1kg බැගින් යොදන්න.\n"
                    "- **යොදන ආකාරය:** කඳේ සිට මීටර් 1-1.5ක් ඈතින් අඟල් 6ක් ගැඹුරු වෘත්තාකාර කානුවක දමා පස්වලින් වසන්න.\n"
                    "- **තෙතමනය රැකගැනීම:** පොල් ලෙලි කානු තුළ වළලා (Husk burying) තෙතමනය රඳවාගන්න."
                )
                follow_ups = [
                    "කහ පැහැය ඇත්තේ යට පැත්තේ පැරණි අතුවලද නැතහොත් උඩ ගොබයේද?",
                    "ඔබ පසුගිය වසර තුළ පොහොර යෙදුවාද?",
                    "ගස්වල ඵලදාව අඩු වීමක් හෝ ගෙඩි හැලීමක් තිබේද?",
                ]
            elif language == "ta":
                reply = (
                    f"{tag_ta}**தென்னை இலைகள் மஞ்சள் நிறமாதல் மற்றும் உர மேலாண்மை:**\n\n"
                    "- **அடி இலைகள் மஞ்சள் நிறமாதல்:** பொட்டாசியம் அல்லது மெக்னீசியம் பற்றாக்குறையே முக்கிய காரணம்.\n"
                    "- **உர பரிந்துரை (வருடத்திற்கு ஒரு மரத்திற்கு):**\n"
                    "  - யூரியா 800 கிராம் + பாஸ்பேட் 900 கிராம் + பொட்டாஷ் (MOP) 1.6 கிலோ.\n"
                    "  - மஞ்சள் நிறத்தைத் தடுக்க ஒரு மரத்திற்கு 1 கிலோ டோலமைட் (Dolomite) அல்லது மெக்னீசியம் இடவும்.\n"
                    "- **இடும் முறை:** மரத்திலிருந்து 1-1.5 மீட்டர் தள்ளி வட்டப் பாத்தி அமைத்து உரம் இட்டு மண்ணால் மூடவும்.\n"
                    "- **ஈரப்பதம்:** தென்னை மட்டையின் உமிகளை (மட்டை/மஞ்சி) புதைத்து வைப்பதன் மூலம் வறட்சியிலும் ஈரப்பதத்தை தக்க வைக்கலாம்."
                )
                follow_ups = [
                    "அடி இலைகள் மட்டும் மஞ்சளாகிறதா அல்லது அனைத்து இலைகளுமா?",
                    "கடந்த ஆண்டில் உரம் ஏதேனும் இட்டீர்களா?",
                    "குரும்பைகள் உதிர்கின்றனவா?",
                ]
            else:
                reply = (
                    f"{tag_en}**Coconut Frond Yellowing & Fertilizer Program:**\n\n"
                    "- **Cause of Yellowing Fronds:** Usually a **Potassium (K) or Magnesium (Mg) deficiency** in older lower fronds.\n"
                    "- **Annual Fertilizer per Mature Bearing Palm:**\n"
                    "  - Urea: ~800g\n"
                    "  - Rock Phosphate (ERP): ~900g\n"
                    "  - Muriate of Potash (MOP): ~1.6 kg\n"
                    "  - For yellowing fronds: Broadcast 1 kg of **Dolomite or Kieserite (Magnesium)** per palm per year.\n"
                    "- **Application Method:** Dig a circular basin/trench 1.0 to 1.5 meters from the trunk, apply the mixture, and cover with soil after rain or irrigation.\n"
                    "- **Moisture Conservation:** Bury coconut husks (concave side facing upwards) in trenches around palms to retain water during dry months."
                )
                follow_ups = [
                    "Is the yellowing limited to the lower older fronds?",
                    "Have you applied balanced fertilizers or compost in the last 12 months?",
                    "Are you seeing premature button/nut shedding?",
                ]
            return reply, follow_ups

        # General Coconut tree intro/advice
        if language == "si":
            reply = (
                f"{tag_si}**පොල් වගා කළමනාකරණය පිළිබඳ මගපෙන්වීම:**\n\n"
                "පොල් ගස්වල නිරෝගීභාවය සහ ඉහළ ඵලදාවක් ලබා ගැනීමට පහත ප්‍රධාන කරුණු 3 පරීක්ෂා කරන්න:\n\n"
                "1. **ගොබය සහ කොළ පරීක්ෂාව:**\n"
                "   - **V හැඩයේ කැපුම්:** කළු කුරුමිණි හානියයි. ගොබයට නැප්තලීන් බෝල හෝ වැලි-ලුණු මිශ්‍රණයක් දමන්න.\n"
                "   - **මැද ගොබය කුණු වීම (Bud Rot):** දිලීර රෝගයකි. වහාම තඹ අඩංගු දිලීර නාශකයක් (Copper Oxychloride හෝ බෝඩෝ මිශ්‍රණය) ගොබයට යොදන්න.\n"
                "2. **පොහොර සහ පෝෂණය:**\n"
                "   - ගසක් වටා මීටර් 1.5ක් දුරින් කානුවක් කපා වසරකට වරක් යූරියා, රොක් පොස්පේට් සහ MOP සමඟ කොම්පෝස්ට් යොදන්න.\n"
                "   - යටි අතු කහ පැහැ වේ නම් ඩොලමයිට් (මැග්නීසියම්) යොදන්න.\n"
                "3. **තෙතමනය:**\n"
                "   - නියඟ කාලවලදී ගස පාමුල පොල් ලෙලි වැළලීම මගින් තෙතමනය රඳවාගත හැක.\n\n"
                "ඔබේ පොල් ගස පිළිබඳ වැඩිදුර තොරතුරු (වයස, කිසියම් රෝග ලක්ෂණයක් තිබේදැයි) පවසන්න."
            )
            follow_ups = [
                "ඔබේ පොල් ගස්වල දළ වයස අවුරුදු කීයක් පමණද?",
                "අතුවල V හැඩයේ කැපුම් හෝ කඳේ සිදුරු දක්නට ලැබේද?",
                "අතු කහ පැහැවීම හෝ ගෙඩි හැලීමක් පවතීද?",
            ]
        elif language == "ta":
            reply = (
                f"{tag_ta}**தென்னை மர பராமரிப்பு மற்றும் மேலாண்மை வழிகாட்டல்:**\n\n"
                "தென்னை மரங்களை ஆரோக்கியமாகப் பராமரித்து அதிக மகசூல் பெற முக்கிய குறிப்புகள்:\n\n"
                "1. **பூச்சி மற்றும் நோய் பாதுகாப்பு:**\n"
                "   - **V வடிவ இலை வெட்டுகள்:** காண்டாமிருக வண்டின் சேதம். குருத்து இடுக்குகளில் அந்துருண்டைகள் அல்லது உப்பு-மணல் கலவை இடவும்.\n"
                "   - **குருத்தழுகல் (Bud Rot):** குருத்து அழுகினால் உடனடியாக காப்பர் பூஞ்சாணக்கொல்லி (Copper Oxychloride) ஊற்றவும்.\n"
                "2. **உர மேலாண்மை:**\n"
                "   - மரத்திலிருந்து 1-1.5 மீட்டர் தள்ளி வட்டப் பாத்தியில் யூரியா, பாஸ்பேட், பொட்டாஷ் (MOP) மற்றும் மக்கிய தொழு உரம் இடவும்.\n"
                "   - அடி இலைகள் மஞ்சளானால் டோலமைட் இடவும்.\n"
                "3. **ஈரப்பதம்:**\n"
                "   - மரத்தைச் சுற்றி தென்னை மட்டைகளை அடுக்கி வைப்பது கோடைக் காலத்தில் ஈரப்பதத்தைப் பாதுகாக்கும்.\n\n"
                "உங்கள் தென்னை மரத்தின் வயது அல்லது ஏதேனும் குறிப்பிட்ட பிரச்சினை உள்ளதா எனக் கூறுங்கள்."
            )
            follow_ups = [
                "தென்னை மரம் நட்டு எத்தனை வருடங்கள் ஆகின்றன?",
                "இலைகளில் வெட்டுக்கள் அல்லது பூச்சி சேதங்கள் உள்ளனவா?",
                "இலைகள் மஞ்சளாதல் அல்லது காய்கள் உதிர்தல் ஏதேனும் உள்ளதா?",
            ]
        else:
            reply = (
                f"{tag_en}**Coconut Palm Health & Care Guide:**\n\n"
                "To keep your coconut palms healthy and high-yielding, here are the essential checks:\n\n"
                "1. **Crown & Frond Inspection:**\n"
                "   - **V-shaped geometric frond cuts:** Caused by the **Black Rhinoceros Beetle**. *Action:* Place 3-4 naphthalene balls or coarse sand/salt in the top leaf axils.\n"
                "   - **Spear leaf rot (Bud Rot):** Fungal infection (*Phytophthora*). *Action:* Drench the crown immediately with copper fungicide (Bordeaux paste or Copper Oxychloride).\n"
                "   - **Lower frond yellowing:** Usually Potassium or Magnesium shortage. *Action:* Apply MOP and Dolomite in the root zone.\n"
                "2. **Fertilizer & Nutrition (Annual):**\n"
                "   - Mature palms require balanced N-P-K (Urea ~800g, Rock Phosphate ~900g, Muriate of Potash ~1.6kg) applied in a circular trench 1-1.5m from the trunk.\n"
                "3. **Water & Soil Moisture:**\n"
                "   - Bury coconut husks (concave side facing up) around the root basin to retain moisture during drought.\n\n"
                "Tell me more about your palm: what is its approximate age, and are you seeing any leaf discoloration, crown issues, or nut drop?"
            )
            follow_ups = [
                "How old is your coconut tree (seedling, young, or mature bearing palm)?",
                "Are you seeing any V-shaped cuts on fronds or holes in the crown?",
                "Are the lower fronds turning yellow or drying out prematurely?",
            ]
        return reply, follow_ups

    # -----------------------------------------------------------------------
    # CROP 2: TOMATO
    # -----------------------------------------------------------------------
    if crop == "tomato":
        if is_leaf_curl:
            if language == "si":
                reply = (
                    f"{tag_si}**තක්කාලි කොළ රැලිවීම පිළිබඳ කෘෂිකර්ම උපදෙස්:**\n\n"
                    "තක්කාලි කොළ රැලිවීමට ප්‍රධාන වශයෙන් හේතු 3ක් බලපායි:\n"
                    "1. **සුදුමැස්සන් (Whiteflies) මගින් බෝවන කොළ රැලිවීමේ වෛරසය (ToLCV):** කොළ උඩු අතට රැලි වී කහ පැහැවේ.\n"
                    "2. **පළිබෝධ හානි (පැළ මැක්කන් හෝ කුඩිත්තන්):** කොළ යටි පැත්තෙන් යුෂ උරා බීම නිසා කොළ විකෘති වේ.\n"
                    "3. **පාරිසරික පීඩනය:** අධික හිරු රශ්මිය සහ අක්‍රමවත් ජල සම්පාදනය නිසා කොළ හැකිලීම.\n\n"
                    "**ප්‍රතිකර්ම:**\n"
                    "- කොළ යටි පැත්ත පරීක්ෂා කර සුදුමැස්සන් පාලනයට **කහ පැහැති ඇලෙන සුළු උගුල් (Yellow sticky traps)** සවි කරන්න.\n"
                    "- කොහොඹ තෙල් මිශ්‍රණය (වතුර ලීටරයකට මි.ලී. 5 සහ සබන් දියර ස්වල්පයක්) උදෑසන හෝ සවස් කාලයේ ඉසින්න.\n"
                    "- ශාකයට ස්ථාවරව තෙතමනය ලබා දෙන්න; දිලීර පැතිරීම වැළැක්වීමට උඩින් කොළවලට වතුර නොදමන්න."
                )
                follow_ups = [
                    "කොළ යටි පැත්තේ සුදුමැස්සන් හෝ කුඩා කෘමීන් දක්නට තිබේද?",
                    "කොළ රැලි වී ඇත්තේ උඩු අතටද නැතහොත් යටි අතටද?",
                    "ඔබ තක්කාලි පැළවලට ජලය යොදන්නේ කිනම් කාලසීමාවන්හිද?",
                ]
            elif language == "ta":
                reply = (
                    f"{tag_ta}**தக்காளி இலை சுருட்டை நோய் ஆலோசனை:**\n\n"
                    "தக்காளியில் இலை சுருள்வதற்கு முக்கிய காரணங்கள்:\n"
                    "1. **வெள்ளை ஈக்கள் பரப்பும் வைரஸ் நோய் (Leaf Curl Virus):** இலைகள் மேல்நோக்கி சுருண்டு, வளர்ச்சி குன்றி மஞ்சள் நிறமாக மாறும்.\n"
                    "2. **சாறு உறிஞ்சும் பூச்சிகள் (அசுவினி, இலைப்பேன்):** இளம் இலைகளின் சாற்றை உறிஞ்சுவதால் இலைகள் சுருங்கும்.\n"
                    "3. **சுற்றுச்சூழல் மற்றும் நீர் அழுத்தம்:** அதிக வெப்பம் அல்லது முறையற்ற நீர்ப்பாசனம்.\n\n"
                    "**பரிந்துரைக்கப்படும் தீர்வுகள்:**\n"
                    "- வெள்ளை ஈக்களைக் கண்காணிக்கவும் கட்டுப்படுத்தவும் **மஞ்சள் ஒட்டும் பொறிகளை (Yellow sticky traps)** வைக்கவும்.\n"
                    "- இயற்கை முறையாக **வேப்ப எண்ணெய் கரைசல்** (ஒரு லிட்டர் தண்ணீருக்கு 5 மி.லி + சோப்பு நீர்) தெளிக்கவும்.\n"
                    "- சீரான நீர்ப்பாசனத்தை உறுதி செய்யவும்; இலைகள் மீது தண்ணீர் தெளிப்பதைத் தவிர்க்கவும்."
                )
                follow_ups = [
                    "இலைகளின் அடியில் சிறிய வெள்ளை ஈக்கள் அல்லது பூச்சிகள் தென்படுகின்றனவா?",
                    "இலை சுருட்டை மேல்நோக்கியா அல்லது கீழ்நோக்கியா உள்ளது?",
                    "செடிகளுக்கு எத்தனை நாட்களுக்கு ஒருமுறை நீர் பாய்ச்சுகிறீர்கள்?",
                ]
            else:
                reply = (
                    f"{tag_en}**Tomato Leaf Curl Advisory:**\n\n"
                    "Leaf curling in tomatoes is primarily caused by one of three issues:\n"
                    "1. **Tomato Leaf Curl Virus (ToLCV)** transmitted by whiteflies: leaves cup upwards with stunted, yellowish margins.\n"
                    "2. **Sap-sucking pests (Aphids, Thrips, or Mites):** feeding on the underside of young leaves causes distorted or downward rolling.\n"
                    "3. **Physiological stress:** intense heat, dry winds, or fluctuating soil moisture.\n\n"
                    "**Action Plan:**\n"
                    "- **Scout Leaf Undersides:** Look closely for tiny whiteflies or pale aphids.\n"
                    "- **Whitefly Control:** Install yellow sticky traps (1 per 10 plants) to catch and monitor vectors.\n"
                    "- **Organic Spray:** Apply neem seed oil (5 ml per litre of water with a dash of mild detergent) early morning or late afternoon.\n"
                    "- **Water Management:** Keep soil evenly moist and mulch with straw to reduce soil temperature swings."
                )
                follow_ups = [
                    "Are you seeing tiny whiteflies or aphids under the leaves?",
                    "Is the leaf curling directed upwards or downwards?",
                    "How often are you watering your tomato plants?",
                ]
            return reply, follow_ups

        # General Tomato
        if language == "si":
            reply = (
                f"{tag_si}**තක්කාලි වගා කළමනාකරණය:**\n\n"
                "- **රෝග පරීක්ෂාව:** කොළ මත දුඹුරු වලයාකාර ලප ඇති වීම **මුල් අංගමාරය (Early Blight)** ලක්ෂණයකි. පහළ රෝගී කොළ කපා ඉවත් කරන්න.\n"
                "- **පොහොර:** මල් පිපෙන විට පොස්පරස් සහ පොටෑසියම් අවශ්‍ය වේ. ගෙඩි අග කුණු වීම (Blossom End Rot) වැළැක්වීමට කැල්සියම් සහ ඒකාකාරී ජල සැපයුමක් අවශ්‍යයි.\n"
                "- **ජලය:** උදෑසන පමණක් පසට වතුර දමන්න. කොළ තෙත් වීම දිලීර රෝග පැතිරීමට හේතු වේ."
            )
            follow_ups = ["ඔබේ තක්කාලි පැළ මල් පිපෙන හෝ ගෙඩි හටගන්නා අවධියේ පවතීද?", "කොළ මත දුඹුරු ලප දක්නට තිබේද?"]
        elif language == "ta":
            reply = (
                f"{tag_ta}**தக்காளி பயிர் வழிகாட்டல்:**\n\n"
                "- **நோய் மேலாண்மை:** இலைகளில் பழுப்பு நிற வளையப் புள்ளிகள் தோன்றினால் அது **இலைக்கருகல் (Early Blight)** நோய். பாதிக்கப்பட்ட அடி இலைகளை அகற்றவும்.\n"
                "- **உர மேலாண்மை:** பூக்கும் போது பொட்டாஷ் மற்றும் கால்சியம் அவசியம். காய் அழுகலைத் தடுக்க சீரான நீர் பாய்ச்சவும்.\n"
                "- **நீர்ப்பாசனம்:** காலையில் செடியின் அடிப்பகுதிக்கு மட்டும் நீர் பாய்ச்சவும்."
            )
            follow_ups = ["தக்காளி செடிகள் பூக்கும் நிலையில் உள்ளனவா?", "இலைகளில் கருகல் புள்ளிகள் ஏதேனும் உள்ளனவா?"]
        else:
            reply = (
                f"{tag_en}**Tomato Plant Health & Care:**\n\n"
                "- **Blight Prevention:** Prune lower leaves touching the soil to prevent soil-borne Early/Late Blight.\n"
                "- **Nutrients:** Ensure adequate Calcium and even soil moisture to avoid **Blossom End Rot** (black sunken fruit bottoms).\n"
                "- **Watering:** Water at the root zone in the morning, keeping foliage dry to suppress fungal spores."
            )
            follow_ups = ["Are your tomato plants currently flowering or fruiting?", "Are you observing any dark concentric leaf spots?"]
        return reply, follow_ups

    # -----------------------------------------------------------------------
    # CROP 3: CHILLI
    # -----------------------------------------------------------------------
    if crop == "chilli":
        if is_watering:
            if language == "si":
                reply = (
                    f"{tag_si}**මිරිස් වගාවට ජලය යෙදීම පිළිබඳ මාර්ගෝපදේශය:**\n\n"
                    "- **වාර ගණන:** සාමාන්‍යයෙන් වියළි දිනවල සතියකට 2-3 වතාවක් හොඳින් මුල් තෙමෙන සේ ජලය යොදන්න. පස මතුපිට අඟලක් පමණ වියළි වූ විට ජලය දැමීම සුදුසුය.\n"
                    "- **මල් පිපෙන අවධිය:** මල් පිපෙන සහ කරල් හටගන්නා අවධියේදී ජල සැපයුම ඉතා වැදගත් වේ. ජල හිඟයක් ඇති වුවහොත් මල් හැලී යයි.\n"
                    "- **ජල වහනය:** මිරිස් මුල් ජලයේ ගිලී පැවතීමට අකමැතිය. ජලය රැඳී තිබුණහොත් මුල් කුණු වී ශාකය මැළවී යයි. නිසි ජල වහනයක් තබා ගන්න.\n"
                    "- **පාංශු ආවරණ:** වියළි පිදුරු හෝ වියළි කොළ යොදා පස ආවරණය කිරීමෙන් (Mulching) තෙතමනය රඳවාගත හැක."
                )
                follow_ups = [
                    "ඔබේ මිරිස් පැළ මේ වන විට මල් පිපෙන හෝ කරල් හටගන්නා අවධියේ පවතීද?",
                    "ඔබේ වගාවේ පස ජලය හොඳින් බැස යන වැලි ලෝම පසක්ද?",
                    "දහවල් කාලයේදී කොළ මැළවීමක් දක්නට තිබේද?",
                ]
            elif language == "ta":
                reply = (
                    f"{tag_ta}**மிளகாய் பயிருக்கான நீர்ப்பாசன வழிகாட்டல்:**\n\n"
                    "- **நீர்ப்பாசன இடைவெளி:** வறண்ட காலங்களில் வாரத்திற்கு 2 முதல் 3 முறை மிளகாய் செடிகளுக்கு நீர் பாய்ச்சவும். மேல் மண் லேசாகக் காய்ந்தவுடன் நீர் ஊற்றுவது சிறந்தது.\n"
                    "- **முக்கிய பருவம்:** பூக்கும் மற்றும் பிஞ்சு பிடிக்கும் பருவத்தில் சீரான ஈரப்பதம் கட்டாயம் தேவை. நீர் பற்றாக்குறை ஏற்பட்டால் பூக்கள் உதிர்ந்து விடும்.\n"
                    "- **வடிகால் வசதி:** மிளகாய் வேர்களில் தண்ணீர் தேங்கக் கூடாது. தண்ணீர் தேங்கினால் வேரழுகல் நோய் ஏற்பட்டு செடி வாடிவிடும்.\n"
                    "- **மூடாக்கு:** மண்ணின் ஈரப்பதத்தைப் பாதுகாக்க வைக்கோல் அல்லது காய்ந்த இலைகளைக் கொண்டு செடியின் அடியில் மூடாக்கு இடவும்."
                )
                follow_ups = [
                    "மிளகாய் செடிகள் தற்போது பூக்கும் அல்லது காய்க்கும் நிலையில் உள்ளனவா?",
                    "மண்ணில் தண்ணீர் தேங்காமல் வடிந்து செல்கிறதா?",
                    "பகல் வேளையில் இலைகள் வாடி காணப்படுகின்றனவா?",
                ]
            else:
                reply = (
                    f"{tag_en}**Chilli Plant Watering & Irrigation Guide:**\n\n"
                    "- **Frequency:** Water 2 to 3 times per week during dry periods. Water whenever the top 2.5 cm (1 inch) of soil feels dry.\n"
                    "- **Critical Flowering Stage:** Even moisture is most critical during **flowering and fruit set**. Water stress during bloom causes flowers to drop.\n"
                    "- **Drainage:** Chilli roots are very vulnerable to waterlogging and root rot (damping-off). Never let standing water remain around the stems.\n"
                    "- **Mulching:** Apply a 5 cm layer of organic straw or dry leaves around the base to retain moisture and keep roots cool."
                )
                follow_ups = [
                    "Are your chilli plants currently flowering or setting pods?",
                    "Does the soil drain freely after heavy watering?",
                    "Are you noticing any midday wilting in the foliage?",
                ]
            return reply, follow_ups

        # Chilli general / leaf curl
        if language == "si":
            reply = (
                f"{tag_si}**මිරිස් වගාවේ කොළ රැලිවීම (කොකුඩුවීම) සහ කළමනාකරණය:**\n\n"
                "- **පැළ මැක්කන් (Thrips):** කොළ උඩු අතට බෝට්ටුවක් සේ රැලි වේ නම් පැළ මැක්කන්ගේ හානියයි. නිල් ඇලෙන උගුල් සහ කොහොඹ තෙල් යොදන්න.\n"
                "- **මයිටාවන් (Mites):** කොළ යටි අතට රැලි වී ඝන වේ නම් මයිටා හානියයි. සල්ෆර් හෝ මයිටා නාශකයක් යොදන්න.\n"
                "- **මිරිස් කොළ අංගමාරය / කරල් කුණුවීම (Anthracnose):** කොපර් දිලීර නාශක යොදන්න."
            )
            follow_ups = ["කොළ රැලි වී ඇත්තේ උඩු අතටද නැතහොත් යටි අතටද?", "කරල් මත කළු පැහැ ලප දක්නට ලැබේද?"]
        elif language == "ta":
            reply = (
                f"{tag_ta}**மிளகாய் இலை சுருட்டை மற்றும் நோய் மேலாண்மை:**\n\n"
                "- **இலைப்பேன்:** இலைகள் படகு வடிவில் மேல்நோக்கி சுருண்டால் இலைப்பேன் தாக்குதல். நீல ஒட்டும் பொறிகள் வைக்கவும்.\n"
                "- **மஞ்சள் சிலந்தி:** இலைகள் கீழ்நோக்கி சுருண்டு தடித்தால் சிலந்தித் தாக்குதல். கந்தகம் அல்லது வேப்ப எண்ணெய் தெளிக்கவும்.\n"
                "- **காய் அழுகல் நோய்:** பாதிக்கப்பட்ட காய்களை நீக்கி காப்பர் மருந்துகளைத் தெளிக்கவும்."
            )
            follow_ups = ["இலைகள் மேல்நோக்கி சுருண்டுள்ளதா அல்லது கீழ்நோக்கியா?", "காய்களில் கரும்புள்ளிகள் ஏதேனும் உள்ளதா?"]
        else:
            reply = (
                f"{tag_en}**Chilli Crop Protection & Management:**\n\n"
                "- **Upward Cupping (Thrips):** Boat-shaped upward cupping with bronzed undersides indicates thrips. Use blue sticky traps and spray neem oil (5 ml/L).\n"
                "- **Downward Curling (Yellow Mites):** Inverted cupping with thick leathery leaves indicates broad mites. Apply wettable sulfur.\n"
                "- **Anthracnose (Fruit Rot):** Sunken circular black lesions on pods require sanitation and protective copper sprays."
            )
            follow_ups = ["Are the leaves curling upwards or downwards?", "Are you seeing sunken dark spots on ripening pods?"]
        return reply, follow_ups

    # -----------------------------------------------------------------------
    # CROP 4: RICE / PADDY
    # -----------------------------------------------------------------------
    if crop == "rice":
        if language == "si":
            reply = (
                f"{tag_si}**වී වගා කළමනාකරණය සහ පොහොර උපදෙස්:**\n\n"
                "1. **පොහොර යෙදීම:** සිටුවීමේදී TSP සහ MOP යටි පොහොර ලෙස යොදන්න. යූරියා සති 2-3 ගොබ අවධියේදී සහ සති 5-6 කරල් ආරම්භයේදී බෙදා යොදන්න.\n"
                "2. **කොළ පාළුව (Rice Blast):** කොළ මත දඟර හැඩැති (Spindle-shaped) අළු පැහැ ලප ඇති වේ. අධික නයිට්‍රජන් යෙදීම නවත්වන්න; ජල මට්ටම ස්ථාවරව තබා ගන්න.\n"
                "3. **දුඹුරු පැළ මැක්කා (BPH):** කුඹුර මැද රවුම් ලෙස ගොයම් කහ වී වේලී යාම (Hopper burn). ආලෝක උගුල් සහ ජල මට්ටම පහත හෙළීම මගින් පාලනය කරන්න."
            )
            follow_ups = ["ඔබේ ගොයම දැනට කුමන වර්ධන අවධියේ පවතීද?", "කොළ මත දඟර හැඩැති දුඹුරු ලප තිබේද?"]
        elif language == "ta":
            reply = (
                f"{tag_ta}**நெல் பயிர் மேலாண்மை மற்றும் உர வழிகாட்டல்:**\n\n"
                "1. **உர மேலாண்மை:** நடவின் போது டிஏபி/பொட்டாஷ் இடவும். யூரியாவை தூர் கட்டும் பருவத்திலும் கதிர் உருவாகும் பருவத்திலும் பிரித்து இடவும்.\n"
                "2. **குலை நோய் (Blast):** இலைகளில் கண் வடிவ அல்லது படகு வடிவப் புள்ளிகள். அதிக யூரியா இடுவதைத் தவிர்க்கவும்.\n"
                "3. **புகையான் (Brown Planthopper):** வட்ட வடிவில் பயிர் காய்ந்து போதல். வயலில் தண்ணீரை வடித்துவிட்டு வெளிச்சம் படும்படி செய்யவும்."
            )
            follow_ups = ["நெற்பயிர் தற்போது எந்த வளர்ச்சி நிலையில் உள்ளது?", "இலைகளில் படகு வடிவ புள்ளிகள் தென்படுகின்றனவா?"]
        else:
            reply = (
                f"{tag_en}**Rice (Paddy) Health & Field Management:**\n\n"
                "1. **Nutrient Split:** Apply basal TSP & MOP at planting. Split Urea into tillering (2-3 weeks) and panicle initiation (5-6 weeks).\n"
                "2. **Rice Blast (*Magnaporthe oryzae*):** Spindle-shaped lesions with gray centers. Avoid excessive Nitrogen during overcast, humid weather; maintain uniform water depth.\n"
                "3. **Brown Planthopper (BPH):** Causes circular patches of drying ('hopper burn'). Drain standing water temporarily and avoid broad-spectrum insecticides."
            )
            follow_ups = ["What growth stage is your paddy currently in?", "Are you noticing spindle-shaped spots on leaves?"]
        return reply, follow_ups

    # -----------------------------------------------------------------------
    # CROP 5: TEA
    # -----------------------------------------------------------------------
    if crop == "tea":
        if language == "si":
            reply = (
                f"{tag_si}**තේ වගා රෝග පාලනය සහ උපදෙස්:**\n\n"
                "- **පිටිපුස් රෝගය (Blister Blight):** මීදුම් සහිත ශීතල කාලගුණයේදී ලපටි දලුවල බිබිලි හටගනී. කෙටි නෙළීම් වට පවත්වන්න; තඹ දිලීර නාශක (Copper fungicides) නිර්දේශිත පරිදි යොදන්න.\n"
                "- **රතු මයිටාවන්:** වියළි කාලගුණයේදී කොළ මලකඩ පැහැ වේ. සෙවන පාලනය සහ නියමිත මයිටා නාශක යොදන්න."
            )
            follow_ups = ["පිටිපුස් රෝග ලක්ෂණ ලපටි දලුවල තිබේද?", "නෙළීම් වාර පවත්වන්නේ කිනම් කාලසීමාවකද?"]
        elif language == "ta":
            reply = (
                f"{tag_ta}**தேயிலை பயிர் பாதுகாப்பு ஆலோசனைகள்:**\n\n"
                "- **கொப்புள நோய் (Blister Blight):** பனி மற்றும் ஈரப்பதமான காலங்களில் இளம் தளிர்களில் கொப்புளங்கள் தோன்றும். காப்பர் மருந்துகளைத் தெளிக்கவும்.\n"
                "- **சிவப்பு சிலந்தி:** வறண்ட காலங்களில் இலைகள் துரு நிறமாகும். நிழல் மேலாண்மை செய்யவும்."
            )
            follow_ups = ["இளம் தளிர்களில் கொப்புளங்கள் தென்படுகின்றனவா?", "கொழுந்து பறிக்கும் இடைவெளி என்ன?"]
        else:
            reply = (
                f"{tag_en}**Tea Estate Health & Disease Control:**\n\n"
                "- **Blister Blight (*Exobasidium vexans*):** Common in cool, misty, humid weather affecting tender shoots. Shorten plucking rounds and apply copper-based fungicides per Tea Research Institute guidelines.\n"
                "- **Red Spider Mites:** Dusty, hot conditions cause leaf bronzing. Regulate shade and apply registered miticides."
            )
            follow_ups = ["Are blisters appearing on young tender leaves?", "How frequent are your plucking rounds?"]
        return reply, follow_ups

    # -----------------------------------------------------------------------
    # CROP 6: BANANA
    # -----------------------------------------------------------------------
    if crop == "banana":
        if language == "si":
            reply = (
                f"{tag_si}**කෙසෙල් වගා උපදෙස්:**\n\n"
                "- **පැනමා රෝගය (Fusarium Wilt):** පහළ කොළ කහ වී කඳ පාමුල පැලී යාම. රෝගී පඳුරු විනාශ කර බිම විෂබීජහරණය කරන්න.\n"
                "- **සිගටෝකා (Sigatoka Leaf Spot):** කොළ මත දිගටි දුඹුරු ලප. රෝගී කොළ කපා අස් කරන්න; පොටෑසියම් පෝෂණය වැඩි කරන්න."
            )
            follow_ups = ["යටි කොළ කහ වී කඳ පාමුල පැලීමක් තිබේද?", "කොළ මත දිගටි ලප දක්නට තිබේද?"]
        elif language == "ta":
            reply = (
                f"{tag_ta}**வாழை பயிர் ஆலோசனை:**\n\n"
                "- **பனாமா வாடல் நோய்:** அடி இலைகள் மஞ்சளாகி தண்டு வெடிக்கும். பாதிக்கப்பட்ட மரங்களை அழிக்கவும்.\n"
                "- **சிகடோகா இலைப்புள்ளி:** இலைகளில் நீள்வட்ட பழுப்பு புள்ளிகள். பொட்டாஷ் உரத்தை அதிகரிக்கவும்."
            )
            follow_ups = ["அடி இலைகள் மஞ்சளாகி தண்டு வெடிக்கிறதா?", "இலைகளில் கரும்புள்ளிகள் உள்ளதா?"]
        else:
            reply = (
                f"{tag_en}**Banana Crop Health Guide:**\n\n"
                "- **Panama Disease (Fusarium Wilt):** Yellowing of lower fronds and longitudinal splitting of the pseudostem base. Remove affected clumps and disinfect tools.\n"
                "- **Sigatoka Leaf Spot:** Oval brown lesions with gray centers. Prune diseased leaves and maintain high Potassium nutrition."
            )
            follow_ups = ["Is there pseudostem splitting near the soil line?", "Are you observing cigar leaf or broad leaf spots?"]
        return reply, follow_ups

    # -----------------------------------------------------------------------
    # General Symptoms (No Crop Specified)
    # -----------------------------------------------------------------------
    if is_yellowing:
        if language == "si":
            reply = (
                f"{tag_si}**කොළ කහවීම පිළිබඳ පොදු හේතු සහ විසඳුම්:**\n\n"
                "1. **අධික ජලය / ජල වහනය දුර්වල වීම:** මුල් කුණු වී පසෙන් පෝෂණය උරාගැනීම ඇනහිටී.\n"
                "2. **නයිට්‍රජන් (Nitrogen) ඌනතාව:** යටි කොළ මුලින්ම කහ පැහැ වේ. යූරියා හෝ කොම්පෝස්ට් යොදන්න.\n"
                "3. **යකඩ හෝ මැග්නීසියම් ඌනතාව:** නහර අතර කහ පැහැ වීම. ක්ෂුද්‍ර පෝෂක හෝ ඩොලමයිට් යොදන්න."
            )
            follow_ups = ["කහ පැහැය ඇත්තේ යට පැරණි කොළවලද නැතහොත් අලුත් ලපටි කොළවලද?", "මෙම ගැටලුව ඇත්තේ කිනම් බෝගයටද?"]
        elif language == "ta":
            reply = (
                f"{tag_ta}**இலைகள் மஞ்சள் நிறமாவதற்கான காரணங்கள்:**\n\n"
                "1. **அதிக தண்ணீர்:** வேரழுகல் ஏற்பட்டு சத்துக்கள் உறிஞ்சப்படாமல் போவது.\n"
                "2. **தழைச்சத்து (நைட்ரஜன்) பற்றாக்குறை:** அடி இலைகள் மஞ்சளாவது. யூரியா அல்லது மக்கிய உரம் இடவும்.\n"
                "3. **நுண்ணூட்டச்சத்து பற்றாக்குறை:** நரம்புகளுக்கு இடையே மஞ்சளாதல். டோலமைட் அல்லது நுண்ணூட்ட உரம் தெளிக்கவும்."
            )
            follow_ups = ["பழைய அடி இலைகள் மஞ்சளாகிறதா அல்லது இளம் இலைகளா?", "இது எந்த பயிரில் காணப்படுகிறது?"]
        else:
            reply = (
                f"{tag_en}**Leaf Yellowing (Chlorosis) Diagnosis:**\n\n"
                "1. **Waterlogging / Poor Drainage:** Suffocates roots and stops nutrient uptake.\n"
                "2. **Nitrogen Deficiency:** General yellowing starting from the oldest bottom leaves up. Apply compost or balanced nitrogen.\n"
                "3. **Micronutrient Deficiency (Iron/Magnesium):** Interveinal yellowing (green veins with yellow tissue). Apply chelated micronutrients or Dolomite."
            )
            follow_ups = ["Are the lower leaves yellowing first, or the newest top leaves?", "Which crop or plant is experiencing this?"]
        return reply, follow_ups

    if is_disease:
        if language == "si":
            reply = (
                f"{tag_si}**ශාක දිලීර සහ රෝග පාලන ක්‍රම:**\n\n"
                "- රෝගී කොළ සහ අතු කපා ඉවත් කර විනාශ කරන්න.\n"
                "- කොළ තෙත් වීම වැළැක්වීමට උදෑසන පමණක් පසට ජලය සපයන්න.\n"
                "- ආසාදනය පාලනයට කොපර් ඔක්සික්ලෝරයිඩ් හෝ මැන්කොසෙබ් නිර්දේශිත පරිදි යොදන්න."
            )
            follow_ups = ["ලපවල හැඩය සහ පැහැය කෙබඳුද?", "මෙම රෝගය වැළඳී ඇත්තේ කිනම් බෝගයටද?"]
        elif language == "ta":
            reply = (
                f"{tag_ta}**பயிர் பூஞ்சை மற்றும் நோய் கட்டுப்பாடு:**\n\n"
                "- பாதிக்கப்பட்ட இலைகளை உடனடியாக அகற்றி எரிக்கவும்.\n"
                "- இலைகள் நனையாமல் செடியின் வேர்ப்பகுதிக்கு மட்டும் நீர் பாய்ச்சவும்.\n"
                "- நோய் தீவிரமடைந்தால் காப்பர் ஆக்ஸிகுளோரைடு அல்லது மேன்கோசெப் தெளிக்கவும்."
            )
            follow_ups = ["புள்ளிகளின் நிறம் மற்றும் வடிவம் என்ன?", "இது எந்த வகையான பயிர்?"]
        else:
            reply = (
                f"{tag_en}**Fungal & Bacterial Disease Control:**\n\n"
                "- **Pruning:** Immediately cut and dispose of blighted foliage away from the crop.\n"
                "- **Moisture:** Irrigate at soil level in the morning to keep foliage dry.\n"
                "- **Fungicides:** Apply protective Copper Oxychloride or Mancozeb if lesions are actively expanding."
            )
            follow_ups = ["What color and shape are the spots or lesions?", "Which crop is affected?"]
        return reply, follow_ups

    if is_pest:
        if language == "si":
            reply = (
                f"{tag_si}**පළිබෝධ සහ කෘමි පාලනය:**\n\n"
                "- යුෂ උරාබොන කෘමීන් සඳහා කහ ඇලෙන උගුල් සහ කොහොඹ තෙල් මිශ්‍රණය (වතුර 1L ට 5ml) යොදන්න.\n"
                "- කොළ කන දළඹුවන් සඳහා Bacillus thuringiensis (Bt) හෝ ස්වභාවික විලෝපිතයන් ආරක්ෂා කරන්න."
            )
            follow_ups = ["හානිය සිදු කරන්නේ දළඹුවන්ද නැතහොත් කුඩා කෘමීන්ද?", "මෙම හානිය ඇත්තේ කුමන බෝගයේද?"]
        elif language == "ta":
            reply = (
                f"{tag_ta}**பூச்சி மேலாண்மை வழிகாட்டல்:**\n\n"
                "- சாறு உறிஞ்சும் பூச்சிகளுக்கு மஞ்சள் ஒட்டும் பொறிகள் மற்றும் வேப்ப எண்ணெய் கரைசல் (5 மி.லி/லி) தெளிக்கவும்.\n"
                "- புழுக்களுக்கு பேசிலஸ் துரிஞ்சியென்சிஸ் (Bt) தெளிக்கவும்."
            )
            follow_ups = ["சேதத்தை ஏற்படுத்துவது புழுக்களா அல்லது சிறு பூச்சிகளா?", "இது எந்த பயிர்?"]
        else:
            reply = (
                f"{tag_en}**Integrated Pest Management (IPM):**\n\n"
                "- **Sucking Pests:** Spray cold-pressed neem oil (5 ml/L with mild soap) and hang yellow/blue sticky traps.\n"
                "- **Chewing Caterpillars:** Apply *Bacillus thuringiensis* (Bt) or bio-control agents."
            )
            follow_ups = ["Are the pests chewing holes or sucking sap?", "Which crop is being damaged?"]
        return reply, follow_ups

    # Default fallback
    if language == "si":
        reply = (
            f"{tag_si}**AgriSense AI කෘෂිකාර්මික සහායක:**\n\n"
            "ඔබ සඳහන් කළ කරුණ සටහන් කර ගතිමි. වඩාත් නිවැරදි උපදෙස් ලබා දීමට කරුණාකර ඔබේ බෝගය (උදා: පොල්, වී, තක්කාලි, මිරිස්, තේ) සහ එහි දක්නට ඇති විශේෂිත ගැටලුව හෝ රෝග ලක්ෂණ සඳහන් කරන්න."
        )
        follow_ups = ["ඔබේ බෝගය කුමක්ද?", "පළිබෝධ හානියක්ද නැතහොත් පෝෂණ ඌනතාවක්ද?"]
    elif language == "ta":
        reply = (
            f"{tag_ta}**AgriSense AI வேளாண் விரிவாக்க உதவியாளர்:**\n\n"
            "உங்கள் தகவலைப் பெற்றேன். துல்லியமான ஆலோசனை வழங்க, உங்கள் பயிர் வகை (எ.கா: தென்னை, நெல், தக்காளி, மிளகாய், தேயிலை) மற்றும் அதன் அறிகுறிகளைக் குறிப்பிடவும்."
        )
        follow_ups = ["உங்கள் பயிர் என்ன?", "பூச்சித் தாக்குதலா அல்லது உரப் பிரச்சினையா?"]
    else:
        reply = (
            f"{tag_en}**AgriSense AI Agricultural Assistant:**\n\n"
            "I noted your message. To give you specific diagnostic and management advice, please let me know your crop (e.g. Coconut, Rice, Tomato, Chilli, Tea) and what specific symptoms you are observing."
        )
        follow_ups = ["Which crop are you asking about?", "Are you observing pest damage, leaf spots, or watering issues?"]

    return reply, follow_ups


# ---------------------------------------------------------------------------
# Public Assistant Interface
# ---------------------------------------------------------------------------

async def generate_assistant_reply(
    history: list[tuple[str, str]],
    new_message: str,
    context_block: str = "",
    language: str = "en",
) -> tuple[str, list[str]]:
    if _has_valid_api_key():
        try:
            system_prompt = BASE_SYSTEM_PROMPT + context_block
            if language != "en":
                language_name = LANGUAGE_NAMES.get(language, language)
                system_prompt += (
                    f"\nIMPORTANT: Reply entirely in {language_name}. Keep any chemical/product names in "
                    "their common form (Latin/English) since farmers usually recognize product labels that "
                    f"way, but every sentence of your explanation must be in {language_name}."
                )

            messages = [{"role": "system", "content": system_prompt}]
            messages += [{"role": r, "content": c} for r, c in history]
            messages.append({"role": "user", "content": new_message})

            reply_text = await _chat_completion(messages)
            follow_ups = _extract_follow_up_questions(reply_text)
            return reply_text, follow_ups
        except Exception as exc:
            logger.warning("Remote LLM request failed (%s). Falling back to built-in extension assistant.", exc)

    return _generate_built_in_reply(history, new_message, context_block, language)


async def translate_fields(fields: dict[str, str | None], target_language: str) -> dict[str, str | None]:
    if target_language == "en" or not _has_valid_api_key():
        return fields

    translatable = {k: v for k, v in fields.items() if v}
    if not translatable:
        return fields

    language_name = LANGUAGE_NAMES.get(target_language, target_language)
    prompt = (
        f"Translate the values of this JSON object into {language_name}. "
        "Keep the keys exactly as given. Keep specific chemical/product names in their common "
        "form rather than transliterating them. Respond with ONLY the translated JSON object, "
        "no markdown fences, no commentary.\n\n"
        f"{json.dumps(translatable, ensure_ascii=False)}"
    )

    try:
        raw = await _chat_completion(
            [
                {"role": "system", "content": "You are a precise JSON-in, JSON-out translation tool."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=800,
        )
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        translated = json.loads(cleaned)
        if not isinstance(translated, dict):
            return fields
        result = dict(fields)
        for key, value in translated.items():
            if key in result and isinstance(value, str):
                result[key] = value
        return result
    except Exception:
        return fields


def _extract_follow_up_questions(reply_text: str) -> list[str]:
    return [s.strip() + "?" for s in reply_text.split("?")[:-1] if len(s.strip()) > 8][:3]