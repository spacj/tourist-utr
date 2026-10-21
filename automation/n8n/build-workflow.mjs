// Builds automation/n8n/daily-blog-workflow.json — an n8n workflow that
// writes one sales-focused blog article per day with Gemini, picks a Pexels
// photo, and publishes it to content/blog/ through the GitHub API (Vercel
// then redeploys). The topic plan is generated from the real hunts in
// scripts/seed-data so every article links to something people can play.
//
// Run after adding/removing hunts:  node automation/n8n/build-workflow.mjs
import { writeFileSync } from 'node:fs'
import { HUNTS, CITIES } from '../../scripts/seed-data/index.mjs'

// ── 1. Topic plan ──────────────────────────────────────────────────────
// Each hunt gets several search-intent angles. The workflow walks the list
// one per day (cities interleaved), then starts again with the next angle.
const cityName = id => CITIES.find(c => c.id === id)?.name ?? id
const active = HUNTS.filter(h => {
  const c = CITIES.find(x => x.id === h.meta.cityId)
  return c && c.active !== false && h.meta.active !== false
})

const slugify = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)

function anglesFor(h) {
  const city = cityName(h.meta.cityId)
  const isTour = h.meta.tourType === 'tour'
  const theme = h.meta.title.replace(/^[^:]+:\s*/, '')
  const base = [
    {
      keyword: isTour ? `${city} food and drink guide` : `things to do in ${city}`,
      angle: isTour
        ? `A local-style guide to an evening of eating and drinking in ${city}, structured around the stops of the "${h.meta.title}" self-guided tour.`
        : `The best things to do in ${city} on foot in one afternoon, built around the "${h.meta.title}" puzzle walk.`,
      category: 'guides',
    },
    {
      keyword: `${city} self-guided walking tour`,
      angle: `Why a self-guided puzzle walk beats a free walking tour in ${city}: freedom, pace, price and fun — using "${h.meta.title}" as the example.`,
      category: 'guides',
    },
    {
      keyword: `${city} with kids`,
      angle: `A family day out in ${city}: keeping children curious with riddles and a treasure-hunt format on the "${h.meta.title}" route.`,
      category: 'family',
    },
    {
      keyword: `${theme} ${city}`.toLowerCase(),
      angle: `A storytelling article about the theme of "${h.meta.title}" — ${h.meta.description}`,
      category: 'stories',
    },
    {
      keyword: `${city} day trip from Amsterdam`,
      angle: `How to spend a perfect day trip in ${city}: getting there, what to see, where to eat, with "${h.meta.title}" as the backbone of the day.`,
      category: 'itineraries',
    },
  ]
  // Kids angle only for easy/medium hunts; day trip only for Dutch cities other than Amsterdam.
  return base.filter(a =>
    !(a.category === 'family' && h.meta.difficulty === 'hard') &&
    !(a.category === 'itineraries' && (h.meta.cityId === 'city_amsterdam' || !['city_utrecht', 'city_the_hague', 'city_rotterdam', 'city_delft', 'city_leiden', 'city_haarlem'].includes(h.meta.cityId))),
  )
}

// Round-robin across cities so consecutive days never cover the same city.
const byCity = new Map()
for (const h of active) {
  const list = byCity.get(h.meta.cityId) ?? []
  for (const a of anglesFor(h)) list.push({ h, a })
  byCity.set(h.meta.cityId, list)
}
const plan = []
const queues = [...byCity.values()]
while (queues.some(q => q.length)) for (const q of queues) if (q.length) plan.push(q.shift())

const PLAN = plan.map(({ h, a }) => ({
  slug: slugify(`${a.keyword}-${h.meta.title}`),
  keyword: a.keyword,
  angle: a.angle,
  category: a.category,
  cityId: h.meta.cityId,
  city: cityName(h.meta.cityId),
  huntId: h.id,
  huntTitle: h.meta.title,
  huntKind: h.meta.tourType === 'tour' ? 'tour' : 'hunt',
  huntFacts: `${h.meta.description} Duration about ${h.meta.durationMin} minutes, ${h.meta.distanceKm} km, difficulty ${h.meta.difficulty}, ${h.clues.length} stops.`,
  photoQuery: `${cityName(h.meta.cityId)} ${a.category === 'family' ? 'family street' : a.category === 'itineraries' ? 'canal city' : 'old town street'}`,
}))

// ── 2. Code-node sources ───────────────────────────────────────────────
const CONFIG = `// ── Edit these settings ──
return [{ json: {
  githubOwner: 'spacj',
  githubRepo: 'tourist-utr',
  branch: 'master',
  // 'pr' = open a pull request for a quick human check before it goes live (recommended).
  // 'direct' = commit straight to the branch; Vercel publishes it automatically.
  publishMode: 'pr',
  siteUrl: 'https://www.tourhunts.com',
  startDate: '2026-10-22',
  author: 'TourHunts Editorial',
} }]`

