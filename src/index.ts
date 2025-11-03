import express from 'express';
import { ToolsService, tool, ParameterType } from '@optimizely-opal/opal-tools-sdk';

// Create Express app
const app = express();
app.use(express.json());

// Create Tools Service
const toolsService = new ToolsService(app);

// Interfaces for tool parameters
interface GreetingParameters {
  name: string;
  language?: string;  // 'swedish' | 'english' | 'spanish' | 'french' | 'arabic' | ...
  timezone?: string;  // IANA tz like 'Europe/Stockholm'; defaults to server tz
  now?: string;       // ISO date string for testing, e.g. '2025-11-03T08:30:00'
}

interface DateParameters {
  format?: string;
}

/** ---------- Time helpers ---------- */

function getZonedDate(nowISO?: string, timeZone?: string) {
  const base = nowISO ? new Date(nowISO) : new Date();
  if (!timeZone) return base;

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(base).reduce<Record<string,string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const isoLike = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  return new Date(isoLike);
}

type DaySegment =
  | 'early_morning'  // 04–06
  | 'morning'        // 06–10
  | 'forenoon'       // 10–12
  | 'midday'         // 12–13
  | 'afternoon'      // 13–17
  | 'evening'        // 17–21
  | 'late_evening'   // 21–23
  | 'night';         // 23–04

