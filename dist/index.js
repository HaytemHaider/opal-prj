"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const opal_tools_sdk_1 = require("@optimizely-opal/opal-tools-sdk");
// Create Express app
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Create Tools Service
const toolsService = new opal_tools_sdk_1.ToolsService(app);
/**
 * Greeting Tool: Greets a person in a random language
 */
// Apply tool decorator after function definition
async function sgc_greeting(parameters) {
    const { name, language } = parameters;
    // If language not specified, choose randomly
    const selectedLanguage = language ||
        ['english', 'spanish', 'french'][Math.floor(Math.random() * 3)];
    // Generate greeting based on language
    let greeting;
    if (selectedLanguage.toLowerCase() === 'spanish') {
        greeting = `¡Hola, ${name}! ¿Cómo estás?`;
    }
    else if (selectedLanguage.toLowerCase() === 'french') {
        greeting = `Bonjour, ${name}! Comment ça va?`;
    }
    else { // Default to English
        greeting = `Hello, ${name}! How are you?`;
    }
    return {
        greeting,
        language: selectedLanguage
    };
}
/**
 * Today's Date Tool: Returns today's date in the specified format
 */
// Apply tool decorator after function definition
async function sgc_todays_Date(parameters) {
    const format = parameters.format || '%Y-%m-%d';
    // Get today's date
    const today = new Date();
    // Format the date (simplified implementation)
    let formattedDate;
    if (format === '%Y-%m-%d') {
        formattedDate = today.toISOString().split('T')[0];
    }
    else if (format === '%B %d, %Y') {
        formattedDate = today.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    else if (format === '%d/%m/%Y') {
        formattedDate = today.toLocaleDateString('en-GB');
    }
    else {
        // Default to ISO format
        formattedDate = today.toISOString().split('T')[0];
    }
    return {
        date: formattedDate,
        format: format,
        timestamp: today.getTime() / 1000
    };
}

/**
 * Content Density: Analyses a web page for content density
 */
async function content_density_evaluator(parameters) {
  const { url } = parameters;
  // --- Helpers -------------------------------------------------
  function getTagContents(html, tag) {
    const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    const out = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      out.push(match[1]);
    }
    return out;
  }

  function stripTags(s) {
    return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  // --- Fetch page ----------------------------------------------
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();

  // --- Extract key metrics -------------------------------------
  const paragraphHTML = getTagContents(html, "p");
  const paragraphTexts = paragraphHTML.map(stripTags).filter(t => t.length > 0);

  const allWords = paragraphTexts.join(" ").split(/\s+/).filter(Boolean);
  const wordCount = allWords.length;
  const imageCount = (html.match(/<img\b[^>]*>/gi) || []).length;
  const headingCount = (html.match(/<h[1-6]\b[^>]*>/gi) || []).length;

  const paragraphWordCounts = paragraphTexts.map(p =>
    p.split(/\s+/).filter(Boolean).length
  );
  const avgParagraphLength =
    paragraphWordCounts.length === 0
      ? 0
      : paragraphWordCounts.reduce((a, b) => a + b, 0) / paragraphWordCounts.length;

  // --- Simple scanability heuristic -----------------------------
  let scanabilityScore = 100;
  if (avgParagraphLength > 100) scanabilityScore -= 20;
  if (imageCount === 0) scanabilityScore -= 20;
  if (headingCount === 0) scanabilityScore -= 20;
  if (scanabilityScore < 0) scanabilityScore = 0;

  // --- Notes / recommendations ---------------------------------
  const notes = [];
  if (avgParagraphLength > 80) {
    notes.push("Paragraphs are long; consider splitting large blocks of text.");
  } else {
    notes.push("Paragraph length seems reasonable.");
  }

  if (imageCount === 0) {
    notes.push("No images found; consider adding supporting visuals.");
  } else {
    notes.push("Contains imagery to break up text.");
  }

  if (headingCount === 0) {
    notes.push("No headings found; add subheadings to improve scanning.");
  } else {
    notes.push("Has headings to guide the reader.");
  }

  // --- Return structured result --------------------------------
  return {
    url,
    wordCount,
    imageCount,
    headingCount,
    avgParagraphLength: Math.round(avgParagraphLength),
    scanabilityScore,
    notes
  };
}

async function accessibility_surface_check(parameters) {
  const { url } = parameters;
  // Fetch the page HTML
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();

  // Count <h1> elements
  const h1Matches = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1Count = h1Matches.length;

  // Count <img> tags missing usable alt text
  // Rule: <img> with no alt= OR alt="" is considered missing
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  let imagesMissingAlt = 0;
  for (const imgTag of imgTags) {
    const altMatchDouble = imgTag.match(/\balt\s*=\s*"([^"]*)"/i);
    const altMatchSingle = imgTag.match(/\balt\s*=\s*'([^']*)'/i);
    const altValue = altMatchDouble
      ? altMatchDouble[1]
      : altMatchSingle
      ? altMatchSingle[1]
      : null;
    if (altValue === null || altValue.trim() === "") {
      imagesMissingAlt++;
    }
  }

  // Count unlabeled <button> elements
  // We treat a button as "unlabeled" if:
  // - There's no visible text between <button>...</button>
  // - AND no aria-label attribute
  const buttonRegex = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
  const buttonBlocks = [];
  let btnMatch;
  while ((btnMatch = buttonRegex.exec(html)) !== null) {
    buttonBlocks.push(btnMatch[0]); // entire <button>...</button> block
  }

  let unlabeledButtons = 0;
  for (const block of buttonBlocks) {
    // extract inner text of button by stripping tags
    const innerMatch = /<button\b[^>]*>([\s\S]*?)<\/button>/i.exec(block);
    const innerHtml = innerMatch ? innerMatch[1] : "";
    const visibleText = innerHtml
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const ariaLabelMatchDouble = block.match(/\baria-label\s*=\s*"([^"]*)"/i);
    const ariaLabelMatchSingle = block.match(/\baria-label\s*=\s*'([^']*)'/i);
    const ariaVal = ariaLabelMatchDouble
      ? ariaLabelMatchDouble[1]
      : ariaLabelMatchSingle
      ? ariaLabelMatchSingle[1]
      : null;

    if ((!visibleText || visibleText.length === 0) && (!ariaVal || ariaVal.length === 0)) {
      unlabeledButtons++;
    }
  }

  // Heading order check:
  // We walk all <h1>..<h6> in appearance order and flag big jumps
  const headingRegex = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const headingLevels = [];
  let hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null) {
    const tagName = hMatch[1].toLowerCase(); // "h2", etc.
    const level = parseInt(tagName.replace("h", ""), 10);
    headingLevels.push(level);
  }

  let headingOrderIssues = 0;
  for (let i = 1; i < headingLevels.length; i++) {
    const prev = headingLevels[i - 1];
    const curr = headingLevels[i];
    // We consider a "jump" if it skips more than 2 levels
    // e.g. h2 -> h5
    if (curr - prev > 2) {
      headingOrderIssues++;
    }
  }

  // Score heuristic (0–100)
  let accessibilityScore = 100;
  if (h1Count === 0) accessibilityScore -= 10;
  if (h1Count > 1) accessibilityScore -= 10;
  accessibilityScore -= imagesMissingAlt * 2;
  accessibilityScore -= unlabeledButtons * 3;
  accessibilityScore -= headingOrderIssues * 5;
  if (accessibilityScore < 0) accessibilityScore = 0;

  // Human-readable notes for the marketer / content owner
  const notes = [];

  if (h1Count === 0) {
    notes.push("No <h1> found — every page should have a single main heading.");
  } else if (h1Count > 1) {
    notes.push("Multiple <h1> elements found — usually you only want one.");
  } else {
    notes.push("Single <h1> present ✅");
  }

  if (imagesMissingAlt > 0) {
    notes.push(`${imagesMissingAlt} image(s) missing alt text.`);
  } else {
    notes.push("All images appear to include alt text ✅");
  }

  if (unlabeledButtons > 0) {
    notes.push(
      `${unlabeledButtons} <button> element(s) have no visible text or aria-label.`
    );
  } else {
    notes.push("All buttons appear to have labels or aria-labels ✅");
  }

  if (headingOrderIssues > 0) {
    notes.push(
      `${headingOrderIssues} heading level jump(s) detected (e.g. h2 → h5).`
    );
  } else {
    notes.push("Heading level progression mostly looks consistent ✅");
  }

  // Final structured result
  return {
    url,
    h1Count,
    imagesMissingAlt,
    unlabeledButtons,
    headingOrderIssues,
    accessibilityScore,
    notes
  };
}

