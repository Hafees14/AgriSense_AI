"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { AUTH_STORAGE_KEY } from "@/lib/auth";

export type Language = "en" | "si" | "ta";

const STORAGE_KEY = "agrisense_lang";

// Keep this dictionary flat (page.key) so it's easy to scan for what's
// translated vs. still English. Add new keys here as more of the app gets
// covered — the t() helper below falls back to the key itself if a
// translation is missing, so a missing entry never crashes a page.
const DICTIONARY: Record<string, Record<Language, string>> = {
  "nav.dashboard": { en: "My farms", si: "මගේ ගොවිපළවල්", ta: "எனது பண்ணைகள்" },
  "nav.diagnose": { en: "Diagnose", si: "රෝග විනිශ්චය", ta: "நோய் கண்டறிதல்" },
  "nav.outbreaks": { en: "Outbreak map", si: "ව්‍යාප්ති සිතියම", ta: "பரவல் வரைபடம்" },
  "nav.chat": { en: "Ask assistant", si: "සහායකගෙන් අසන්න", ta: "உதவியாளரிடம் கேளுங்கள்" },
  "nav.history": { en: "History", si: "ඉතිහාසය", ta: "வரலாறு" },
  "nav.login": { en: "Log in", si: "පිවිසෙන්න", ta: "உள்நுழைக" },
  "nav.register": { en: "Sign up", si: "ලියාපදිංචි වන්න", ta: "பதிவு செய்யவும்" },
  "nav.logout": { en: "Log out", si: "පිටවීම", ta: "வெளியேறு" },

  "login.title": { en: "Log in", si: "පිවිසෙන්න", ta: "உள்நுழைக" },
  "login.email": { en: "Email", si: "විද්‍යුත් තැපෑල", ta: "மின்னஞ்சல்" },
  "login.password": { en: "Password", si: "මුරපදය", ta: "கடவுச்சொல்" },
  "login.submit": { en: "Log in", si: "පිවිසෙන්න", ta: "உள்நுழைக" },
  "login.submitting": { en: "Logging in…", si: "පිවිසෙමින්…", ta: "உள்நுழைகிறது…" },

  "register.title": { en: "Create your account", si: "ඔබේ ගිණුම සාදන්න", ta: "உங்கள் கணக்கை உருவாக்கவும்" },
  "register.name": { en: "Name", si: "නම", ta: "பெயர்" },
  "register.email": { en: "Email", si: "විද්‍යුත් තැපෑල", ta: "மின்னஞ்சல்" },
  "register.phone": { en: "Phone", si: "දුරකථනය", ta: "தொலைபேசி" },
  "register.password": { en: "Password", si: "මුරපදය", ta: "கடவுச்சொல்" },
  "register.language": { en: "Preferred language", si: "කැමති භාෂාව", ta: "விருப்பமான மொழி" },
  "register.submit": { en: "Sign up", si: "ලියාපදිංචි වන්න", ta: "பதிவு செய்யவும்" },
  "register.submitting": { en: "Creating account…", si: "ගිණුම සාදමින්…", ta: "கணக்கு உருவாக்கப்படுகிறது…" },

  "diagnose.title": { en: "Diagnose a crop issue", si: "බෝග ගැටලුවක් විනිශ්චය කරන්න", ta: "பயிர் பிரச்சினையை கண்டறியவும்" },
  "diagnose.submit": { en: "Diagnose", si: "විනිශ්චය කරන්න", ta: "கண்டறியவும்" },
  "diagnose.submitting": { en: "Analyzing…", si: "විශ්ලේෂණය කරමින්…", ta: "பகுப்பாய்வு செய்கிறது…" },

  "chat.title": { en: "Ask AgriSense", si: "AgriSense වෙතින් අසන්න", ta: "AgriSense-ஐ கேளுங்கள்" },
  "chat.placeholder": { en: "Ask about your crop…", si: "ඔබේ බෝගය ගැන අසන්න…", ta: "உங்கள் பயிர் பற்றி கேளுங்கள்…" },
  "chat.send": { en: "Send", si: "යවන්න", ta: "அனுப்பு" },

  "outbreaks.title": { en: "Nearby outbreaks", si: "ආසන්න ව්‍යාප්ති", ta: "அருகிலுள்ள பரவல்கள்" },
  "outbreaks.subtitle": {
    en: "High-confidence disease and pest reports from other farmers near you, in the last 30 days.",
    si: "පසුගිය දින 30 තුළ ඔබ අවට වෙනත් ගොවීන්ගෙන් ලද ඉහළ විශ්වසනීයත්වයකින් යුත් රෝග හා පළිබෝධ වාර්තා.",
    ta: "கடந்த 30 நாட்களில் உங்களுக்கு அருகிலுள்ள மற்ற விவசாயிகளிடமிருந்து அதிக நம்பகத்தன்மையுள்ள நோய் மற்றும் பூச்சி அறிக்கைகள்.",
  },

  "offline.noConnection": {
    en: "You're offline. Photos you submit now will be saved and sent automatically once you're back online.",
    si: "ඔබ අන්තර්ජාලයෙන් විසන්ධි වී ඇත. දැන් ඉදිරිපත් කරන ඡායාරූප ඉතිරි කර, නැවත සම්බන්ධ වූ පසු ස්වයංක්‍රීයව යවනු ලැබේ.",
    ta: "நீங்கள் ஆஃப்லைனில் உள்ளீர்கள். இப்போது சமர்ப்பிக்கும் புகைப்படங்கள் சேமிக்கப்பட்டு, மீண்டும் இணைந்தவுடன் தானாக அனுப்பப்படும்.",
  },
  "offline.oneQueued": {
    en: "diagnosis waiting to sync",
    si: "විනිශ්චයක් සමමුහූර්ත වීමට රැඳී ඇත",
    ta: "நோய் கண்டறிதல் ஒத்திசைவுக்காக காத்திருக்கிறது",
  },
  "offline.manyQueued": {
    en: "diagnoses waiting to sync",
    si: "විනිශ්චයන් සමමුහූර්ත වීමට රැඳී ඇත",
    ta: "நோய் கண்டறிதல்கள் ஒத்திசைவுக்காக காத்திருக்கின்றன",
  },
  "offline.syncNow": { en: "Sync now", si: "දැන් සමමුහූර්ත කරන්න", ta: "இப்போது ஒத்திசைக்கவும்" },
  "offline.syncing": { en: "Syncing…", si: "සමමුහූර්ත වෙමින්…", ta: "ஒத்திசைக்கிறது…" },
  "offline.retry": { en: "Retry", si: "නැවත උත්සාහ කරන්න", ta: "மீண்டும் முயற்சி" },
  "offline.discard": { en: "Discard", si: "ඉවත් කරන්න", ta: "நீக்கு" },
  "offline.uploadFailed": { en: "Upload failed", si: "උඩුගත කිරීම අසාර්ථක විය", ta: "பதிவேற்றம் தோல்வியடைந்தது" },
  "offline.queuedMessage": {
    en: "No connection right now — your photo has been saved and will be submitted automatically once you're back online.",
    si: "දැනට සම්බන්ධතාවයක් නැත — ඔබේ ඡායාරූපය ඉතිරි කර ඇත, නැවත සම්බන්ධ වූ පසු ස්වයංක්‍රීයව ඉදිරිපත් කෙරේ.",
    ta: "இப்போது இணைப்பு இல்லை — உங்கள் புகைப்படம் சேமிக்கப்பட்டுள்ளது, மீண்டும் இணைந்தவுடன் தானாக சமர்ப்பிக்கப்படும்.",
  },

  "badge.verified": { en: "Verified by an officer", si: "නිලධාරියෙකු විසින් තහවුරු කර ඇත", ta: "அதிகாரியால் சரிபார்க்கப்பட்டது" },
  "badge.pendingReview": { en: "Pending expert review", si: "විශේෂඥ සමාලෝචනය පොරොත්තුවෙන්", ta: "நிபுணர் மதிப்பாய்வுக்காக காத்திருக்கிறது" },
  "nav.reviewQueue": { en: "Review queue", si: "සමාලෝචන පෝලිම", ta: "மதிப்பாய்வு வரிசை" },
  "review.title": { en: "Diagnoses awaiting review", si: "සමාලෝචනය අපේක්ෂාවෙන් ඇති විනිශ්චය", ta: "மதிப்பாய்வுக்காக காத்திருக்கும் நோய் கண்டறிதல்கள்" },
  "review.subtitle": {
    en: "An overview of crop issues being reported across your area, and diagnoses waiting for your sign-off.",
    si: "ඔබේ ප්‍රදේශය පුරා වාර්තා වන බෝග ගැටලු පිළිබඳ දළ විශ්ලේෂණයක් සහ ඔබේ අනුමැතිය බලාපොරොත්තුවෙන් ඇති විනිශ්චය.",
    ta: "உங்கள் பகுதி முழுவதும் தெரிவிக்கப்படும் பயிர் பிரச்சினைகளின் கண்ணோட்டமும், உங்கள் ஒப்புதலுக்காக காத்திருக்கும் நோய் கண்டறிதல்களும்.",
  },
  "review.statPending": { en: "Pending review", si: "සමාලෝචනය පොරොත්තුවෙන්", ta: "மதிப்பாய்வு நிலுவையில்" },
  "review.statReviewed": { en: "Reviewed (30d)", si: "සමාලෝචනය කළ (දින 30)", ta: "மதிப்பாய்வு செய்யப்பட்டவை (30 நாட்கள்)" },
  "review.statFarmers": { en: "Registered farmers", si: "ලියාපදිංචි ගොවීන්", ta: "பதிவு செய்யப்பட்ட விவசாயிகள்" },
  "review.byArea": { en: "By area", si: "ප්‍රදේශය අනුව", ta: "பகுதி வாரியாக" },
  "review.last30days": { en: "last 30 days", si: "පසුගිය දින 30", ta: "கடந்த 30 நாட்கள்" },
  "review.reports": { en: "reports", si: "වාර්තා", ta: "அறிக்கைகள்" },
  "review.needReview": { en: "need review", si: "සමාලෝචනය අවශ්‍යයි", ta: "மதிப்பாய்வு தேவை" },
  "review.highSeverity": { en: "high severity", si: "ඉහළ බරපතලකම", ta: "அதிக தீவிரம்" },
  "review.disease": { en: "disease", si: "රෝග", ta: "நோய்" },
  "review.pest": { en: "pest", si: "පළිබෝධ", ta: "பூச்சி" },
  "review.topIssue": { en: "Top issue", si: "ප්‍රධාන ගැටලුව", ta: "முதன்மை பிரச்சினை" },
  "review.queueHeading": { en: "Individual reports", si: "තනි වාර්තා", ta: "தனிப்பட்ட அறிக்கைகள்" },
  "review.notesPlaceholder": { en: "Notes for the farmer (optional)", si: "ගොවියාට සටහන් (විකල්ප)", ta: "விவசாயிக்கான குறிப்புகள் (விருப்பமானது)" },
  "review.markVerified": { en: "Mark verified", si: "තහවුරු කළ ලෙස සලකුණු කරන්න", ta: "சரிபார்க்கப்பட்டதாக குறிக்கவும்" },
  "review.empty": { en: "Nothing waiting for review right now.", si: "දැනට සමාලෝචනය සඳහා කිසිවක් නොමැත.", ta: "இப்போது மதிப்பாய்வுக்காக எதுவும் இல்லை." },
  "review.officersOnly": {
    en: "This page is only available to agricultural officer accounts.",
    si: "මෙම පිටුව කෘෂිකර්ම නිලධාරී ගිණුම් සඳහා පමණක් ලබා ගත හැක.",
    ta: "இந்தப் பக்கம் விவசாய அதிகாரி கணக்குகளுக்கு மட்டுமே கிடைக்கும்.",
  },

  "notifications.title": { en: "Notifications", si: "දැනුම්දීම්", ta: "அறிவிப்புகள்" },
  "notifications.empty": { en: "No notifications yet.", si: "තවම දැනුම්දීම් නොමැත.", ta: "இதுவரை அறிவிப்புகள் இல்லை." },
};