function getDaySegment(d: Date): DaySegment {
  const h = d.getHours();
  if (h >= 4 && h < 6) return 'early_morning';
  if (h >= 6 && h < 10) return 'morning';
  if (h >= 10 && h < 12) return 'forenoon';
  if (h >= 12 && h < 13) return 'midday';
  if (h >= 13 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  if (h >= 21 && h < 23) return 'late_evening';
  return 'night';
}

/** ---------- Greeting catalog (many variants) ---------- */

type LangKey =
  | 'swedish' | 'english' | 'spanish' | 'french'
  | 'arabic' | 'finnish' | 'italian' | 'hindi'
  | 'urdu' | 'turkish' | 'thai' | 'serbian';

const LANG_ALIASES: Record<string, LangKey> = {
  // Swedish
  sv: 'swedish', swe: 'swedish', sv_se: 'swedish', swedish: 'swedish', svenska: 'swedish',
  // English
  en: 'english', eng: 'english', en_us: 'english', en_gb: 'english', english: 'english',
  // Spanish
  es: 'spanish', spa: 'spanish', es_es: 'spanish', es_la: 'spanish', spanish: 'spanish', español: 'spanish',
  // French
  fr: 'french', fra: 'french', fre: 'french', french: 'french', français: 'french',

  // Arabic
  ar: 'arabic', ara: 'arabic', arabic: 'arabic', 'العربية': 'arabic',
  // Finnish
  fi: 'finnish', fin: 'finnish', finnish: 'finnish', suomi: 'finnish',
  // Italian
  it: 'italian', ita: 'italian', italian: 'italian', italiano: 'italian',
  // Hindi
  hi: 'hindi', hin: 'hindi', hindi: 'hindi', 'हिन्दी': 'hindi',
  // Urdu
  ur: 'urdu', urd: 'urdu', urdu: 'urdu', 'اردو': 'urdu',
  // Turkish
  tr: 'turkish', tur: 'turkish', turkish: 'turkish', türkçe: 'turkish',
  // Thai
  th: 'thai', tha: 'thai', thai: 'thai', 'ไทย': 'thai',
  // Serbian (Latin; map common tags)
  sr: 'serbian', srp: 'serbian', 'sr-latn': 'serbian', serbian: 'serbian', srpski: 'serbian',
};

const GREETINGS: Record<LangKey, Record<DaySegment | 'generic', string[]>> = {
  /* ---------------- Swedish ---------------- */
  swedish: {
    early_morning: [
      'God morgon, {name}!',
      'Tidigt god morgon, {name}!',
      'Morgon, {name}! Dags att komma igång?',
    ],
    morning: [
      'God morgon, {name}!',
      'Hej {name}! Hoppas morgonen är bra.',
      'Tjenare {name}, fin morgon!',
    ],
    forenoon: [
      'God förmiddag, {name}!',
      'Hej {name}, hur går förmiddagen?',
      'Hoppas förmiddagen flyter på, {name}!',
    ],
    midday: [
      'Trevlig lunch, {name}!',
      'Hej {name}! Dags för lunch?',
      'Lunchläge, {name}—smaklig måltid!',
    ],
    afternoon: [
      'God eftermiddag, {name}!',
      'Hej {name}, hoppas eftermiddagen går fint.',
      'Tjena {name}! Kör hårt i eftermiddag.',
    ],
    evening: [
      'God kväll, {name}!',
      'Hej {name}, hoppas kvällen blir lugn.',
      'Trevlig kväll, {name}!',
    ],
    late_evening: [
      'Sen kväll, {name}—allt bra?',
      'Hej {name}, snart dags att varva ner.',
      'Trevlig sen kväll, {name}!',
    ],
    night: [
      'God natt, {name}!',
      'Sov gott, {name}.',
      'Natti natti, {name}!',
    ],
    generic: [
      'Hej {name}!',
      'Hallå {name}!',
      'Tjena {name}!',
    ],
  },

  /* ---------------- English ---------------- */
  english: {
    early_morning: [
      'Early good morning, {name}!',
      'Rise and shine, {name}!',
      'Morning, {name}! Ready to roll?',
    ],
    morning: [
      'Good morning, {name}!',
      'Hi {name}! Hope your morning is going well.',
      'Morning, {name}!',
    ],
    forenoon: [
      'Good forenoon, {name}!',
      'Almost lunchtime, {name}!',
      'Hope your late morning’s smooth, {name}!',
    ],
    midday: [
      'Happy lunch, {name}!',
      'Good midday, {name}!',
      'Lunch time, {name}—enjoy!',
    ],
    afternoon: [
      'Good afternoon, {name}!',
      'Hey {name}, have a productive afternoon.',
      'Keep it up this afternoon, {name}!',
    ],
    evening: [
      'Good evening, {name}!',
      'Hope your evening’s relaxing, {name}.',
      'Have a nice evening, {name}!',
    ],
    late_evening: [
      'Late evening, {name}—all good?',
      'Winding down, {name}?',
      'Have a calm late evening, {name}.',
    ],
    night: [
      'Good night, {name}!',
      'Sleep well, {name}.',
      'Nighty night, {name}!',
    ],
    generic: [
      'Hello, {name}!',
      'Hi {name}!',
      'Hey {name}!',
    ],
  },

  /* ---------------- Spanish ---------------- */
  spanish: {
    early_morning: [
      '¡Buenos días tempraneros, {name}!',
      '¡Arriba, {name}!',
      '¡Buen inicio de mañana, {name}!',
    ],
    morning: [
      '¡Buenos días, {name}!',
      '¡Hola {name}! ¿Cómo va la mañana?',
      '¡Buen día, {name}!',
    ],
    forenoon: [
      '¡Buena mañana, {name}!',
      '¡Casi hora de comer, {name}!',
      '¡Que vaya bien la mañana, {name}!',
    ],
    midday: [
      '¡Buen provecho, {name}!',
      '¡Feliz mediodía, {name}!',
      '¡Hora de comer, {name}!',
    ],
    afternoon: [
      '¡Buenas tardes, {name}!',
      '¡Hola {name}, que tengas una tarde productiva!',
      '¡Ánimo esta tarde, {name}!',
    ],
    evening: [
      '¡Buenas noches, {name}!',
      '¡Que tengas una noche tranquila, {name}!',
      '¡Linda noche, {name}!',
    ],
    late_evening: [
      '¡Noche avanzada, {name}!',
      '¿Listo para descansar, {name}?',
      '¡Que sea una noche serena, {name}!',
    ],
    night: [
      '¡Dulces sueños, {name}!',
      '¡Buenas noches, {name}!',
      '¡A dormir, {name}!',
    ],
    generic: [
      '¡Hola, {name}!',
      '¡Buenas, {name}!',
      '¡Qué tal, {name}!',
    ],
  },

  /* ---------------- French ---------------- */
  french: {
    early_morning: [
      'Très bon matin, {name} !',
      'Debout, {name} !',
      'Coucou {name}, tôt mais motivé ?',
    ],
    morning: [
      'Bonjour, {name} !',
      'Salut {name} ! Bonne matinée.',
      'Bonne journée qui commence, {name} !',
    ],
    forenoon: [
      'Bonne fin de matinée, {name} !',
      'Bientôt le déjeuner, {name} !',
      'Matinée fluide, {name} ?',
    ],
    midday: [
      'Bon déjeuner, {name} !',
      'Bon midi, {name} !',
      'C’est l’heure de manger, {name} !',
    ],
    afternoon: [
      'Bon après-midi, {name} !',
      'Courage pour l’après-midi, {name} !',
      'Que ton après-midi soit productif, {name} !',
    ],
    evening: [
      'Bonsoir, {name} !',
      'Belle soirée, {name} !',
      'Passe une soirée tranquille, {name} !',
    ],
    late_evening: [
      'Soirée tardive, {name} !',
      'On lève le pied, {name} ?',
      'Douce fin de soirée, {name} !',
    ],
    night: [
      'Bonne nuit, {name} !',
      'Dors bien, {name} !',
      'À demain, {name} !',
    ],
    generic: [
      'Salut {name} !',
      'Bonjour {name} !',
      'Coucou {name} !',
    ],
  },

  /* ---------------- Arabic ---------------- */
  arabic: {
    early_morning: [
      'صباح الخير المبكر يا {name}!',
      'انهض وتألق يا {name}!',
    ],
    morning: [
      'صباح الخير يا {name}!',
      'أهلاً {name}، أتمنى أن تكون صباحك رائعاً.',
    ],
    forenoon: [
      'صباح متأخر سعيد يا {name}!',
      'اقترب وقت الغداء يا {name}!',
    ],
    midday: [
      'شهية طيبة يا {name}!',
      'وقت الغداء يا {name}—استمتع!',
    ],
    afternoon: [
      'مساء الخير يا {name}!',
      'أتمنى لك ظهيرة موفقة يا {name}.',
    ],
    evening: [
      'مساء الخير يا {name}!',
      'أتمنى لك مساءً هادئاً يا {name}.',
    ],
    late_evening: [
      'مساء متأخر يا {name}—كل شيء على ما يرام؟',
      'هل حان وقت الاسترخاء يا {name}؟',
    ],
    night: [
      'تصبح على خير يا {name}!',
      'أحلام سعيدة يا {name}.',
    ],
    generic: [
      'مرحباً {name}!',
      'أهلاً {name}!',
      'تحياتي لك يا {name}!',
    ],
  },

  /* ---------------- Finnish ---------------- */
  finnish: {
    early_morning: [
      'Hyvää varhaisaamua, {name}!',
      'Ylös ja menoksi, {name}!',
    ],
    morning: [
      'Hyvää huomenta, {name}!',
      'Moi {name}! Toivottavasti aamu sujuu hyvin.',
    ],
    forenoon: [
      'Hyvää aamupäivää, {name}!',
      'Kohta lounas, {name}!',
    ],
    midday: [
      'Hyvää lounasaikaa, {name}!',
      'Mukavaa keskipäivää, {name}!',
    ],
    afternoon: [
      'Hyvää iltapäivää, {name}!',
      'Tsemppiä iltapäivään, {name}!',
    ],
    evening: [
      'Hyvää iltaa, {name}!',
      'Rentouttavaa iltaa, {name}!',
    ],
    late_evening: [
      'Myöhäinen ilta, {name}—miten menee?',
      'Alkaako olla rauhoittumisen aika, {name}?',
    ],
    night: [
      'Hyvää yötä, {name}!',
      'Nuku hyvin, {name}.',
    ],
    generic: [
      'Hei {name}!',
      'Moikka {name}!',
      'Terve {name}!',
    ],
  },

  /* ---------------- Italian ---------------- */
  italian: {
    early_morning: [
      'Buon mattino presto, {name}!',
      'Su, {name}, si comincia!',
    ],
    morning: [
      'Buongiorno, {name}!',
      'Ciao {name}! Spero che la mattina vada bene.',
    ],
    forenoon: [
      'Buona tarda mattinata, {name}!',
      'Quasi ora di pranzo, {name}!',
    ],
    midday: [
      'Buon pranzo, {name}!',
      'Buon mezzogiorno, {name}!',
    ],
    afternoon: [
      'Buon pomeriggio, {name}!',
      'Forza per il pomeriggio, {name}!',
    ],
    evening: [
      'Buona sera, {name}!',
      'Passa una serata tranquilla, {name}!',
    ],
    late_evening: [
      'Tarda serata, {name}—tutto bene?',
      'È ora di rilassarsi, {name}?',
    ],
    night: [
      'Buona notte, {name}!',
      'Dormi bene, {name}.',
    ],
    generic: [
      'Ciao {name}!',
      'Salve {name}!',
      'Ehi {name}!',
    ],
  },

  /* ---------------- Hindi ---------------- */
  hindi: {
    early_morning: [
      'सुबह-सुबह शुभ प्रभात, {name}!',
      'उठो और चमको, {name}!',
    ],
    morning: [
      'सुप्रभात, {name}!',
      'हाय {name}! आशा है सुबह अच्छी जा रही है।',
    ],
    forenoon: [
      'देर सुबह की शुभकामनाएँ, {name}!',
      'लगभग लंच का समय है, {name}!',
    ],
    midday: [
      'लंच टाइम, {name}—आनंद लें!',
      'शुभ मध्याह्न, {name}!',
    ],
    afternoon: [
      'शुभ दोपहर, {name}!',
      'उत्पादक दोपहर रहे, {name}!',
    ],
    evening: [
      'शुभ संध्या, {name}!',
      'आपकी शाम सुकूनभरी हो, {name}।',
    ],
    late_evening: [
      'देर शाम है, {name}—सब ठीक?',
      'आराम का समय हो गया, {name}?',
    ],
    night: [
      'शुभ रात्रि, {name}!',
      'अच्छी नींद लें, {name}।',
    ],
    generic: [
      'नमस्ते, {name}!',
      'हाय {name}!',
      'नमस्कार {name}!',
    ],
  },

  /* ---------------- Urdu ---------------- */
  urdu: {
    early_morning: [
      'صبح بخیر، {name}!',
      'اٹھو اور چمکو، {name}!',
    ],
    morning: [
      'صبح بخیر {name}!',
      'السلام علیکم {name}! صبح کیسی گزر رہی ہے؟',
    ],
    forenoon: [
      'خوشگوار صبح، {name}!',
      'تقریباً دوپہر کا وقت، {name}!',
    ],
    midday: [
      'لنچ کا وقت ہے، {name}—مزے سے کھائیں!',
      'دوپہر بخیر، {name}!',
    ],
    afternoon: [
      'دوپہر بخیر {name}!',
      'پیداواری دوپہر رہے، {name}!',
    ],
    evening: [
      'شام بخیر {name}!',
      'آرام دہ شام گزرے، {name}۔',
    ],
    late_evening: [
      'دیر رات کی شام، {name}—سب ٹھیک؟',
      'آرام کرنے کا وقت ہے، {name}؟',
    ],
    night: [
      'شب بخیر {name}!',
      'میٹھے خواب، {name}۔',
    ],
    generic: [
      'سلام {name}!',
      'ہیلو {name}!',
      'خوش آمدید {name}!',
    ],
  },

  /* ---------------- Turkish ---------------- */
  turkish: {
    early_morning: [
      'Erken günaydın, {name}!',
      'Hadi başlayalım, {name}!',
    ],
    morning: [
      'Günaydın, {name}!',
      'Merhaba {name}! Sabahın nasıl gidiyor?',
    ],
    forenoon: [
      'Öğlene doğru iyi günler, {name}!',
      'Neredeyse öğle vakti, {name}!',
    ],
    midday: [
      'Afiyet olsun, {name}!',
      'İyi öğleler, {name}!',
    ],
    afternoon: [
      'İyi öğleden sonralar, {name}!',
      'Verimli bir öğleden sonra dilerim, {name}!',
    ],
    evening: [
      'İyi akşamlar, {name}!',
      'Sakin bir akşam dilerim, {name}!',
    ],
    late_evening: [
      'Geç akşam, {name}—her şey yolunda mı?',
      'Yavaş yavaş dinlenme zamanı, {name}?',
    ],
    night: [
      'İyi geceler, {name}!',
      'Tatlı rüyalar, {name}.',
    ],
    generic: [
      'Merhaba {name}!',
      'Selam {name}!',
      'Hey {name}!',
    ],
  },

  /* ---------------- Thai ---------------- */
  thai: {
    early_morning: [
      'สวัสดีตอนเช้าแต่เช้าเลยนะ {name}!',
      'ตื่นมาลุยกันเลย {name}!',
    ],
    morning: [
      'สวัสดีตอนเช้า {name}!',
      'ไฮ {name}! ขอให้เช้านี้เป็นวันที่ดีนะ',
    ],
    forenoon: [
      'สายๆ เช้านี้เป็นไงบ้าง {name}!',
      'ใกล้ถึงเวลาเที่ยงแล้วนะ {name}!',
    ],
    midday: [
      'มื้อเที่ยงให้อร่อยนะ {name}!',
      'สวัสดีตอนเที่ยง {name}!',
    ],
    afternoon: [
      'สวัสดีตอนบ่าย {name}!',
      'ขอให้ช่วงบ่ายได้ผลลัพธ์ดีๆ นะ {name}!',
    ],
    evening: [
      'สวัสดีตอนเย็น {name}!',
      'ขอให้ค่ำนี้สบายๆ นะ {name}',
    ],
    late_evening: [
      'ดึกแล้วนะ {name}—โอเคไหม?',
      'ได้เวลาพักผ่อนหรือยัง {name}?',
    ],
    night: [
      'ราตรีสวัสดิ์ {name}!',
      'ฝันดีนะ {name}',
    ],
    generic: [
      'สวัสดี {name}!',
      'ไฮ {name}!',
      'เฮ้ {name}!',
    ],
  },

  /* ---------------- Serbian (Latin) ---------------- */
  serbian: {
    early_morning: [
      'Rano jutro, {name}!',
      'Ustaj i zasijaj, {name}!',
    ],
    morning: [
      'Dobro jutro, {name}!',
      'Zdravo {name}! Nadam se da ti jutro lepo protiče.',
    ],
    forenoon: [
      'Dobar kasni jutarnji deo, {name}!',
      'Skoro je vreme za ručak, {name}!',
    ],
    midday: [
      'Prijatan ručak, {name}!',
      'Dobar podne, {name}!',
    ],
    afternoon: [
      'Dobar dan, {name}!',
      'Produktivno popodne želim, {name}!',
    ],
    evening: [
      'Dobro veče, {name}!',
      'Neka ti veče bude mirno, {name}!',
    ],
    late_evening: [
      'Pozno veče, {name}—sve u redu?',
      'Vreme je da se opustiš, {name}?',
    ],
    night: [
      'Laku noć, {name}!',
      'Sanjaj lepo, {name}.',
    ],
    generic: [
      'Zdravo {name}!',
      'Ćao {name}!',
      'Hej {name}!',
    ],
  },
};

function choose<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatGreeting(tpl: string, name: string) {
  return tpl.replace('{name}', name);
}

/**
 * Greeting Tool: Greets a person in the requested language (defaults random)
 * and adapts the message to the local time-of-day with many variants.
 */
async function greeting(parameters: GreetingParameters) {
  const { name, language, timezone, now } = parameters;

  // Resolve language (now includes many aliases)
  const langs: LangKey[] = [
    'swedish', 'english', 'spanish', 'french',
    'arabic', 'finnish', 'italian', 'hindi',
    'urdu', 'turkish', 'thai', 'serbian'
  ];

  let normalized: LangKey | undefined;
  if (language) {
    const key = language.trim().toLowerCase();
    normalized = LANG_ALIASES[key] || (langs.includes(key as LangKey) ? (key as LangKey) : undefined);
  }
  const selectedLanguage: LangKey = normalized || choose(langs);

  // Time-of-day detection
  const zonedNow = getZonedDate(now, timezone);
  const segment = getDaySegment(zonedNow);

  // Pick a segment-specific greeting; fall back to generic if missing
  const bank = GREETINGS[selectedLanguage];
  const options = bank[segment] && bank[segment]!.length ? bank[segment] : bank.generic;
  const greeting = formatGreeting(choose(options), name);

  return {
    greeting,
    language: selectedLanguage,
    timeSegment: segment,
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    isoNow: zonedNow.toISOString(),
  };
}

/**
 * Today's Date Tool: Returns today's date in the specified format
 */
async function todaysDate(parameters: DateParameters) {
  const format = parameters.format || '%Y-%m-%d';
  const today = new Date();

  let formattedDate: string;
  if (format === '%Y-%m-%d') {
    formattedDate = today.toISOString().split('T')[0];
  } else if (format === '%B %d, %Y') {
    formattedDate = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } else if (format === '%d/%m/%Y') {
    formattedDate = today.toLocaleDateString('en-GB');
  } else {
    formattedDate = today.toISOString().split('T')[0];
  }

  return {
    date: formattedDate,
    format: format,
    timestamp: Math.floor(today.getTime() / 1000)
  };
}

// Register the tools using decorators with explicit parameter definitions
tool({
  name: 'GreetingsTimeOfDay',
  description:
    'Greets a person with a time-of-day aware message (lots of variants). Languages: swedish, english, spanish, french, arabic, finnish, italian, hindi, urdu, turkish, thai, serbian. Accepts aliases like sv/en/es/fr/ar/fi/it/hi/ur/tr/th/sr.',
  parameters: [
    {
      name: 'name',
      type: ParameterType.String,
      description: 'Name of the person to greet',
      required: true
    },
    {
      name: 'language',
      type: ParameterType.String,
      description:
        'Language for greeting. Defaults to random; accepts aliases (e.g., sv, en, es, fr, ar, fi, it, hi, ur, tr, th, sr) and some native names.',
      required: false
    },
    {
      name: 'timezone',
      type: ParameterType.String,
      description: 'IANA timezone (e.g., Europe/Stockholm) to localize the greeting.',
      required: false
    },
    {
      name: 'now',
      type: ParameterType.String,
      description: 'ISO datetime for testing the time-of-day selection.',
      required: false
    }
  ]
})(greeting);

tool({
  name: 'todays-date-ISO',
  description: 'Returns today\'s date in the specified format',
  parameters: [
    {
      name: 'format',
      type: ParameterType.String,
      description: 'Date format (defaults to ISO format)',
      required: false
    }
  ]
})(todaysDate);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Discovery endpoint: http://localhost:${PORT}/discovery`);
});