// Register the tools using decorators with explicit parameter definitions
(0, opal_tools_sdk_1.tool)({
    name: 'content_density_evaluator',
    description: 'Analyses a web page for content density',
    parameters: [
        {
            name: 'url',
            type: opal_tools_sdk_1.ParameterType.String,
            description: 'URL to analyse',
            required: true
        },
    ]
})(content_density_evaluator);

// Register the tools using decorators with explicit parameter definitions
(0, opal_tools_sdk_1.tool)({
    name: 'accessibility_surface_check',
    description: 'Analyses a web page for basics of accessibility',
    parameters: [
        {
            name: 'url',
            type: opal_tools_sdk_1.ParameterType.String,
            description: 'URL to analyse',
            required: true
        },
    ]
})(accessibility_surface_check);

// Register the tools using decorators with explicit parameter definitions
(0, opal_tools_sdk_1.tool)({
    name: 'sgc_greeting',
    description: 'Greets a person in a random language (English, Spanish, or French)',
    parameters: [
        {
            name: 'name',
            type: opal_tools_sdk_1.ParameterType.String,
            description: 'Name of the person to greet',
            required: true
        },
        {
            name: 'language',
            type: opal_tools_sdk_1.ParameterType.String,
            description: 'Language for greeting (defaults to random)',
            required: false
        }
    ]
})(sgc_greeting);
(0, opal_tools_sdk_1.tool)({
    name: 'sgc_todays_date',
    description: 'Returns today\'s date in the specified format',
    parameters: [
        {
            name: 'format',
            type: opal_tools_sdk_1.ParameterType.String,
            description: 'Date format (defaults to ISO format)',
            required: false
        }
    ]
})(sgc_todays_Date);
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Discovery endpoint: http://localhost:${PORT}/discovery`);
});
