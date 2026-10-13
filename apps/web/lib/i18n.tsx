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