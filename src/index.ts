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
  language?: string;  // 'swedish' | 'english' | 'spanish' | 'french' | ...
  timezone?: string;  // IANA tz like 'Europe/Stockholm'; defaults to server tz
  now?: string;       // ISO date string for testing, e.g. '2025-11-03T08:30:00'
}

interface DateParameters {
  format?: string;
}

/** ---------- Time helpers ---------- */

function getZonedDate(nowISO?: string, timeZone?: string) {
  // Construct a Date corresponding to 'nowISO' (if provided), otherwise 'new Date()'
  const base = nowISO ? new Date(nowISO) : new Date();
  // If a timezone is supplied, compute the equivalent local time there using Intl
  if (!timeZone) return base;
  // Build parts to reconstruct a local date-time string in the target time zone
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

type LangKey = 'swedish' | 'english' | 'spanish' | 'french';
const LANG_ALIASES: Record<string, LangKey> = {
  sv: 'swedish', swe: 'swedish', swedish: 'swedish',
  en: 'english', eng: 'english', english: 'english',
  es: 'spanish', spa: 'spanish', spanish: 'spanish',
  fr: 'french', fra: 'french', fre: 'french', french: 'french',
};

const GREETINGS: Record<LangKey, Record<DaySegment | 'generic', string[]>> = {
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
      '¡Buen resto de la mañana, {name}!',
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

  // Resolve language (include Swedish + aliases)
  const langs: LangKey[] = ['swedish', 'english', 'spanish', 'french'];
  let normalized: LangKey | undefined;
  if (language) {
    const key = language.trim().toLowerCase();
    normalized = LANG_ALIASES[key] || (langs.includes(key as LangKey) ? (key as LangKey) : undefined);
  }
  const selectedLanguage: LangKey = normalized || choose(langs);

  // Time-of-day detection (defaults to server tz; can be forced via 'timezone' or 'now')
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
  description: 'Greets a person in Swedish, English, Spanish, or French with a time-of-day aware message (lots of variants).',
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
      description: 'Language for greeting (swedish | english | spanish | french). Defaults to random; accepts aliases like sv/en/es/fr.',
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
