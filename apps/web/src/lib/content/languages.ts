export interface LanguagePage {
  slug: string
  code: string
  label: string
  native: string
  indian: boolean
  voices: { name: string; gender: "Female" | "Male"; accent?: string }[]
  /** One specific sentence about listening in this language. */
  angle: string
  sample: string
}

export const LANGUAGE_PAGES: LanguagePage[] = [
  {
    slug: "english",
    code: "en",
    label: "English",
    native: "English",
    indian: false,
    voices: [
      { name: "Ava", gender: "Female", accent: "US" },
      { name: "Andrew", gender: "Male", accent: "US" },
      { name: "Emma", gender: "Female", accent: "US" },
      { name: "Brian", gender: "Male", accent: "US" },
      { name: "Sonia", gender: "Female", accent: "UK" },
      { name: "Ryan", gender: "Male", accent: "UK" },
      { name: "Neerja", gender: "Female", accent: "India" },
      { name: "Prabhat", gender: "Male", accent: "India" },
      { name: "Natasha", gender: "Female", accent: "Australia" },
    ],
    angle: "Choose US, UK, Indian or Australian accents, whichever is easiest for you to follow at high speed.",
    sample: "Hi, I am your HearMeOut narrator. Let's turn your reading into listening.",
  },
  {
    slug: "hindi",
    code: "hi",
    label: "Hindi",
    native: "हिन्दी",
    indian: true,
    voices: [
      { name: "Swara", gender: "Female" },
      { name: "Madhur", gender: "Male" },
    ],
    angle: "Upload Hindi PDFs and HearMeOut picks a Hindi voice automatically, or use Explain mode to hear English material taught in Hindi.",
    sample: "नमस्ते, मैं आपका हियर-मी-आउट वाचक हूँ। चलिए, आपकी पढ़ाई को सुनने में बदलते हैं।",
  },
  {
    slug: "hinglish",
    code: "hinglish",
    label: "Hinglish",
    native: "Hinglish",
    indian: true,
    voices: [
      { name: "Neerja", gender: "Female", accent: "Indian English" },
      { name: "Prabhat", gender: "Male", accent: "Indian English" },
    ],
    angle: "Hinglish mixes Hindi and English the way people actually talk. Explain mode writes it in Roman letters and reads it with an Indian-English voice, keeping technical terms in English.",
    sample: "Namaste, main aapka HearMeOut narrator hoon. Chaliye, aapki padhai ko sunne mein badalte hain.",
  },
  {
    slug: "marathi",
    code: "mr",
    label: "Marathi",
    native: "मराठी",
    indian: true,
    voices: [
      { name: "Aarohi", gender: "Female" },
      { name: "Manohar", gender: "Male" },
    ],
    angle: "Hear Marathi documents read naturally, or get English material explained in Marathi.",
    sample: "नमस्कार, मी तुमचा हिअर-मी-आउट निवेदक आहे. चला, तुमचा अभ्यास ऐकण्यात बदलूया.",
  },
  {
    slug: "tamil",
    code: "ta",
    label: "Tamil",
    native: "தமிழ்",
    indian: true,
    voices: [
      { name: "Pallavi", gender: "Female" },
      { name: "Valluvar", gender: "Male" },
    ],
    angle: "Listen to Tamil text with a natural voice, or learn English notes in Tamil.",
    sample: "வணக்கம், நான் உங்கள் ஹியர்-மீ-அவுட் கதைசொல்லி.",
  },
  {
    slug: "telugu",
    code: "te",
    label: "Telugu",
    native: "తెలుగు",
    indian: true,
    voices: [
      { name: "Shruti", gender: "Female" },
      { name: "Mohan", gender: "Male" },
    ],
    angle: "Natural Telugu narration for your documents and explanations.",
    sample: "నమస్కారం, నేను మీ హియర్-మీ-అవుట్ వ్యాఖ్యాతను.",
  },
  {
    slug: "bengali",
    code: "bn",
    label: "Bengali",
    native: "বাংলা",
    indian: true,
    voices: [
      { name: "Tanishaa", gender: "Female" },
      { name: "Bashkar", gender: "Male" },
    ],
    angle: "Listen to Bengali text or study English material explained in Bengali.",
    sample: "নমস্কার, আমি আপনার হিয়ার-মি-আউট কথক।",
  },
  {
    slug: "gujarati",
    code: "gu",
    label: "Gujarati",
    native: "ગુજરાતી",
    indian: true,
    voices: [
      { name: "Dhwani", gender: "Female" },
      { name: "Niranjan", gender: "Male" },
    ],
    angle: "Gujarati narration for documents, notes and explanations.",
    sample: "નમસ્તે, હું તમારો હિયર-મી-આઉટ વાચક છું.",
  },
  {
    slug: "kannada",
    code: "kn",
    label: "Kannada",
    native: "ಕನ್ನಡ",
    indian: true,
    voices: [
      { name: "Sapna", gender: "Female" },
      { name: "Gagan", gender: "Male" },
    ],
    angle: "Kannada voices for reading documents aloud and for plain-language explanations.",
    sample: "ನಮಸ್ಕಾರ, ನಾನು ನಿಮ್ಮ ಹಿಯರ್-ಮಿ-ಔಟ್ ನಿರೂಪಕ.",
  },
  {
    slug: "malayalam",
    code: "ml",
    label: "Malayalam",
    native: "മലയാളം",
    indian: true,
    voices: [
      { name: "Sobhana", gender: "Female" },
      { name: "Midhun", gender: "Male" },
    ],
    angle: "Malayalam narration and explanations for your study material.",
    sample: "നമസ്കാരം, ഞാൻ നിങ്ങളുടെ ഹിയർ-മി-ഔട്ട് അവതാരകനാണ്.",
  },
  {
    slug: "urdu",
    code: "ur",
    label: "Urdu",
    native: "اردو",
    indian: true,
    voices: [
      { name: "Gul", gender: "Female" },
      { name: "Salman", gender: "Male" },
    ],
    angle: "Listen to Urdu text with natural voices.",
    sample: "السلام علیکم، میں آپ کا ہیئر می آؤٹ راوی ہوں۔",
  },
  { slug: "spanish", code: "es", label: "Spanish", native: "Español", indian: false, voices: [{ name: "Elvira", gender: "Female", accent: "Spain" }, { name: "Alvaro", gender: "Male", accent: "Spain" }, { name: "Dalia", gender: "Female", accent: "Mexico" }, { name: "Jorge", gender: "Male", accent: "Mexico" }], angle: "Spanish voices from Spain and Mexico.", sample: "Hola, soy tu narrador de HearMeOut." },
  { slug: "french", code: "fr", label: "French", native: "Français", indian: false, voices: [{ name: "Denise", gender: "Female" }, { name: "Henri", gender: "Male" }], angle: "Natural French narration for documents.", sample: "Bonjour, je suis votre narrateur HearMeOut." },
  { slug: "german", code: "de", label: "German", native: "Deutsch", indian: false, voices: [{ name: "Katja", gender: "Female" }, { name: "Conrad", gender: "Male" }], angle: "Clear German voices for long texts.", sample: "Hallo, ich bin dein HearMeOut-Sprecher." },
  { slug: "portuguese", code: "pt", label: "Portuguese", native: "Português", indian: false, voices: [{ name: "Francisca", gender: "Female", accent: "Brazil" }, { name: "Antonio", gender: "Male", accent: "Brazil" }], angle: "Brazilian Portuguese narration.", sample: "Olá, sou o seu narrador HearMeOut." },
  { slug: "italian", code: "it", label: "Italian", native: "Italiano", indian: false, voices: [{ name: "Elsa", gender: "Female" }, { name: "Diego", gender: "Male" }], angle: "Italian voices for documents and articles.", sample: "Ciao, sono il tuo narratore HearMeOut." },
  { slug: "arabic", code: "ar", label: "Arabic", native: "العربية", indian: false, voices: [{ name: "Zariyah", gender: "Female" }, { name: "Hamed", gender: "Male" }], angle: "Modern Standard Arabic narration.", sample: "مرحباً، أنا راويك في هير مي أوت." },
  { slug: "indonesian", code: "id", label: "Indonesian", native: "Bahasa Indonesia", indian: false, voices: [{ name: "Gadis", gender: "Female" }, { name: "Ardi", gender: "Male" }], angle: "Indonesian voices for study and work documents.", sample: "Halo, saya narator HearMeOut Anda." },
  { slug: "japanese", code: "ja", label: "Japanese", native: "日本語", indian: false, voices: [{ name: "Nanami", gender: "Female" }, { name: "Keita", gender: "Male" }], angle: "Japanese narration for articles and notes.", sample: "こんにちは、HearMeOutのナレーターです。" },
  { slug: "chinese", code: "zh", label: "Chinese", native: "中文", indian: false, voices: [{ name: "Xiaoxiao", gender: "Female" }, { name: "Yunxi", gender: "Male" }], angle: "Mandarin Chinese voices.", sample: "你好，我是你的 HearMeOut 朗读者。" },
  { slug: "russian", code: "ru", label: "Russian", native: "Русский", indian: false, voices: [{ name: "Svetlana", gender: "Female" }, { name: "Dmitry", gender: "Male" }], angle: "Russian narration for long texts.", sample: "Здравствуйте, я ваш диктор HearMeOut." },
  { slug: "turkish", code: "tr", label: "Turkish", native: "Türkçe", indian: false, voices: [{ name: "Emel", gender: "Female" }, { name: "Ahmet", gender: "Male" }], angle: "Turkish voices for documents and articles.", sample: "Merhaba, ben HearMeOut anlatıcınızım." },
]

export const LANGUAGE_BY_SLUG = Object.fromEntries(LANGUAGE_PAGES.map((l) => [l.slug, l]))