export function t(key: string, language: Language): string {
  return DICTIONARY[key]?.[language] ?? DICTIONARY[key]?.en ?? key;
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // On first load: prefer whatever's saved on the device, then reconcile
  // with the account's saved preference once we know if they're logged in
  // (a farmer switching devices should see their own language, not
  // whatever this browser happened to have last).
  //
  // Only attempt this when a token actually exists — calling /auth/me for
  // an anonymous visitor is guaranteed to 403, and a browser logs that as
  // a red network error in devtools regardless of the .catch() below, so
  // it's worth skipping the request entirely rather than just swallowing
  // the failure after the fact.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? (window.localStorage.getItem(STORAGE_KEY) as Language | null) : null;
    if (stored) setLanguageState(stored);

    const hasToken = typeof window !== "undefined" && window.localStorage.getItem(AUTH_STORAGE_KEY) !== null;
    if (!hasToken) return;

    api.auth
      .me()
      .then((user) => {
        const accountLang = (user as { language_pref?: Language }).language_pref;
        if (accountLang && accountLang !== stored) {
          setLanguageState(accountLang);
          window.localStorage.setItem(STORAGE_KEY, accountLang);
        }
      })
      .catch(() => {
        /* token present but invalid/expired — device preference stands */
      });
  }, []);

  // Keep <html lang> in sync so screen readers and per-script CSS font
  // rules (see globals.css) pick up the farmer's actual chosen language,
  // not the "en" it's hardcoded to in the document.
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, lang);
    // Best-effort sync to the account so it follows the farmer to other
    // devices too. If they're not logged in, this just fails quietly.
    api.auth.updateLanguage(lang).catch(() => {});
  }, []);

  const translate = useCallback((key: string) => t(key, language), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translate }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage() must be used inside <LanguageProvider>");
  return ctx;
}