const PICK = `// Picks today's brief from the topic plan (generated from the real hunts).
const PLAN = ${JSON.stringify(PLAN, null, 1)};
const cfg = $input.first().json;
const day = Math.floor((Date.now() - Date.parse(cfg.startDate + 'T00:00:00Z')) / 86400000);
const idx = ((day % PLAN.length) + PLAN.length) % PLAN.length;
const brief = PLAN[idx];
const today = new Date().toISOString().slice(0, 10);
return [{ json: { ...cfg, brief, today, slug: brief.slug, path: 'content/blog/' + brief.slug + '.md' } }];`

const SYSTEM = `You write for TourHunts, a small company from Utrecht that makes self-guided GPS puzzle walks: each stop is a riddle or cipher about a real place; crack it, walk there, and the phone tells you the story. Pricing: the first hunt is free (any hunt, any city); after that €5 per hunt. Works in the browser, no app; 6 languages.

Voice: first person plural ("we"), warm, specific, a little dry humour, like a friend who lives there. Concrete details over adjectives. British English.
Never use: "hidden gem", "embark", "journey", "unforgettable", "immerse", "seamless", "nestled", "bustling", "vibrant tapestry", "must-see", "in today's fast-paced world", "whether you're", "look no further", "elevate", "delve".
Facts: only state facts that are well known or given in the brief. Do NOT invent prices, opening hours, dates, numbers, names of businesses or quotes. If unsure, describe instead of quantify.
Selling: the article must be genuinely useful on its own; mention TourHunts naturally 2–3 times at most, always tied to the hunt in the brief. No fake reviews, ratings or testimonials.`

const PROMPT = `// Builds the Gemini request for today's brief.
const b = $json.brief;
const prompt = [
  'Write a blog article.',
  'Primary keyword (use naturally in the title, first paragraph and one heading): ' + b.keyword,
  'Angle: ' + b.angle,
  'City: ' + b.city,
  'The TourHunts route this article should lead readers to: "' + b.huntTitle + '". Facts you may use about it: ' + b.huntFacts,
  'Length: 900–1300 words in total. 5 to 7 sections with H2-style headings (no numbering in headings unless it is a list article).',
  'Each section body is Markdown paragraphs; you may use short bullet lists and **bold**. No tables, no images, no H1, no links.',
  'End with a short practical section (getting there, best time, what to bring).',
].join('\\n');
const schema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'SEO title, max 65 characters' },
    excerpt: { type: 'STRING', description: 'Meta description, 120-160 characters, includes the keyword' },
    heroAlt: { type: 'STRING', description: 'Alt text for a photo of the city, max 110 characters' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    intro: { type: 'STRING', description: 'Opening 2 paragraphs in Markdown' },
    sections: { type: 'ARRAY', items: { type: 'OBJECT', properties: { heading: { type: 'STRING' }, body: { type: 'STRING' } }, required: ['heading', 'body'] } },
  },
  required: ['title', 'excerpt', 'heroAlt', 'tags', 'intro', 'sections'],
};
return [{ json: { ...$json, geminiBody: {
  systemInstruction: { parts: [{ text: ${JSON.stringify(SYSTEM)} }] },
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: { temperature: 0.8, responseMimeType: 'application/json', responseSchema: schema },
} } }];`

