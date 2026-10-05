"""Supported listening languages, their default voices and sample sentences."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Language:
    code: str  # our code: en, hi, hinglish, mr, ...
    label: str
    native: str
    locales: tuple[str, ...]  # Edge voice locales to offer
    voice: str  # default narrator
    voice2: str  # default second voice (quiz answers / examiner)
    sample: str
    llm_name: str  # how prompts name the output language
    indian: bool = False


LANGUAGES: tuple[Language, ...] = (
    Language("en", "English", "English", ("en-US", "en-GB", "en-IN", "en-AU", "en-CA"),
             "en-US-EmmaNeural", "en-US-AndrewNeural",
             "Hi, I am your HearMeOut narrator. Let's turn your reading into listening.",
             "English"),
    Language("hi", "Hindi", "हिन्दी", ("hi-IN",), "hi-IN-SwaraNeural", "hi-IN-MadhurNeural",
             "नमस्ते, मैं आपका हियर-मी-आउट वाचक हूँ। चलिए, आपकी पढ़ाई को सुनने में बदलते हैं।",
             "Hindi in Devanagari script", True),
    Language("hinglish", "Hinglish", "Hinglish", ("en-IN",), "en-IN-NeerjaNeural", "en-IN-PrabhatNeural",
             "Namaste, main aapka HearMeOut narrator hoon. Chaliye, aapki padhai ko sunne mein badalte hain.",
             "Hinglish (Hindi written in Roman/English letters, mixing common English words naturally)", True),
    Language("mr", "Marathi", "मराठी", ("mr-IN",), "mr-IN-AarohiNeural", "mr-IN-ManoharNeural",
             "नमस्कार, मी तुमचा हिअर-मी-आउट निवेदक आहे. चला, तुमचा अभ्यास ऐकण्यात बदलूया.",
             "Marathi in Devanagari script", True),
    Language("ta", "Tamil", "தமிழ்", ("ta-IN",), "ta-IN-PallaviNeural", "ta-IN-ValluvarNeural",
             "வணக்கம், நான் உங்கள் ஹியர்-மீ-அவுட் கதைசொல்லி. உங்கள் படிப்பை கேட்கும் அனுபவமாக மாற்றுவோம்.",
             "Tamil", True),
    Language("te", "Telugu", "తెలుగు", ("te-IN",), "te-IN-ShrutiNeural", "te-IN-MohanNeural",
             "నమస్కారం, నేను మీ హియర్-మీ-అవుట్ వ్యాఖ్యాతను. మీ చదువును వినడంగా మార్చుదాం.",
             "Telugu", True),
    Language("bn", "Bengali", "বাংলা", ("bn-IN",), "bn-IN-TanishaaNeural", "bn-IN-BashkarNeural",
             "নমস্কার, আমি আপনার হিয়ার-মি-আউট কথক। আসুন আপনার পড়াকে শোনায় বদলে নিই।",
             "Bengali", True),
    Language("gu", "Gujarati", "ગુજરાતી", ("gu-IN",), "gu-IN-DhwaniNeural", "gu-IN-NiranjanNeural",
             "નમસ્તે, હું તમારો હિયર-મી-આઉટ વાચક છું. ચાલો, તમારા વાંચનને સાંભળવામાં ફેરવીએ.",
             "Gujarati", True),
    Language("kn", "Kannada", "ಕನ್ನಡ", ("kn-IN",), "kn-IN-SapnaNeural", "kn-IN-GaganNeural",
             "ನಮಸ್ಕಾರ, ನಾನು ನಿಮ್ಮ ಹಿಯರ್-ಮಿ-ಔಟ್ ನಿರೂಪಕ. ನಿಮ್ಮ ಓದನ್ನು ಕೇಳುವಿಕೆಯಾಗಿ ಬದಲಾಯಿಸೋಣ.",
             "Kannada", True),
    Language("ml", "Malayalam", "മലയാളം", ("ml-IN",), "ml-IN-SobhanaNeural", "ml-IN-MidhunNeural",
             "നമസ്കാരം, ഞാൻ നിങ്ങളുടെ ഹിയർ-മി-ഔട്ട് അവതാരകനാണ്. നിങ്ങളുടെ വായനയെ കേൾവിയാക്കാം.",
             "Malayalam", True),
    Language("ur", "Urdu", "اردو", ("ur-IN", "ur-PK"), "ur-IN-GulNeural", "ur-IN-SalmanNeural",
             "السلام علیکم، میں آپ کا ہیئر می آؤٹ راوی ہوں۔ آئیے آپ کے مطالعے کو سننے میں بدلتے ہیں۔",
             "Urdu", True),
    Language("es", "Spanish", "Español", ("es-ES", "es-MX"), "es-ES-ElviraNeural", "es-ES-AlvaroNeural",
             "Hola, soy tu narrador de HearMeOut. Convirtamos tu lectura en escucha.", "Spanish"),
    Language("fr", "French", "Français", ("fr-FR",), "fr-FR-DeniseNeural", "fr-FR-HenriNeural",
             "Bonjour, je suis votre narrateur HearMeOut. Transformons votre lecture en écoute.", "French"),
    Language("de", "German", "Deutsch", ("de-DE",), "de-DE-KatjaNeural", "de-DE-ConradNeural",
             "Hallo, ich bin dein HearMeOut-Sprecher. Lass uns dein Lesen in Zuhören verwandeln.", "German"),
    Language("pt", "Portuguese", "Português", ("pt-BR",), "pt-BR-FranciscaNeural", "pt-BR-AntonioNeural",
             "Olá, sou o seu narrador HearMeOut. Vamos transformar sua leitura em escuta.", "Portuguese"),
    Language("it", "Italian", "Italiano", ("it-IT",), "it-IT-ElsaNeural", "it-IT-DiegoNeural",
             "Ciao, sono il tuo narratore HearMeOut. Trasformiamo la tua lettura in ascolto.", "Italian"),
    Language("ar", "Arabic", "العربية", ("ar-SA",), "ar-SA-ZariyahNeural", "ar-SA-HamedNeural",
             "مرحباً، أنا راويك في هير مي أوت. لنحوّل قراءتك إلى استماع.", "Arabic"),
    Language("id", "Indonesian", "Bahasa Indonesia", ("id-ID",), "id-ID-GadisNeural", "id-ID-ArdiNeural",
             "Halo, saya narator HearMeOut Anda. Mari ubah bacaan Anda menjadi sesuatu yang bisa didengar.",
             "Indonesian"),
    Language("ja", "Japanese", "日本語", ("ja-JP",), "ja-JP-NanamiNeural", "ja-JP-KeitaNeural",
             "こんにちは、HearMeOutのナレーターです。読書を聞く時間に変えましょう。", "Japanese"),
    Language("zh", "Chinese", "中文", ("zh-CN",), "zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural",
             "你好，我是你的 HearMeOut 朗读者。让我们把阅读变成聆听。", "Simplified Chinese"),
    Language("ru", "Russian", "Русский", ("ru-RU",), "ru-RU-SvetlanaNeural", "ru-RU-DmitryNeural",
             "Здравствуйте, я ваш диктор HearMeOut. Давайте превратим чтение в слушание.", "Russian"),
    Language("tr", "Turkish", "Türkçe", ("tr-TR",), "tr-TR-EmelNeural", "tr-TR-AhmetNeural",
             "Merhaba, ben HearMeOut anlatıcınızım. Okumanızı dinlemeye çevirelim.", "Turkish"),
)

_BY_CODE = {lang.code: lang for lang in LANGUAGES}


def get_language(code: str) -> Language | None:
    return _BY_CODE.get(code)


def language_for_voice(voice_id: str) -> Language | None:
    """Our language for an Edge voice id like 'hi-IN-SwaraNeural'."""
    locale = "-".join(voice_id.split("-")[:2])
    base = locale.split("-")[0]
    if base == "en":
        return _BY_CODE["en"]
    return _BY_CODE.get(base)


def resolve_language(code: str | None, default: str = "en") -> Language:
    return _BY_CODE.get((code or "").split("-")[0].lower()) or _BY_CODE[default]
