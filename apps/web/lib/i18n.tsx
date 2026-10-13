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
  "common.loading": { en: "Loading…", si: "පූරණය වෙමින්…", ta: "ஏற்றுகிறது…" },
  "common.dismiss": { en: "Dismiss", si: "ඉවත් කරන්න", ta: "மூடு" },
  "common.required": { en: "required", si: "අවශ්‍යයි", ta: "தேவை" },
  "common.showPassword": { en: "Show password", si: "මුරපදය පෙන්වන්න", ta: "கடவுச்சொல்லைக் காட்டு" },
  "common.hidePassword": { en: "Hide password", si: "මුරපදය සඟවන්න", ta: "கடவுச்சொல்லை மறை" },

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

  "login.subtitle": { en: "Log in to your AgriSense AI account", si: "ඔබේ AgriSense AI ගිණුමට පිවිසෙන්න", ta: "உங்கள் AgriSense AI கணக்கில் உள்நுழைக" },
  "login.noAccount": { en: "Don't have an account?", si: "ගිණුමක් නැද්ද?", ta: "கணக்கு இல்லையா?" },
  "login.signupLink": { en: "Sign up", si: "ලියාපදිංචි වන්න", ta: "பதிவு செய்யவும்" },
  "register.subtitle": { en: "Get started in a few minutes", si: "විනාඩි කිහිපයකින් ආරම්භ කරන්න", ta: "சில நிமிடங்களில் தொடங்குங்கள்" },
  "register.haveAccount": { en: "Already have an account?", si: "දැනටමත් ගිණුමක් තිබේද?", ta: "ஏற்கனவே கணக்கு உள்ளதா?" },
  "register.loginLink": { en: "Log in", si: "පිවිසෙන්න", ta: "உள்நுழைக" },
  "register.optional": { en: "(optional)", si: "(අත්‍යවශ්‍ය නොවේ)", ta: "(விருப்பத்திற்குரியது)" },
  "register.passwordHint": { en: "At least 8 characters", si: "අවම වශයෙන් අක්ෂර 8ක්", ta: "குறைந்தது 8 எழுத்துகள்" },
  "register.accountType": { en: "Account type", si: "ගිණුම් වර්ගය", ta: "கணக்கு வகை" },
  "register.role.farmer": { en: "Farmer", si: "ගොවියා", ta: "விவசாயி" },
  "register.role.officer": { en: "Agricultural officer", si: "කෘෂිකර්ම නිලධාරියා", ta: "வேளாண் அலுவலர்" },
  "register.role.researcher": { en: "Researcher", si: "පර්යේෂකයා", ta: "ஆராய்ச்சியாளர்" },
  "register.code": { en: "Officer/researcher signup code", si: "නිලධාරි/පර්යේෂක ලියාපදිංචි කේතය", ta: "அலுவலர்/ஆராய்ச்சியாளர் பதிவுக் குறியீடு" },
  "register.codePlaceholder": { en: "Provided by your program coordinator", si: "ඔබේ වැඩසටහන් සම්බන්ධීකාරක විසින් ලබා දේ", ta: "உங்கள் திட்ட ஒருங்கிணைப்பாளர் வழங்கியது" },
  "register.codeHint": { en: "This role can review other farmers' diagnoses, so it needs a code from your team, not open self-signup.", si: "මෙම භූමිකාවට අනෙක් ගොවීන්ගේ රෝග විනිශ්චය සමාලෝචනය කළ හැකි බැවින්, ඔබේ කණ්ඩායමෙන් ලබාගත් කේතයක් අවශ්‍ය වේ.", ta: "இந்தப் பங்கு மற்ற விவசாயிகளின் நோய் கண்டறிதல்களை மதிப்பாய்வு செய்ய முடியும் என்பதால், உங்கள் குழுவிடமிருந்து பெற்ற குறியீடு தேவை." },
  "validation.nameMin": { en: "Name must be at least 2 characters", si: "නම අවම වශයෙන් අක්ෂර 2ක් විය යුතුය", ta: "பெயர் குறைந்தது 2 எழுத்துகள் இருக்க வேண்டும்" },
  "validation.emailRequired": { en: "Enter your email", si: "විද්‍යුත් තැපෑල ඇතුළත් කරන්න", ta: "மின்னஞ்சலை உள்ளிடவும்" },
  "validation.emailInvalid": { en: "Enter a valid email address", si: "වලංගු විද්‍යුත් තැපැල් ලිපිනයක් ඇතුළත් කරන්න", ta: "சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்" },
  "validation.passwordRequired": { en: "Enter your password", si: "මුරපදය ඇතුළත් කරන්න", ta: "கடவுச்சொல்லை உள்ளிடவும்" },
  "validation.passwordMin": { en: "Password must be at least 8 characters", si: "මුරපදය අවම වශයෙන් අක්ෂර 8ක් විය යුතුය", ta: "கடவுச்சொல் குறைந்தது 8 எழுத்துகள் இருக்க வேண்டும்" },
  "validation.codeRequired": { en: "Enter the signup code", si: "ලියාපදිංචි කේතය ඇතුළත් කරන්න", ta: "பதிவுக் குறியீட்டை உள்ளிடவும்" },
  "error.invalidCredentials": { en: "Incorrect email or password", si: "විද්‍යුත් තැපෑල හෝ මුරපදය වැරදියි", ta: "மின்னஞ்சல் அல்லது கடவுச்சொல் தவறானது" },
  "error.accountDisabled": { en: "This account is disabled", si: "මෙම ගිණුම අක්‍රියයි", ta: "இந்தக் கணக்கு முடக்கப்பட்டுள்ளது" },
  "error.emailTaken": { en: "This email is already registered", si: "මෙම විද්‍යුත් තැපෑල දැනටමත් ලියාපදිංචි වී ඇත", ta: "இந்த மின்னஞ்சல் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது" },
  "error.invalidCode": { en: "The signup code is missing or incorrect", si: "ලියාපදිංචි කේතය නැත හෝ වැරදියි", ta: "பதிவுக் குறியீடு இல்லை அல்லது தவறானது" },
  "error.network": { en: "Can't reach the server. Check your connection and try again.", si: "සේවාදායකයට සම්බන්ධ විය නොහැක. ඔබේ අන්තර්ජාලය පරීක්ෂා කර නැවත උත්සාහ කරන්න.", ta: "சேவையகத்தை அணுக முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும்." },
  "error.generic": { en: "Something went wrong. Please try again.", si: "යම් දෙයක් වැරදී ගියා. නැවත උත්සාහ කරන්න.", ta: "ஏதோ தவறு நடந்தது. மீண்டும் முயலவும்." },

  "diagnose.title": { en: "Diagnose a crop issue", si: "බෝග ගැටලුවක් විනිශ්චය කරන්න", ta: "பயிர் பிரச்சினையை கண்டறியவும்" },
  "diagnose.submit": { en: "Diagnose", si: "විනිශ්චය කරන්න", ta: "கண்டறியவும்" },
  "diagnose.submitting": { en: "Analyzing…", si: "විශ්ලේෂණය කරමින්…", ta: "பகுப்பாய்வு செய்கிறது…" },
  "diagnose.subtitle": { en: "Choose what to check, then add a clear, close-up photo.", si: "කුමක් පරීක්ෂා කරන්නදැයි තෝරා, පැහැදිලි සමීප ඡායාරූපයක් එක් කරන්න.", ta: "எதைச் சரிபார்க்க வேண்டும் என்பதைத் தேர்ந்தெடுத்து, தெளிவான நெருக்கமான புகைப்படத்தைச் சேர்க்கவும்." },
  "diagnose.step1": { en: "1. What do you want to check?", si: "1. ඔබට පරීක්ෂා කිරීමට අවශ්‍ය කුමක්ද?", ta: "1. எதைச் சரிபார்க்க விரும்புகிறீர்கள்?" },
  "diagnose.step2": { en: "2. Add a photo", si: "2. ඡායාරූපයක් එක් කරන්න", ta: "2. புகைப்படத்தைச் சேர்க்கவும்" },
  "diagnose.type.disease": { en: "Disease", si: "රෝග", ta: "நோய்" },
  "diagnose.type.disease.desc": { en: "Problems on leaves or fruit", si: "කොළ හෝ පලතුරු මත ඇති ගැටලු", ta: "இலை அல்லது பழத்தில் உள்ள பிரச்சினைகள்" },
  "diagnose.type.pest": { en: "Pest", si: "පළිබෝධ", ta: "பூச்சி" },
  "diagnose.type.pest.desc": { en: "Insects and larvae", si: "කෘමීන් සහ කීටයන්", ta: "பூச்சிகள் மற்றும் புழுக்கள்" },
  "diagnose.type.plant_id": { en: "Plant ID", si: "ශාක හඳුනාගැනීම", ta: "தாவர அடையாளம்" },
  "diagnose.type.plant_id.desc": { en: "Find out which plant it is", si: "එය කුමන ශාකයදැයි සොයා ගන්න", ta: "அது எந்தத் தாவரம் என்பதைக் கண்டறியவும்" },
  "diagnose.takePhoto": { en: "Take a photo", si: "ඡායාරූපයක් ගන්න", ta: "புகைப்படம் எடுக்கவும்" },
  "diagnose.chooseFile": { en: "Choose from gallery", si: "ගැලරියෙන් තෝරන්න", ta: "கேலரியில் இருந்து தேர்ந்தெடுக்கவும்" },
  "diagnose.dropHint": { en: "or drag and drop an image here", si: "නැතහොත් රූපයක් මෙතැනට ඇද දමන්න", ta: "அல்லது படத்தை இங்கே இழுத்து விடவும்" },
  "diagnose.photoTip": { en: "Get close: fill the frame with the leaf, fruit or pest. JPG, PNG or WebP, up to 10 MB.", si: "සමීපව ගන්න: රාමුව කොළය, පලතුර හෝ පළිබෝධයෙන් පුරවන්න. JPG, PNG හෝ WebP, 10 MB දක්වා.", ta: "நெருக்கமாக எடுக்கவும்: இலை, பழம் அல்லது பூச்சியால் சட்டத்தை நிரப்பவும். JPG, PNG அல்லது WebP, 10 MB வரை." },
  "diagnose.previewAlt": { en: "Preview of the selected photo", si: "තෝරාගත් ඡායාරූපයේ පෙරදසුන", ta: "தேர்ந்தெடுத்த புகைப்படத்தின் முன்னோட்டம்" },
  "diagnose.replace": { en: "Replace photo", si: "ඡායාරූපය වෙනස් කරන්න", ta: "புகைப்படத்தை மாற்று" },
  "diagnose.remove": { en: "Remove", si: "ඉවත් කරන්න", ta: "நீக்கு" },
  "diagnose.selectPhoto": { en: "Add a photo to continue", si: "ඉදිරියට යාමට ඡායාරූපයක් එක් කරන්න", ta: "தொடர புகைப்படத்தைச் சேர்க்கவும்" },
  "diagnose.preparing": { en: "Preparing your photo…", si: "ඔබේ ඡායාරූපය සූදානම් කරමින්…", ta: "உங்கள் புகைப்படத்தைத் தயார் செய்கிறது…" },
  "diagnose.locationNote": { en: "If you allow location access, it is saved with the diagnosis for nearby outbreak alerts.", si: "ඔබ ස්ථාන ප්‍රවේශය ලබා දුන්නොත්, අවට ව්‍යාප්ති ඇඟවීම් සඳහා එය විනිශ්චය සමඟ සුරැකේ.", ta: "இருப்பிட அணுகலை அனுமதித்தால், அருகிலுள்ள பரவல் எச்சரிக்கைகளுக்காக அது கண்டறிதலுடன் சேமிக்கப்படும்." },
  "diagnose.confidence": { en: "Model confidence", si: "ආකෘතියේ විශ්වාසය", ta: "மாதிரியின் நம்பிக்கை" },
  "diagnose.comingSoon": { en: "Coming soon", si: "ඉක්මනින්", ta: "விரைவில்" },
  "diagnose.possible": { en: "Possible match (uncertain)", si: "විය හැකි ප්‍රතිඵලය (අවිනිශ්චිතයි)", ta: "சாத்தியமான முடிவு (உறுதியற்றது)" },
  "diagnose.adviceHidden": { en: "Treatment advice is hidden because this result is uncertain. Take another photo, or ask your local agriculture officer.", si: "ප්‍රතිඵලය අවිනිශ්චිත නිසා ප්‍රතිකාර උපදෙස් සඟවා ඇත. නැවත ඡායාරූපයක් ගන්න, නැතහොත් ඔබේ ප්‍රදේශයේ කෘෂිකර්ම නිලධාරියාගෙන් විමසන්න.", ta: "முடிவு உறுதியற்றதாக இருப்பதால் சிகிச்சை ஆலோசனை மறைக்கப்பட்டுள்ளது. மீண்டும் புகைப்படம் எடுக்கவும் அல்லது உங்கள் வேளாண் அலுவலரிடம் கேளுங்கள்." },
  "diagnose.heatmapNote": { en: "Brighter areas influenced the result most.", si: "දීප්තිමත් ප්‍රදේශ ප්‍රතිඵලයට වැඩිම බලපෑවේය.", ta: "பிரகாசமான பகுதிகள் முடிவை அதிகம் பாதித்தன." },
  "diagnose.healthy": { en: "Looks healthy", si: "සෞඛ්‍ය සම්පන්නව පෙනේ", ta: "ஆரோக்கியமாகத் தெரிகிறது" },
  "diagnose.lowConfidence": { en: "The model is not confident about this result. Treat it as a guess.", si: "මෙම ප්‍රතිඵලය ගැන ආකෘතියට විශ්වාසයක් නැත. එය අනුමානයක් ලෙස සලකන්න.", ta: "இந்த முடிவில் மாதிரிக்கு நம்பிக்கை குறைவு. இதை ஒரு ஊகமாகக் கருதுங்கள்." },
  "diagnose.disclaimer": { en: "This is an AI estimate, not a certain diagnosis. If you are unsure, ask an agricultural officer.", si: "මෙය AI ඇස්තමේන්තුවක් මිස නිශ්චිත රෝග විනිශ්චයක් නොවේ. ඔබට සැක නම්, කෘෂිකර්ම නිලධාරියෙකුගෙන් විමසන්න.", ta: "இது AI மதிப்பீடு மட்டுமே, உறுதியான நோய் கண்டறிதல் அல்ல. உறுதியாக இல்லையெனில் வேளாண் அலுவலரிடம் கேளுங்கள்." },
  "diagnose.heatmap": { en: "Heatmap", si: "තාප සිතියම", ta: "வெப்ப வரைபடம்" },
  "diagnose.organic": { en: "Organic treatment", si: "කාබනික ප්‍රතිකාර", ta: "இயற்கை சிகிச்சை" },
  "diagnose.chemical": { en: "Chemical treatment", si: "රසායනික ප්‍රතිකාර", ta: "இரசாயன சிகிச்சை" },
  "diagnose.prevention": { en: "Prevention", si: "වැළැක්වීම", ta: "தடுப்பு" },
  "diagnose.weather": { en: "Weather advisory", si: "කාලගුණ උපදෙස්", ta: "வானிலை அறிவுரை" },
  "diagnose.another": { en: "Diagnose another photo", si: "තවත් ඡායාරූපයක් විනිශ්චය කරන්න", ta: "மற்றொரு புகைப்படத்தைக் கண்டறியவும்" },
  "diagnose.viewHistory": { en: "View history", si: "ඉතිහාසය බලන්න", ta: "வரலாற்றைப் பார்க்கவும்" },
  "error.unsupportedType": { en: "Use a JPG, PNG or WebP image.", si: "JPG, PNG හෝ WebP රූපයක් භාවිත කරන්න.", ta: "JPG, PNG அல்லது WebP படத்தைப் பயன்படுத்தவும்." },
  "error.tooLarge": { en: "This image is larger than 10 MB. Try a smaller photo.", si: "මෙම රූපය 10 MB ට වඩා විශාලයි. කුඩා ඡායාරූපයක් උත්සාහ කරන්න.", ta: "இந்தப் படம் 10 MB ஐ விட பெரியது. சிறிய புகைப்படத்தை முயலவும்." },
  "error.diagnoseFailed": { en: "We couldn't complete the diagnosis. Please try again.", si: "අපට විනිශ්චය සම්පූර්ණ කළ නොහැකි විය. නැවත උත්සාහ කරන්න.", ta: "கண்டறிதலை முடிக்க முடியவில்லை. மீண்டும் முயலவும்." },
  "common.retry": { en: "Try again", si: "නැවත උත්සාහ කරන්න", ta: "மீண்டும் முயலவும்" },
  "dashboard.welcome": { en: "Hello, {name}", si: "ආයුබෝවන්, {name}", ta: "வணக்கம், {name}" },
  "dashboard.welcomeNoName": { en: "Welcome back", si: "නැවත සාදරයෙන් පිළිගනිමු", ta: "மீண்டும் வருக" },
  "dashboard.subtitle": { en: "What would you like to do today?", si: "අද ඔබට කුමක් කිරීමට අවශ්‍යද?", ta: "இன்று நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?" },
  "dashboard.action.diagnose.desc": { en: "Photograph a leaf, fruit or pest", si: "කොළයක්, පලතුරක් හෝ පළිබෝධයෙකු ඡායාරූපගත කරන්න", ta: "இலை, பழம் அல்லது பூச்சியைப் படம் எடுக்கவும்" },
  "dashboard.action.chat.desc": { en: "Ask a farming question", si: "ගොවිතැන ගැන ප්‍රශ්නයක් අසන්න", ta: "விவசாயம் குறித்த கேள்வியைக் கேளுங்கள்" },
  "dashboard.action.outbreaks.desc": { en: "See reports near you", si: "ඔබ අවට වාර්තා බලන්න", ta: "உங்களுக்கு அருகிலுள்ள அறிக்கைகளைப் பாருங்கள்" },
  "dashboard.action.history.desc": { en: "Review past diagnoses", si: "පසුගිය විනිශ්චය සමාලෝචනය කරන්න", ta: "முந்தைய கண்டறிதல்களைப் பாருங்கள்" },
  "dashboard.unread": { en: "Unread notifications: {n}", si: "නොකියවූ දැනුම්දීම්: {n}", ta: "படிக்காத அறிவிப்புகள்: {n}" },
  "dashboard.viewNotifications": { en: "View", si: "බලන්න", ta: "பார்க்க" },
  "dashboard.recent": { en: "Recent diagnoses", si: "මෑත විනිශ්චය", ta: "சமீபத்திய கண்டறிதல்கள்" },
  "dashboard.viewAll": { en: "View all", si: "සියල්ල බලන්න", ta: "அனைத்தையும் பார்க்க" },
  "dashboard.recentEmpty": { en: "No diagnoses yet. Your first one will show up here.", si: "තවමත් විනිශ්චයක් නැත. ඔබේ පළමු විනිශ්චය මෙහි පෙන්වයි.", ta: "இன்னும் கண்டறிதல்கள் இல்லை. உங்கள் முதல் கண்டறிதல் இங்கே தோன்றும்." },
  "dashboard.farms": { en: "Your farms", si: "ඔබේ ගොවිපළවල්", ta: "உங்கள் பண்ணைகள்" },
  "dashboard.addFarm": { en: "Add a farm", si: "ගොවිපළක් එක් කරන්න", ta: "பண்ணையைச் சேர்க்கவும்" },
  "dashboard.farmsEmpty": { en: "You haven't added a farm yet.", si: "ඔබ තවමත් ගොවිපළක් එක් කර නැත.", ta: "நீங்கள் இன்னும் பண்ணையைச் சேர்க்கவில்லை." },
  "dashboard.addFirstFarm": { en: "Add your first farm", si: "ඔබේ පළමු ගොවිපළ එක් කරන්න", ta: "உங்கள் முதல் பண்ணையைச் சேர்க்கவும்" },
  "dashboard.noDetails": { en: "No details yet", si: "තොරතුරු නැත", ta: "விவரங்கள் இல்லை" },
  "dashboard.loadFarmsFailed": { en: "Couldn't load your farms.", si: "ඔබේ ගොවිපළ පූරණය කළ නොහැකි විය.", ta: "உங்கள் பண்ணைகளை ஏற்ற முடியவில்லை." },
  "history.title": { en: "Your diagnosis history", si: "ඔබේ රෝග විනිශ්චය ඉතිහාසය", ta: "உங்கள் நோய் கண்டறிதல் வரலாறு" },
  "history.subtitle": { en: "Every photo you've diagnosed, newest first.", si: "ඔබ විනිශ්චය කළ සෑම ඡායාරූපයක්ම, අලුත්ම පළමුව.", ta: "நீங்கள் கண்டறிந்த ஒவ்வொரு புகைப்படமும், புதியவை முதலில்." },
  "history.filterLabel": { en: "Filter by type", si: "වර්ගය අනුව පෙරන්න", ta: "வகையின்படி வடிகட்டு" },
  "history.filter.all": { en: "All", si: "සියල්ල", ta: "அனைத்தும்" },
  "history.count": { en: "{n} results", si: "ප්‍රතිඵල {n}", ta: "{n} முடிவுகள்" },
  "history.empty": { en: "No diagnoses yet.", si: "තවමත් විනිශ්චයක් නැත.", ta: "இன்னும் கண்டறிதல்கள் இல்லை." },
  "history.emptyFiltered": { en: "No diagnoses of this type.", si: "මෙම වර්ගයේ විනිශ්චයක් නැත.", ta: "இந்த வகையில் கண்டறிதல்கள் இல்லை." },
  "history.first": { en: "Diagnose your first plant", si: "ඔබේ පළමු ශාකය විනිශ්චය කරන්න", ta: "உங்கள் முதல் தாவரத்தைக் கண்டறியவும்" },
  "history.showMore": { en: "Show more", si: "තවත් පෙන්වන්න", ta: "மேலும் காட்டு" },
  "history.loadFailed": { en: "Couldn't load your diagnoses.", si: "ඔබේ විනිශ්චය පූරණය කළ නොහැකි විය.", ta: "உங்கள் கண்டறிதல்களை ஏற்ற முடியவில்லை." },
  "history.confidenceShort": { en: "Confidence", si: "විශ්වාසය", ta: "நம்பிக்கை" },
  "nav.skip": { en: "Skip to content", si: "අන්තර්ගතයට පිවිසෙන්න", ta: "உள்ளடக்கத்திற்குச் செல்லவும்" },
  "nav.main": { en: "Main", si: "ප්‍රධාන", ta: "முதன்மை" },
  "nav.openMenu": { en: "Open menu", si: "මෙනුව විවෘත කරන්න", ta: "பட்டியலைத் திறக்கவும்" },
  "nav.closeMenu": { en: "Close menu", si: "මෙනුව වසන්න", ta: "பட்டியலை மூடவும்" },
  "nav.language": { en: "Language", si: "භාෂාව", ta: "மொழி" },
  "notifications.unreadLabel": { en: "Notifications, {n} unread", si: "දැනුම්දීම්, නොකියවූ {n}", ta: "அறிவிப்புகள், படிக்காதவை {n}" },
  "notifications.new": { en: "New", si: "අලුත්", ta: "புதியது" },
  "notifications.markRead": { en: "Mark as read", si: "කියවූ ලෙස සලකුණු කරන්න", ta: "படித்ததாகக் குறி" },
  "notifications.markFailed": { en: "Couldn't update this notification. Try again.", si: "මෙම දැනුම්දීම යාවත්කාලීන කළ නොහැකි විය. නැවත උත්සාහ කරන්න.", ta: "இந்த அறிவிப்பைப் புதுப்பிக்க முடியவில்லை. மீண்டும் முயலவும்." },
  "notifications.loadFailed": { en: "Couldn't load your notifications.", si: "ඔබේ දැනුම්දීම් පූරණය කළ නොහැකි විය.", ta: "உங்கள் அறிவிப்புகளை ஏற்ற முடியவில்லை." },
  "notifications.type.outbreak_alert": { en: "Outbreak alert", si: "ව්‍යාප්ති අනතුරු ඇඟවීම", ta: "பரவல் எச்சரிக்கை" },
  "review.colArea": { en: "Area", si: "ප්‍රදේශය", ta: "பகுதி" },
  "review.notesLabel": { en: "Notes for the farmer", si: "ගොවියා සඳහා සටහන්", ta: "விவசாயிக்கான குறிப்புகள்" },
  "review.verifiedToast": { en: "Marked as verified.", si: "සත්‍යාපිත ලෙස සලකුණු කළා.", ta: "சரிபார்க்கப்பட்டதாகக் குறிக்கப்பட்டது." },
  "review.verifyFailed": { en: "Couldn't save the review. Try again.", si: "සමාලෝචනය සුරැකිය නොහැකි විය. නැවත උත්සාහ කරන්න.", ta: "மதிப்பாய்வைச் சேமிக்க முடியவில்லை. மீண்டும் முயலவும்." },
  "review.loadFailed": { en: "Couldn't load review data.", si: "සමාලෝචන දත්ත පූරණය කළ නොහැකි විය.", ta: "மதிப்பாய்வுத் தரவை ஏற்ற முடியவில்லை." },
  "review.openImage": { en: "Open full-size photo", si: "සම්පූර්ණ ප්‍රමාණයේ ඡායාරූපය විවෘත කරන්න", ta: "முழு அளவு புகைப்படத்தைத் திறக்கவும்" },
  "outbreaks.farmLabel": { en: "Search around", si: "වටා සොයන්න", ta: "சுற்றி தேடு" },
  "outbreaks.radiusLabel": { en: "Distance", si: "දුර", ta: "தூரம்" },
  "outbreaks.radiusOption": { en: "Within {n} km", si: "කි.මී. {n} ඇතුළත", ta: "{n} கி.மீ. தொலைவுக்குள்" },
  "outbreaks.noLocationFarm": { en: " (no location set)", si: " (ස්ථානය නැත)", ta: " (இருப்பிடம் இல்லை)" },
  "outbreaks.needLocation": { en: "Add a farm location, or allow location access, to see reports near you.", si: "ඔබ අවට වාර්තා බැලීමට ගොවිපළ ස්ථානයක් එක් කරන්න, නැතහොත් ස්ථාන ප්‍රවේශයට ඉඩ දෙන්න.", ta: "உங்களுக்கு அருகிலுள்ள அறிக்கைகளைக் காண, பண்ணை இருப்பிடத்தைச் சேர்க்கவும் அல்லது இருப்பிட அணுகலை அனுமதிக்கவும்." },
  "outbreaks.addFarmLocation": { en: "Add a farm location", si: "ගොවිපළ ස්ථානයක් එක් කරන්න", ta: "பண்ணை இருப்பிடத்தைச் சேர்க்கவும்" },
  "outbreaks.loadFailed": { en: "Couldn't load the outbreak map.", si: "ව්‍යාප්ති සිතියම පූරණය කළ නොහැකි විය.", ta: "பரவல் வரைபடத்தை ஏற்ற முடியவில்லை." },
  "outbreaks.none": { en: "No nearby reports in this window.", si: "මෙම කාල සීමාව තුළ අවට වාර්තා නැත.", ta: "இந்தக் காலத்தில் அருகில் அறிக்கைகள் இல்லை." },
  "outbreaks.noneNote": { en: "This map only shows reports made by AgriSense users, so no reports does not mean no problem.", si: "මෙම සිතියමේ පෙන්වන්නේ AgriSense පරිශීලකයින් කළ වාර්තා පමණි, එබැවින් වාර්තා නොමැති වීමෙන් ගැටලුවක් නැති බව අදහස් නොවේ.", ta: "இந்த வரைபடம் AgriSense பயனர்கள் செய்த அறிக்கைகளை மட்டுமே காட்டுகிறது; எனவே அறிக்கைகள் இல்லை என்பது பிரச்சினை இல்லை என்று பொருள் அல்ல." },
  "outbreaks.count": { en: "Nearby hotspots: {n}", si: "අවට උණුසුම් ස්ථාන: {n}", ta: "அருகிலுள்ள பரவல் இடங்கள்: {n}" },
  "outbreaks.away": { en: "{n} km away", si: "කි.මී. {n} දුරින්", ta: "{n} கி.மீ. தொலைவில்" },
  "outbreaks.reporters": { en: "Farmer reports: {n} · last seen {date}", si: "ගොවි වාර්තා: {n} · අවසන් වරට දක්නට ලැබුණේ {date}", ta: "விவசாயி அறிக்கைகள்: {n} · கடைசியாகக் காணப்பட்டது {date}" },
  "outbreaks.mapLabel": { en: "Map of nearby outbreak reports", si: "අවට ව්‍යාප්ති වාර්තා සිතියම", ta: "அருகிலுள்ள பரவல் அறிக்கைகளின் வரைபடம்" },
  "outbreaks.legend": { en: "Legend", si: "සිතියම් සංකේත", ta: "குறிவிளக்கம்" },
  "outbreaks.legend.you": { en: "Your farm / search centre", si: "ඔබේ ගොවිපළ / සෙවුම් මධ්‍යස්ථානය", ta: "உங்கள் பண்ணை / தேடல் மையம்" },
  "outbreaks.legend.disease": { en: "Disease report", si: "රෝග වාර්තාව", ta: "நோய் அறிக்கை" },
  "outbreaks.legend.pest": { en: "Pest report", si: "පළිබෝධ වාර්තාව", ta: "பூச்சி அறிக்கை" },
  "outbreaks.severityLabel": { en: "Severity", si: "බරපතලකම", ta: "தீவிரம்" },
  "farm.titleEdit": { en: "Edit farm", si: "ගොවිපළ සංස්කරණය කරන්න", ta: "பண்ணையைத் திருத்து" },
  "farm.addAnother": { en: "Add another farm", si: "තවත් ගොවිපළක් එක් කරන්න", ta: "மற்றொரு பண்ணையைச் சேர்க்கவும்" },
  "farm.name": { en: "Farm name", si: "ගොවිපළේ නම", ta: "பண்ணையின் பெயர்" },
  "farm.namePh": { en: "e.g. Kandy home garden", si: "උදා: මහනුවර ගෙවත්ත", ta: "எ.கா. கண்டி வீட்டுத் தோட்டம்" },
  "farm.type": { en: "Farm type", si: "ගොවිපළ වර්ගය", ta: "பண்ணை வகை" },
  "farm.typePh": { en: "e.g. Paddy, home garden", si: "උදා: වී, ගෙවත්ත", ta: "எ.கா. நெல், வீட்டுத் தோட்டம்" },
  "farm.size": { en: "Land size (ha)", si: "ඉඩම් ප්‍රමාණය (හෙක්ටයාර)", ta: "நிலப் பரப்பு (ஹெக்டேர்)" },
  "farm.sizePh": { en: "e.g. 0.5", si: "උදා: 0.5", ta: "எ.கா. 0.5" },
  "farm.crops": { en: "Main crops", si: "ප්‍රධාන බෝග", ta: "முக்கிய பயிர்கள்" },
  "farm.cropsPh": { en: "e.g. Rice, tomato, chilli", si: "උදා: සහල්, තක්කාලි, මිරිස්", ta: "எ.கா. நெல், தக்காளி, மிளகாய்" },
  "farm.region": { en: "Region / district", si: "කලාපය / දිස්ත්‍රික්කය", ta: "பகுதி / மாவட்டம்" },
  "farm.regionPh": { en: "e.g. Central Province", si: "උදා: මධ්‍යම පළාත", ta: "எ.கா. மத்திய மாகாணம்" },
  "farm.address": { en: "Address", si: "ලිපිනය", ta: "முகவரி" },
  "farm.addressPh": { en: "Street / village", si: "වීදිය / ගම", ta: "தெரு / கிராமம்" },
  "farm.location": { en: "Exact location", si: "නිශ්චිත ස්ථානය", ta: "சரியான இருப்பிடம்" },
  "farm.save": { en: "Save changes", si: "වෙනස්කම් සුරකින්න", ta: "மாற்றங்களைச் சேமி" },
  "farm.create": { en: "Save farm", si: "ගොවිපළ සුරකින්න", ta: "பண்ணையைச் சேமி" },
  "farm.saving": { en: "Saving…", si: "සුරකිමින්…", ta: "சேமிக்கிறது…" },
  "farm.saved": { en: "Farm saved.", si: "ගොවිපළ සුරැකිණි.", ta: "பண்ணை சேமிக்கப்பட்டது." },
  "farm.saveFailed": { en: "Couldn't save your farm. Please try again.", si: "ඔබේ ගොවිපළ සුරැකිය නොහැකි විය. නැවත උත්සාහ කරන්න.", ta: "உங்கள் பண்ணையைச் சேமிக்க முடியவில்லை. மீண்டும் முயலவும்." },
  "farm.loadFailed": { en: "Couldn't load this farm.", si: "මෙම ගොවිපළ පූරණය කළ නොහැකි විය.", ta: "இந்தப் பண்ணையை ஏற்ற முடியவில்லை." },
  "farm.addPhoto": { en: "Add a photo", si: "ඡායාරූපයක් එක් කරන්න", ta: "புகைப்படத்தைச் சேர்க்கவும்" },
  "farm.changePhoto": { en: "Change photo", si: "ඡායාරූපය වෙනස් කරන්න", ta: "புகைப்படத்தை மாற்று" },
  "farm.uploading": { en: "Uploading…", si: "උඩුගත කරමින්…", ta: "பதிவேற்றுகிறது…" },
  "farm.photoFailed": { en: "Couldn't upload the photo. Please try again.", si: "ඡායාරූපය උඩුගත කළ නොහැකි විය. නැවත උත්සාහ කරන්න.", ta: "புகைப்படத்தைப் பதிவேற்ற முடியவில்லை. மீண்டும் முயலவும்." },
  "farm.photoUpdated": { en: "Photo updated.", si: "ඡායාරූපය යාවත්කාලීන කළා.", ta: "புகைப்படம் புதுப்பிக்கப்பட்டது." },
  "farm.notSet": { en: "Not set", si: "සකසා නැත", ta: "அமைக்கப்படவில்லை" },
  "farm.lastUpdated": { en: "Last updated", si: "අවසන් යාවත්කාලීනය", ta: "கடைசியாகப் புதுப்பித்தது" },
  "farm.err.name": { en: "Enter a farm name", si: "ගොවිපළේ නමක් ඇතුළත් කරන්න", ta: "பண்ணையின் பெயரை உள்ளிடவும்" },
  "farm.err.size": { en: "Land size can't be negative", si: "ඉඩම් ප්‍රමාණය සෘණ විය නොහැක", ta: "நிலப் பரப்பு எதிர்மறையாக இருக்கக்கூடாது" },
  "farm.err.coords": { en: "Latitude must be between -90 and 90, and longitude between -180 and 180.", si: "අක්ෂාංශ -90 සහ 90 අතර, දේශාංශ -180 සහ 180 අතර විය යුතුය.", ta: "அட்சரேகை -90 முதல் 90 வரையிலும், தீர்க்கரேகை -180 முதல் 180 வரையிலும் இருக்க வேண்டும்." },
  "farm.listEmpty": { en: "No farms yet. Add your first one above.", si: "තවමත් ගොවිපළවල් නැත. ඔබේ පළමු ගොවිපළ ඉහත එක් කරන්න.", ta: "இன்னும் பண்ணைகள் இல்லை. உங்கள் முதல் பண்ணையை மேலே சேர்க்கவும்." },
  "picker.useMyLocation": { en: "Use my location", si: "මගේ ස්ථානය භාවිත කරන්න", ta: "எனது இருப்பிடத்தைப் பயன்படுத்து" },
  "picker.locating": { en: "Locating…", si: "ස්ථානය සොයමින්…", ta: "இருப்பிடத்தைக் கண்டறிகிறது…" },
  "picker.src.gps": { en: "From device GPS", si: "උපාංගයේ GPS වෙතින්", ta: "சாதன GPS இலிருந்து" },
  "picker.src.geocoded": { en: "Approximate (from address)", si: "ආසන්න (ලිපිනයෙන්)", ta: "தோராயமானது (முகவரியிலிருந்து)" },
  "picker.src.manual": { en: "Manually placed", si: "අතින් තැබූ", ta: "கைமுறையாக வைக்கப்பட்டது" },
  "picker.latitude": { en: "Latitude", si: "අක්ෂාංශය", ta: "அட்சரேகை" },
  "picker.longitude": { en: "Longitude", si: "දේශාංශය", ta: "தீர்க்கரேகை" },
  "picker.help": { en: "Click the map, drag the pin, type coordinates directly, or use your device's GPS.", si: "සිතියම ක්ලික් කරන්න, පින් එක ඇදගෙන යන්න, ඛණ්ඩාංක කෙලින්ම ටයිප් කරන්න, නැතහොත් උපාංගයේ GPS භාවිත කරන්න.", ta: "வரைபடத்தில் கிளிக் செய்யவும், குறிப்பானை இழுக்கவும், ஆயத்தொலைவுகளை நேரடியாக உள்ளிடவும் அல்லது சாதன GPS ஐப் பயன்படுத்தவும்." },
  "picker.noGeo": { en: "Location isn't available in this browser.", si: "මෙම බ්‍රවුසරයේ ස්ථානය ලබා ගත නොහැක.", ta: "இந்த உலாவியில் இருப்பிடம் கிடைக்கவில்லை." },
  "picker.denied": { en: "Location permission was denied. Place the pin manually instead.", si: "ස්ථාන අවසරය ප්‍රතික්ෂේප විය. ඒ වෙනුවට පින් එක අතින් තබන්න.", ta: "இருப்பிட அனுமதி மறுக்கப்பட்டது. அதற்குப் பதிலாக குறிப்பானைக் கைமுறையாக வைக்கவும்." },
  "picker.failed": { en: "Couldn't get your location. Place the pin manually instead.", si: "ඔබේ ස්ථානය ලබා ගත නොහැකි විය. ඒ වෙනුවට පින් එක අතින් තබන්න.", ta: "உங்கள் இருப்பிடத்தைப் பெற முடியவில்லை. அதற்குப் பதிலாக குறிப்பானைக் கைமுறையாக வைக்கவும்." },
  "picker.mapLabel": { en: "Map: click to place your farm's pin", si: "සිතියම: ඔබේ ගොවිපළේ පින් එක තැබීමට ක්ලික් කරන්න", ta: "வரைபடம்: உங்கள் பண்ணையின் குறிப்பானை வைக்க கிளிக் செய்யவும்" },
  "chat.subtitle": { en: "Ask about crop issues, irrigation or fertilizer. The assistant knows your farm and recent diagnoses.", si: "බෝග ගැටලු, වාරිමාර්ග හෝ පොහොර ගැන අසන්න. සහායකයා ඔබේ ගොවිපළ සහ මෑත විනිශ්චය දනී.", ta: "பயிர் பிரச்சினைகள், நீர்ப்பாசனம் அல்லது உரம் பற்றிக் கேளுங்கள். உதவியாளருக்கு உங்கள் பண்ணையும் சமீபத்திய கண்டறிதல்களும் தெரியும்." },
  "chat.examplesLabel": { en: "Try asking:", si: "මෙසේ අසා බලන්න:", ta: "இப்படிக் கேட்டுப் பாருங்கள்:" },
  "chat.example.1": { en: "My tomato leaves are curling. What should I do?", si: "මගේ තක්කාලි කොළ රැලි වෙනවා. මම කුමක් කළ යුතුද?", ta: "என் தக்காளி இலைகள் சுருளுகின்றன. நான் என்ன செய்ய வேண்டும்?" },
  "chat.example.2": { en: "How often should I water chilli plants?", si: "මිරිස් ගස්වලට කොපමණ වාරයක් වතුර දැමිය යුතුද?", ta: "மிளகாய்ச் செடிகளுக்கு எத்தனை முறை நீர் ஊற்ற வேண்டும்?" },
  "chat.example.3": { en: "Which fertilizer is best for rice?", si: "වී වගාවට වඩාත්ම සුදුසු පොහොර මොනවාද?", ta: "நெல்லுக்கு எந்த உரம் சிறந்தது?" },
  "chat.you": { en: "You", si: "ඔබ", ta: "நீங்கள்" },
  "chat.assistant": { en: "Assistant", si: "සහායක", ta: "உதவியாளர்" },
  "chat.thinking": { en: "The assistant is typing…", si: "සහායක ටයිප් කරමින් සිටී…", ta: "உதவியாளர் தட்டச்சு செய்கிறார்…" },
  "chat.unavailable": { en: "The assistant is temporarily unavailable. Please try again shortly.", si: "සහායක තාවකාලිකව ලබා ගත නොහැක. මද වේලාවකින් නැවත උත්සාහ කරන්න.", ta: "உதவியாளர் தற்காலிகமாகக் கிடைக்கவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயலவும்." },
  "chat.new": { en: "New conversation", si: "නව සංවාදයක්", ta: "புதிய உரையாடல்" },
  "chat.newConfirm": { en: "Clear this conversation from this device and start a new one?", si: "මෙම උපාංගයෙන් මෙම සංවාදය ඉවත් කර නව එකක් ආරම්භ කරන්නද?", ta: "இந்தச் சாதனத்திலிருந்து இந்த உரையாடலை நீக்கிப் புதியதைத் தொடங்கவா?" },
  "chat.disclaimer": { en: "AI answers can be wrong. For serious crop losses, ask an agricultural officer.", si: "AI පිළිතුරු වැරදි විය හැක. බරපතල බෝග හානි සඳහා කෘෂිකර්ම නිලධාරියෙකුගෙන් විමසන්න.", ta: "AI பதில்கள் தவறாக இருக்கலாம். பெரிய பயிர் இழப்புகளுக்கு வேளாண் அலுவலரிடம் கேளுங்கள்." },
  "contact.title": { en: "Contact AgriSense AI", si: "AgriSense AI අමතන්න", ta: "AgriSense AI ஐத் தொடர்பு கொள்ளவும்" },
  "contact.blurb": { en: "AgriSense AI helps smallholder farmers diagnose crop diseases and pests, track outbreaks nearby, and get farm-specific guidance, in English, Sinhala and Tamil.", si: "AgriSense AI කුඩා ගොවීන්ට බෝග රෝග සහ පළිබෝධ හඳුනාගැනීමට, අවට ව්‍යාප්ති නිරීක්ෂණය කිරීමට සහ ගොවිපළට විශේෂිත මග පෙන්වීමක් ලබාගැනීමට උපකාර කරයි, ඉංග්‍රීසි, සිංහල සහ දෙමළ භාෂාවලින්.", ta: "AgriSense AI சிறு விவசாயிகள் பயிர் நோய்களையும் பூச்சிகளையும் கண்டறியவும், அருகிலுள்ள பரவல்களைக் கண்காணிக்கவும், தங்கள் பண்ணைக்கேற்ற வழிகாட்டலைப் பெறவும் உதவுகிறது, ஆங்கிலம், சிங்களம், தமிழ் மொழிகளில்." },
  "contact.direct": { en: "Reach us directly", si: "අපව කෙලින්ම අමතන්න", ta: "எங்களை நேரடியாகத் தொடர்பு கொள்ளவும்" },
  "contact.email": { en: "Email", si: "විද්‍යුත් තැපෑල", ta: "மின்னஞ்சல்" },
  "contact.name": { en: "Name", si: "නම", ta: "பெயர்" },
  "contact.subject": { en: "Subject", si: "මාතෘකාව", ta: "தலைப்பு" },
  "contact.message": { en: "Message", si: "පණිවිඩය", ta: "செய்தி" },
  "contact.send": { en: "Send message", si: "පණිවිඩය යවන්න", ta: "செய்தியை அனுப்பு" },
  "contact.sending": { en: "Sending…", si: "යවමින්…", ta: "அனுப்புகிறது…" },
  "contact.err.name": { en: "Please enter your name.", si: "ඔබේ නම ඇතුළත් කරන්න.", ta: "உங்கள் பெயரை உள்ளிடவும்." },
  "contact.err.subject": { en: "Please enter a subject.", si: "මාතෘකාවක් ඇතුළත් කරන්න.", ta: "தலைப்பை உள்ளிடவும்." },
  "contact.err.message": { en: "Please write a few more words so we understand your message.", si: "අපට ඔබේ පණිවිඩය තේරුම් ගැනීමට තව වචන කිහිපයක් ලියන්න.", ta: "உங்கள் செய்தியைப் புரிந்துகொள்ள இன்னும் சில வார்த்தைகளை எழுதவும்." },
  "contact.sent": { en: "Thanks, your message has been sent. We'll get back to you soon.", si: "ස්තූතියි, ඔබේ පණිවිඩය යවා ඇත. අපි ඉක්මනින් ඔබ වෙත ආපසු පැමිණෙන්නෙමු.", ta: "நன்றி, உங்கள் செய்தி அனுப்பப்பட்டது. விரைவில் உங்களைத் தொடர்பு கொள்வோம்." },
  "contact.failed": { en: "Couldn't send your message. Please try again.", si: "ඔබේ පණිවිඩය යැවිය නොහැකි විය. නැවත උත්සාහ කරන්න.", ta: "உங்கள் செய்தியை அனுப்ப முடியவில்லை. மீண்டும் முயலவும்." },
  "footer.about": { en: "AI-powered crop diagnosis and outbreak alerts for smallholder farmers in Sri Lanka.", si: "ශ්‍රී ලංකාවේ කුඩා ගොවීන් සඳහා AI බලයෙන් ක්‍රියාත්මක බෝග රෝග විනිශ්චය සහ ව්‍යාප්ති ඇඟවීම්.", ta: "இலங்கையின் சிறு விவசாயிகளுக்கான AI அடிப்படையிலான பயிர் நோய் கண்டறிதலும் பரவல் எச்சரிக்கைகளும்." },
  "footer.navigate": { en: "Navigate", si: "සංචාලනය", ta: "வழிசெலுத்தல்" },
  "footer.support": { en: "Support", si: "සහාය", ta: "ஆதரவு" },
  "footer.contact": { en: "Contact us", si: "අපව අමතන්න", ta: "தொடர்புகொள்ள" },
  "footer.rights": { en: "All rights reserved.", si: "සියලුම හිමිකම් ඇවිරිණි.", ta: "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை." },
  "footer.mapData": { en: "Map data © OpenStreetMap contributors", si: "සිතියම් දත්ත © OpenStreetMap දායකයින්", ta: "வரைபடத் தரவு © OpenStreetMap பங்களிப்பாளர்கள்" },
  "home.badge": { en: "AI crop diagnosis for Sri Lankan farmers", si: "ශ්‍රී ලාංකික ගොවීන් සඳහා AI බෝග රෝග විනිශ්චය", ta: "இலங்கை விவசாயிகளுக்கான AI பயிர் நோய் கண்டறிதல்" },
  "home.tagline": { en: "Your intelligent farming assistant", si: "ඔබේ ඥානවන්ත ගොවිතැන් සහායකයා", ta: "உங்கள் புத்திசாலித்தனமான விவசாய உதவியாளர்" },
  "home.lead": { en: "Photograph a leaf, fruit, stem or pest and get a diagnosis with treatment guidance, in English, Sinhala or Tamil.", si: "කොළයක්, පලතුරක්, කඳක් හෝ පළිබෝධයෙකු ඡායාරූපගත කර, ඉංග්‍රීසි, සිංහල හෝ දෙමළ භාෂාවෙන් ප්‍රතිකාර මග පෙන්වීම සහිත රෝග විනිශ්චයක් ලබාගන්න.", ta: "இலை, பழம், தண்டு அல்லது பூச்சியைப் படம் எடுத்து, ஆங்கிலம், சிங்களம் அல்லது தமிழில் சிகிச்சை வழிகாட்டலுடன் கூடிய கண்டறிதலைப் பெறுங்கள்." },
  "home.cta.diagnose": { en: "Diagnose a plant", si: "ශාකයක් විනිශ්චය කරන්න", ta: "தாவரத்தைக் கண்டறியவும்" },
  "home.cta.dashboard": { en: "Go to my dashboard", si: "මගේ උපකරණ පුවරුවට යන්න", ta: "எனது டாஷ்போர்டுக்குச் செல்லவும்" },
  "home.cta.start": { en: "Get started", si: "ආරම්භ කරන්න", ta: "தொடங்குங்கள்" },
  "home.cta.login": { en: "I already have an account", si: "මට දැනටමත් ගිණුමක් ඇත", ta: "எனக்கு ஏற்கனவே கணக்கு உள்ளது" },
  "home.signupNote": { en: "Create an account to save your farms and diagnosis history.", si: "ඔබේ ගොවිපළ සහ විනිශ්චය ඉතිහාසය සුරැකීමට ගිණුමක් සාදන්න.", ta: "உங்கள் பண்ணைகளையும் கண்டறிதல் வரலாற்றையும் சேமிக்க கணக்கை உருவாக்குங்கள்." },
  "home.how": { en: "How it works", si: "ක්‍රියා කරන ආකාරය", ta: "இது எவ்வாறு செயல்படுகிறது" },
  "home.step": { en: "Step {n}", si: "පියවර {n}", ta: "படி {n}" },
  "home.step1.title": { en: "Photograph", si: "ඡායාරූපගත කරන්න", ta: "படம் எடுக்கவும்" },
  "home.step1.desc": { en: "Take a clear, close-up photo of a leaf, fruit, stem or pest with your phone.", si: "ඔබේ දුරකථනයෙන් කොළයක්, පලතුරක්, කඳක් හෝ පළිබෝධයෙකුගේ පැහැදිලි සමීප ඡායාරූපයක් ගන්න.", ta: "உங்கள் தொலைபேசியில் இலை, பழம், தண்டு அல்லது பூச்சியின் தெளிவான நெருக்கமான புகைப்படத்தை எடுக்கவும்." },
  "home.step2.title": { en: "Diagnose", si: "විනිශ්චය කරන්න", ta: "கண்டறியவும்" },
  "home.step2.desc": { en: "AgriSense names the likely disease or pest and shows its confidence and severity.", si: "AgriSense සිදුවිය හැකි රෝගය හෝ පළිබෝධය නම් කර එහි විශ්වාසය සහ බරපතලකම පෙන්වයි.", ta: "AgriSense சாத்தியமான நோய் அல்லது பூச்சியைப் பெயரிட்டு அதன் நம்பிக்கையையும் தீவிரத்தையும் காட்டுகிறது." },
  "home.step3.title": { en: "Treat", si: "ප්‍රතිකාර කරන්න", ta: "சிகிச்சையளிக்கவும்" },
  "home.step3.desc": { en: "Get organic and chemical treatment options and prevention tips, plus weather advice when available.", si: "කාබනික සහ රසායනික ප්‍රතිකාර විකල්ප, වැළැක්වීමේ උපදෙස්, සහ ලබා ගත හැකි විට කාලගුණ උපදෙස් ලබාගන්න.", ta: "இயற்கை மற்றும் இரசாயன சிகிச்சை விருப்பங்கள், தடுப்பு குறிப்புகள், கிடைக்கும் போது வானிலை அறிவுரை ஆகியவற்றைப் பெறுங்கள்." },
  "home.features": { en: "What AgriSense can do", si: "AgriSense ට කළ හැක්කේ", ta: "AgriSense என்ன செய்ய முடியும்" },
  "home.f1.title": { en: "Disease and pest detection", si: "රෝග සහ පළිබෝධ හඳුනාගැනීම", ta: "நோய் மற்றும் பூச்சி கண்டறிதல்" },
  "home.f1.desc": { en: "Identify crop diseases and pests from a photo, or find out which plant you are looking at.", si: "ඡායාරූපයකින් බෝග රෝග සහ පළිබෝධ හඳුනාගන්න, නැතහොත් ඔබ බලන්නේ කුමන ශාකයදැයි සොයා ගන්න.", ta: "புகைப்படத்திலிருந்து பயிர் நோய்களையும் பூச்சிகளையும் அடையாளம் காணுங்கள், அல்லது நீங்கள் பார்ப்பது எந்தத் தாவரம் என்பதைக் கண்டறியுங்கள்." },
  "home.f2.title": { en: "Treatment guidance", si: "ප්‍රතිකාර මග පෙන්වීම", ta: "சிகிச்சை வழிகாட்டல்" },
  "home.f2.desc": { en: "Organic and chemical options and prevention tips with each result.", si: "එක් එක් ප්‍රතිඵලය සමඟ කාබනික සහ රසායනික විකල්ප සහ වැළැක්වීමේ උපදෙස්.", ta: "ஒவ்வொரு முடிவுடனும் இயற்கை, இரசாயன விருப்பங்களும் தடுப்பு குறிப்புகளும்." },
  "home.f3.desc": { en: "See high-confidence reports from other farmers near you in the last 30 days.", si: "පසුගිය දින 30 තුළ ඔබ අවට අනෙක් ගොවීන්ගේ ඉහළ විශ්වාසයකින් යුත් වාර්තා බලන්න.", ta: "கடந்த 30 நாட்களில் உங்களுக்கு அருகிலுள்ள மற்ற விவசாயிகளின் அதிக நம்பிக்கை கொண்ட அறிக்கைகளைப் பாருங்கள்." },
  "home.f4.desc": { en: "Ask farming questions. The assistant knows your farm and recent diagnoses.", si: "ගොවිතැන ගැන ප්‍රශ්න අසන්න. සහායකයා ඔබේ ගොවිපළ සහ මෑත විනිශ්චය දනී.", ta: "விவசாயம் குறித்த கேள்விகளைக் கேளுங்கள். உதவியாளருக்கு உங்கள் பண்ணையும் சமீபத்திய கண்டறிதல்களும் தெரியும்." },
  "home.f5.title": { en: "Works with poor signal", si: "දුර්වල සංඥාවකදීත් ක්‍රියා කරයි", ta: "பலவீனமான சிக்னலிலும் செயல்படும்" },
  "home.f5.desc": { en: "Photos taken offline are saved on your device and sent when you are back online.", si: "සබැඳි නොවූ විට ගත් ඡායාරූප ඔබේ උපාංගයේ සුරැකී, නැවත සබැඳි වූ විට යැවේ.", ta: "இணைப்பின்றி எடுத்த புகைப்படங்கள் உங்கள் சாதனத்தில் சேமிக்கப்பட்டு, மீண்டும் இணைந்ததும் அனுப்பப்படும்." },
  "home.f6.title": { en: "English, Sinhala, Tamil", si: "ඉංග්‍රීසි, සිංහල, දෙමළ", ta: "ஆங்கிலம், சிங்களம், தமிழ்" },
  "home.f6.desc": { en: "Switch language at any time. Your choice is saved to your account.", si: "ඕනෑම වේලාවක භාෂාව මාරු කරන්න. ඔබේ තේරීම ඔබේ ගිණුමේ සුරැකේ.", ta: "எப்போது வேண்டுமானாலும் மொழியை மாற்றலாம். உங்கள் தேர்வு கணக்கில் சேமிக்கப்படும்." },
  "home.who": { en: "Who it's for", si: "මෙය කා සඳහාද", ta: "இது யாருக்காக" },
  "home.who.farmers": { en: "Farmers", si: "ගොවීන්", ta: "விவசாயிகள்" },
  "home.who.farmers.desc": { en: "Diagnose problems, get treatment advice, follow outbreaks near you and keep your farms in one place.", si: "ගැටලු විනිශ්චය කරන්න, ප්‍රතිකාර උපදෙස් ලබාගන්න, අවට ව්‍යාප්ති අනුගමනය කරන්න, ඔබේ ගොවිපළ එක තැනක තබාගන්න.", ta: "பிரச்சினைகளைக் கண்டறியுங்கள், சிகிச்சை ஆலோசனை பெறுங்கள், அருகிலுள்ள பரவல்களைப் பின்தொடருங்கள், உங்கள் பண்ணைகளை ஒரே இடத்தில் வைத்திருங்கள்." },
  "home.who.officers.desc": { en: "Review diagnoses that need an expert check, add notes for the farmer and see area summaries.", si: "විශේෂඥ පරීක්ෂාවක් අවශ්‍ය විනිශ්චය සමාලෝචනය කරන්න, ගොවියා සඳහා සටහන් එක් කරන්න, ප්‍රදේශ සාරාංශ බලන්න.", ta: "நிபுணர் சரிபார்ப்பு தேவைப்படும் கண்டறிதல்களை மதிப்பாய்வு செய்யுங்கள், விவசாயிக்கான குறிப்புகளைச் சேர்க்கவும், பகுதி சுருக்கங்களைப் பாருங்கள்." },

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