const BUILD = `// Validates Gemini's article and assembles the Markdown file.
const ctx = $('Build prompt').first().json;
const b = ctx.brief;
const raw = $json.candidates?.[0]?.content?.parts?.[0]?.text;
if (!raw) throw new Error('Gemini returned no text: ' + JSON.stringify($json).slice(0, 500));
const a = JSON.parse(raw);

const BANNED = ['hidden gem', 'embark', 'journey', 'unforgettable', 'immerse', 'seamless', 'nestled', 'bustling', 'tapestry', 'must-see', 'fast-paced', 'look no further', 'elevate', 'delve'];
const all = [a.title, a.excerpt, a.intro, ...a.sections.map(s => s.heading + ' ' + s.body)].join(' ');
const hits = BANNED.filter(w => all.toLowerCase().includes(w));
const words = all.split(/\\s+/).length;
const problems = [];
if (hits.length) problems.push('banned words: ' + hits.join(', '));
if (words < 700 || words > 1800) problems.push('word count ' + words);
if (a.sections.length < 4) problems.push('only ' + a.sections.length + ' sections');
if (/€\\s?\\d|\\d+\\s?euro/i.test(all.replace(/€\\s?5\\b/g, ''))) problems.push('mentions a price other than €5');
if (problems.length) throw new Error('Article rejected: ' + problems.join('; '));

const clean = s => String(s).replace(/\`\`\`/g, '').replace(/^#\\s.*$/gm, '').trim();
const ctaHunt = { kind: b.huntKind, targetId: b.huntId,
  title: (b.huntKind === 'tour' ? 'Do it yourself: ' : 'Play it: ') + b.huntTitle,
  description: 'Self-guided, at your own pace, in your browser. Your first hunt is free — after that €5.' };
const ctaCity = { kind: 'city', targetId: b.cityId,
  title: 'All TourHunts in ' + b.city,
  description: 'Pick any hunt — the first one is on us.' };
const cta = c => '\`\`\`cta\\n' + JSON.stringify(c, null, 2) + '\\n\`\`\`';

const parts = [clean(a.intro)];
a.sections.forEach((s, i) => {
  parts.push('## ' + clean(s.heading).replace(/^#+\\s*/, '') + '\\n\\n' + clean(s.body));
  if (i === 1) parts.push(cta(ctaHunt));
});
parts.push(cta(ctaCity));

const tags = [...new Set([b.city, ...(a.tags || []).slice(0, 6)])];
return [{ json: { ...ctx, article: {
  title: String(a.title).slice(0, 80),
  excerpt: String(a.excerpt).slice(0, 170),
  heroAlt: String(a.heroAlt).slice(0, 120),
  tags, body: parts.join('\\n\\n'), words,
  readMinutes: Math.max(3, Math.round(words / 220)),
} } }];`

const PHOTO = `// Picks a landscape Pexels photo (varied by day) and writes the final file.
const ctx = $('Build article').first().json;
const art = ctx.article;
const photos = ($json.photos || []).filter(p => p.width > p.height);
if (!photos.length) throw new Error('No Pexels photo for: ' + ctx.brief.photoQuery);
const day = Math.floor(Date.now() / 86400000);
const p = photos[day % photos.length];
// The blog's frontmatter parser doesn't unescape, so use typographic quotes.
const q = s => '"' + String(s).replace(/"([^"]*)"/g, '“$1”').replace(/"/g, '”').replace(/\\\\/g, '').trim() + '"';
const fm = [
  '---',
  'title: ' + q(art.title),
  'excerpt: ' + q(art.excerpt),
  'publishedAt: ' + q(ctx.today),
  'author: ' + q(ctx.author),
  'category: ' + q(ctx.brief.category),
  'tags: [' + art.tags.map(t => String(t).replace(/[\\[\\],]/g, '')).join(', ') + ']',
  'heroImage: ' + q(p.src.large2x || p.src.large),
  'heroAlt: ' + q(art.heroAlt),
  'readMinutes: ' + art.readMinutes,
  'relatedCities: [' + ctx.brief.cityId + ']',
  'relatedHunts: [' + ctx.brief.huntId + ']',
  '---',
].join('\\n');
const credit = '\\n\\n*Photo: [' + p.photographer + '](' + p.photographer_url + ') on [Pexels](' + p.url + ')*\\n';
const markdown = fm + '\\n\\n' + art.body + credit;
const message = 'Blog: ' + art.title;
const content = Buffer.from(markdown, 'utf8').toString('base64');
return [{ json: { ...ctx, markdown, message, content, prBranch: 'blog/' + ctx.slug } }];`

// ── 3. Nodes ───────────────────────────────────────────────────────────
const gh = (name, method, url, position, extra = {}) => ({
  id: slugify(name), name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position,
  parameters: {
    method, url,
    authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'Accept', value: 'application/vnd.github+json' },
      { name: 'User-Agent', value: 'tourhunts-n8n' },
    ] },
    ...extra,
    options: { response: { response: { neverError: true, fullResponse: true } } },
  },
  credentials: { httpHeaderAuth: { id: '', name: 'GitHub token' } },
})
const code = (name, jsCode, position) => ({
  id: slugify(name), name, type: 'n8n-nodes-base.code', typeVersion: 2, position, parameters: { jsCode },
})
const ifNode = (name, left, op, right, type, position) => ({
  id: slugify(name), name, type: 'n8n-nodes-base.if', typeVersion: 2, position,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: [{ id: slugify(name) + '-c', leftValue: left, rightValue: right, operator: { type, operation: op } }],
      combinator: 'and',
    },
    options: {},
  },
})
const body = expr => ({ sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${expr}) }}` })
const repo = `https://api.github.com/repos/{{ $('Config').first().json.githubOwner }}/{{ $('Config').first().json.githubRepo }}`

const nodes = [
  { id: 'daily', name: 'Every day 07:00', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 300],
    parameters: { rule: { interval: [{ triggerAtHour: 7 }] } } },
  code('Config', CONFIG, [220, 300]),
  code("Pick today's topic", PICK, [440, 300]),
  gh('Already published?', 'GET', `=${repo}/contents/{{ $json.path }}?ref={{ $json.branch }}`, [660, 300]),
  ifNode('Is new?', '={{ $json.statusCode }}', 'equals', 404, 'number', [880, 300]),
  code('Build prompt', PROMPT.replace('$json.brief', "$('Pick today\\'s topic').first().json.brief").replace('...$json,', "...$('Pick today\\'s topic').first().json,"), [1100, 280]),
  { id: 'gemini', name: 'Gemini: write article', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1320, 280],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      ...body('$json.geminiBody'),
      options: { timeout: 120000 },
    },
    credentials: { httpHeaderAuth: { id: '', name: 'Gemini API key' } } },
  code('Build article', BUILD, [1540, 280]),
  { id: 'pexels', name: 'Pexels: find photo', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1760, 280],
    parameters: {
      method: 'GET', url: 'https://api.pexels.com/v1/search',
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendQuery: true,
      queryParameters: { parameters: [
        { name: 'query', value: '={{ $json.brief.photoQuery }}' },
        { name: 'orientation', value: 'landscape' },
        { name: 'per_page', value: '20' },
      ] },
      options: {},
    },
    credentials: { httpHeaderAuth: { id: '', name: 'Pexels API key' } } },
  code('Assemble file', PHOTO, [1980, 280]),
  ifNode('Review first?', "={{ $json.publishMode }}", 'equals', 'pr', 'string', [2200, 280]),
  // Review path: branch → file → pull request
  gh('Get branch head', 'GET', `=${repo}/git/ref/heads/{{ $json.branch }}`, [2420, 140]),
  gh('Create review branch', 'POST', `=${repo}/git/refs`, [2640, 140],
    body("{ ref: 'refs/heads/' + $('Assemble file').first().json.prBranch, sha: $json.body.object.sha }")),
  gh('Add article to branch', 'PUT', `=${repo}/contents/{{ $('Assemble file').first().json.path }}`, [2860, 140],
    body("{ message: $('Assemble file').first().json.message, content: $('Assemble file').first().json.content, branch: $('Assemble file').first().json.prBranch }")),
  gh('Open pull request', 'POST', `=${repo}/pulls`, [3080, 140],
    body("{ title: $('Assemble file').first().json.message, head: $('Assemble file').first().json.prBranch, base: $('Assemble file').first().json.branch, body: 'Daily article for **' + $('Assemble file').first().json.brief.keyword + '** → links to ' + $('Assemble file').first().json.brief.huntTitle + '.\\n\\nMerge to publish (Vercel deploys automatically). Check facts and the photo first.' }")),
  // Direct path
  gh('Publish directly', 'PUT', `=${repo}/contents/{{ $json.path }}`, [2420, 420],
    body('{ message: $json.message, content: $json.content, branch: $json.branch }')),
]

const connections = {
  'Every day 07:00': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
  Config: { main: [[{ node: "Pick today's topic", type: 'main', index: 0 }]] },
  "Pick today's topic": { main: [[{ node: 'Already published?', type: 'main', index: 0 }]] },
  'Already published?': { main: [[{ node: 'Is new?', type: 'main', index: 0 }]] },
  'Is new?': { main: [[{ node: 'Build prompt', type: 'main', index: 0 }], []] },
  'Build prompt': { main: [[{ node: 'Gemini: write article', type: 'main', index: 0 }]] },
  'Gemini: write article': { main: [[{ node: 'Build article', type: 'main', index: 0 }]] },
  'Build article': { main: [[{ node: 'Pexels: find photo', type: 'main', index: 0 }]] },
  'Pexels: find photo': { main: [[{ node: 'Assemble file', type: 'main', index: 0 }]] },
  'Assemble file': { main: [[{ node: 'Review first?', type: 'main', index: 0 }]] },
  'Review first?': { main: [
    [{ node: 'Get branch head', type: 'main', index: 0 }],
    [{ node: 'Publish directly', type: 'main', index: 0 }],
  ] },
  'Get branch head': { main: [[{ node: 'Create review branch', type: 'main', index: 0 }]] },
  'Create review branch': { main: [[{ node: 'Add article to branch', type: 'main', index: 0 }]] },
  'Add article to branch': { main: [[{ node: 'Open pull request', type: 'main', index: 0 }]] },
}

const workflow = {
  name: 'TourHunts — daily blog article',
  nodes, connections,
  settings: { executionOrder: 'v1', timezone: 'Europe/Amsterdam' },
  pinData: {},
}

writeFileSync(new URL('./daily-blog-workflow.json', import.meta.url), JSON.stringify(workflow, null, 2) + '\n')
console.log(`Wrote daily-blog-workflow.json — ${PLAN.length} topics (≈${PLAN.length} days before the first repeat).`)
