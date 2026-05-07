/**
 * Blog content as typed structured blocks.
 *
 * Why not Markdown? Two reasons:
 *  1. Inline CTAs (<HuntCta />) are first-class instead of being shoehorned
 *     into raw HTML or a custom MDX shortcode pipeline.
 *  2. Zero new dependencies — keeps the bundle small and the build fast.
 *
 * Posts here are server-rendered so search engines see the full content;
 * each has its own /blog/[slug] page with Article + Breadcrumb JSON-LD.
 */

export type Block =
  | { type: 'p';           text: string }
  | { type: 'h2';          text: string; id?: string }
  | { type: 'h3';          text: string; id?: string }
  | { type: 'ul';          items: string[] }
  | { type: 'ol';          items: string[] }
  | { type: 'quote';       text: string; cite?: string }
  | { type: 'image';       src: string; alt: string; caption?: string }
  | { type: 'divider' }
  | { type: 'cta';         kind: 'city' | 'hunt' | 'tour' | 'multiplayer'
                           targetId?: string; title?: string; description?: string }

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  /** ISO 8601 date string */
  publishedAt: string
  /** ISO 8601 date string — leave undefined if never updated */
  updatedAt?: string
  /** Author byline */
  author: string
  /** Category for grouping in the index */
  category: 'guides' | 'how-to' | 'inspiration' | 'food' | 'product'
  /** Free-form tags for SEO + future filtering */
  tags: string[]
  /** Hero image URL (Unsplash, Wikimedia Commons, or Cloudinary) */
  heroImage: string
  heroAlt: string
  /** Estimated reading time in minutes */
  readMinutes: number
  /** Cities or hunts this post drives conversions to */
  related: {
    cities?: string[]
    hunts?: string[]
  }
  /** Body — list of structured blocks rendered in order */
  blocks: Block[]
}

// ───────────────────────────────────────────────────────────────────
// 1. Utrecht hidden gems — drives traffic to Utrecht city
// ───────────────────────────────────────────────────────────────────
const utrechtHiddenGems: BlogPost = {
  slug: 'utrecht-hidden-gems-locals-only',
  title: '7 Hidden Utrecht Spots Locals Don\'t Tell Tourists About',
  excerpt: 'Skip the obvious Dom Tower selfie. Here\'s where Utrechters actually spend their afternoons — courtyards, brewery cellars, and a 700-year-old canal trick.',
  publishedAt: '2026-04-21',
  author: 'TourHunts Editorial',
  category: 'guides',
  tags: ['Utrecht', 'Netherlands', 'hidden gems', 'walking tour', 'self-guided'],
  heroImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Utrecht_Domtower_%283%29.jpg/1600px-Utrecht_Domtower_%283%29.jpg',
  heroAlt: 'Utrecht\'s Dom Tower seen from a quiet canal at dusk',
  readMinutes: 6,
  related: { cities: ['city_utrecht'], hunts: ['hunt_utrecht_classic', 'hunt_hidden_utrecht'] },
  blocks: [
    { type: 'p', text: 'Most visitors to Utrecht do the same loop: Dom Tower, Oudegracht, a stroopwafel, done in three hours. Then they head back to Amsterdam thinking they\'ve "seen it." They haven\'t. The Utrecht locals love is in the courtyards behind the cathedral, the wharf cellars two metres below the street, and the bastions where the city walls used to stand.' },
    { type: 'p', text: 'Here are seven spots that almost never make it into a travel guide — and a self-guided GPS hunt that connects them all if you\'d rather have someone (something?) lead the way.' },
    { type: 'h2', text: '1. The Pandhof — a 14th-century cloister hidden behind the Dom', id: 'pandhof' },
    { type: 'p', text: 'Walk past the Dom Tower entrance and most tourists keep going. Slip through the small archway to your left and you\'re in a medieval cloister garden where the cathedral monks once grew medicinal herbs. Birdsong, ivy, and a 700-year-old well. Free, open dawn-to-dusk, and almost always empty.' },
    { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Pandhof_van_de_Domkerk_Utrecht_Belfort_panorama.jpg/1200px-Pandhof_van_de_Domkerk_Utrecht_Belfort_panorama.jpg', alt: 'The Pandhof cloister garden behind Utrecht Cathedral' },
    { type: 'h2', text: '2. The lower wharves of the Oudegracht', id: 'wharves' },
    { type: 'p', text: 'You\'ve seen photos of the Oudegracht — Utrecht\'s long central canal. What the photos don\'t show is the lower level. Two metres below the street, stone steps lead down to a continuous strip of cellar restaurants and tiny terraces right on the water. Built in the 13th century so merchants could unload boats directly into their warehouse cellars. The Netherlands has nothing else like it.' },
    { type: 'h2', text: '3. De Zeven Steegjes', id: 'zeven-steegjes' },
    { type: 'p', text: 'Seven 4-metre-wide alleys, lined with tiny 1830s workers\' cottages, two minutes\' walk from the Dom. Built by a Catholic charity for the city\'s poorest workers. The streets are named after birds. Walk through and it feels like a 19th-century village dropped into the city centre.' },
    { type: 'cta', kind: 'hunt', targetId: 'hunt_hidden_utrecht', title: 'See all 7 + a few more on the Hidden Utrecht hunt', description: '8 lesser-known stops, GPS-guided, with riddles and stories. Pause and resume any time.' },
    { type: 'h2', text: '4. Bastion Lepelenburg', id: 'lepelenburg' },
    { type: 'p', text: 'Utrecht used to have a star-shaped city wall. Most of it was torn down in 1830 — but the bastions were turned into a ring of romantic parks by Jan David Zocher (the man who later designed Amsterdam\'s Vondelpark). Lepelenburg is the most atmospheric. In summer there\'s a free classical music festival here every Sunday afternoon.' },
    { type: 'h2', text: '5. Sonnenborgh — a 16th-century fort that became an observatory', id: 'sonnenborgh' },
    { type: 'p', text: 'The eastern edge of the old city walls. Built in 1552 to defend Utrecht; converted into the Netherlands\' first public observatory in 1854. You can still climb the meteorological tower, look through a 19th-century telescope, and read original weather logs. €4 entry, almost no tourists.' },
    { type: 'h2', text: '6. De Kromme Haring — Utrecht\'s only inner-city brewery', id: 'kromme-haring' },
    { type: 'p', text: 'Three former physics students started brewing experimental wild-fermented beers in a workshop behind a peaked-roof building near the Oudegracht. Their wheat beer is approachable; their seasonal saison sells out within days of release. The tap room is open Thu–Sun.' },
    { type: 'h2', text: '7. Rietveld Schröder House (UNESCO)', id: 'rietveld' },
    { type: 'p', text: 'A 1924 De Stijl modernist house, designed by Gerrit Rietveld and the most influential single building in 20th-century architecture. UNESCO listed. About 1.5 km east of the city centre, mostly unmarked from the street. €19 entry but tickets sell out a week ahead in summer.' },
    { type: 'divider' },
    { type: 'h2', text: 'How to do all 7 in one walk', id: 'how-to-walk' },
    { type: 'p', text: 'Connecting these stops in the right order saves you about 40 minutes of zigzagging. They\'re all within a 4 km loop starting at the Dom Tower. We\'ve mapped a self-guided GPS hunt that strings together the obvious stops from the Utrecht Classic and the deep-cuts from the Hidden Utrecht hunt.' },
    { type: 'cta', kind: 'city', targetId: 'city_utrecht', title: 'Pick your Utrecht hunt', description: 'First hunt is free. Two more for €5 lifetime — including offline GPS, riddles, and stories at every stop.' },
  ],
}

// ───────────────────────────────────────────────────────────────────
// 2. Why self-guided tours beat group tours — broad SEO + product pitch
// ───────────────────────────────────────────────────────────────────
const selfGuidedVsGroup: BlogPost = {
  slug: 'self-guided-tours-vs-group-tours-2026',
  title: 'Self-Guided Tours vs Group Tours: Why Travelers Are Walking Alone in 2026',
  excerpt: 'Group tours hit the same six stops on a 90-minute timer. Self-guided GPS tours let you start when you want, linger where you want, and pay 80% less. Here\'s the actual breakdown.',
  publishedAt: '2026-04-29',
  author: 'TourHunts Editorial',
  category: 'inspiration',
  tags: ['self-guided', 'walking tour', 'travel tips', 'GPS', 'solo travel'],
  heroImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Amsterdam_-_Damrak.jpg/1600px-Amsterdam_-_Damrak.jpg',
  heroAlt: 'Travelers walking through a European city at golden hour',
  readMinutes: 5,
  related: { cities: ['city_utrecht', 'city_amsterdam', 'city_milan', 'city_rome'] },
  blocks: [
    { type: 'p', text: 'A group walking tour in 2026 averages €25 per person, runs at a pace set by the slowest member, and has to fit nine landmarks into a 90-minute slot. Half of every stop is the guide waiting for stragglers; the other half is canned trivia you could find on Wikipedia.' },
    { type: 'p', text: 'A self-guided GPS tour costs around €5 for unlimited replays, runs on your schedule, and lets you stop for an hour at the one spot that actually grabs you. It\'s why download numbers for self-guided apps tripled between 2022 and 2025 while group tour bookings stayed flat.' },
    { type: 'p', text: 'Here\'s the clearheaded comparison.' },
    { type: 'h2', text: 'Cost', id: 'cost' },
    { type: 'p', text: 'Two adults on a typical 2-hour walking tour: €50–€60. Same two adults on a self-guided GPS tour: €5 once, played as many times as you want. If you do more than one tour during a trip — or revisit the city in five years — the math gets very obvious very fast.' },
    { type: 'h2', text: 'Pace', id: 'pace' },
    { type: 'p', text: 'Group tours have to keep moving. If you want to spend twenty minutes inside a basilica, you can\'t. Self-guided is the opposite: linger, double back, skip stops you don\'t care about. The tour adapts to you.' },
    { type: 'h2', text: 'Privacy and language', id: 'privacy' },
    { type: 'p', text: 'On a group tour you\'re standing in a circle of strangers nodding at a guide who is reciting the same speech they gave at 9am. With your phone, you read at your own speed, in your own language, with the volume off if you want. We translate everything into 6 languages — and we\'re adding more.' },
    { type: 'cta', kind: 'tour', targetId: 'tour_milan_aperitivo', title: 'Try the Milan Aperitivo Tour', description: 'A 5-stop self-guided crawl through the most iconic terraces in Milan — first one\'s on us if you\'ve never tried a TourHunts tour.' },
    { type: 'h2', text: 'Storytelling depth', id: 'depth' },
    { type: 'p', text: 'A live guide has 90 seconds per stop. We have as much space as we want — fun facts, photos, optional trivia for points, and audio read-aloud if you don\'t want to look at your phone. People sometimes spend an entire afternoon at a single hunt because the stories keep them digging.' },
    { type: 'h2', text: 'When group tours still win', id: 'when-group-wins' },
    { type: 'p', text: 'Three cases:' },
    { type: 'ul', items: [
      'You want to meet other travelers — a group tour is also a social event',
      'Inside-access museums where a guide can skip the line or get you behind a rope',
      'Topics where local context is irreplaceable — political tours, art-historical deep dives, neighborhood-specific food tours led by a chef'
    ] },
    { type: 'p', text: 'For everything else — first-time visits, return trips, families, off-season exploring, bad weather days — self-guided is the better default in 2026.' },
    { type: 'cta', kind: 'multiplayer', title: 'Or race friends through a hunt', description: 'Real-time multiplayer races. Your friend takes Amsterdam, you take Utrecht — first to all 8 stops wins. Free first hunt in every city.' },
  ],
}

// ───────────────────────────────────────────────────────────────────
// 3. Rome Trastevere food crawl — drives traffic to Rome
// ───────────────────────────────────────────────────────────────────
const romeTrastevere: BlogPost = {
  slug: 'rome-trastevere-food-crawl-locals',
  title: 'Rome After Dark: A 5-Stop Trastevere Food Crawl Locals Actually Do',
  excerpt: 'Skip the spaghetti tourist traps near the Colosseum. The Romans cross the Tiber after sunset for cacio e pepe, gelato that changes daily, and a wine cellar in a 16th-century convent.',
  publishedAt: '2026-05-04',
  author: 'TourHunts Editorial',
  category: 'food',
  tags: ['Rome', 'Italy', 'food tour', 'Trastevere', 'self-guided'],
  heroImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Trastevere_Roma_2018.jpg/1600px-Trastevere_Roma_2018.jpg',
  heroAlt: 'Cobbled streets of Trastevere at dusk',
  readMinutes: 7,
  related: { cities: ['city_rome'], hunts: ['tour_rome_trastevere'] },
  blocks: [
    { type: 'p', text: 'Trastevere — literally "across the Tiber" — is where Romans go to eat when they\'re not at home. It\'s also where they take out-of-town friends when they want to make a point. The cobbles are uneven, the streetlight is low, the trattorias don\'t take reservations after 7pm. It\'s the exact opposite of every restaurant within 800 metres of the Colosseum.' },
    { type: 'p', text: 'If you\'re in Rome for more than two nights, give up one of them to this crawl.' },
    { type: 'h2', text: 'Stop 1 — Vespers at Santa Maria in Trastevere', id: 'santa-maria' },
    { type: 'p', text: 'Get to Trastevere by 6pm. Start at Santa Maria — one of the oldest churches in Rome, with 12th-century mosaics on the façade that catch the last hour of golden-hour light. The nuns sing vespers at 6pm. Sit in the back, listen for fifteen minutes, then walk into the bar across the piazza for an aperitivo. You\'re calibrated.' },
    { type: 'h2', text: 'Stop 2 — Cacio e pepe at Da Enzo al 29', id: 'da-enzo' },
    { type: 'p', text: 'Three minutes\' walk west. Da Enzo is a 30-seat family trattoria where the cacio e pepe arrives at the table still being mixed inside a hollowed pecorino wheel. They don\'t take reservations after 7pm — show up at 6:45 or queue. Anthony Bourdain ate here. The carbonara is also legendary, but cacio e pepe is the move.' },
    { type: 'p', text: 'Budget: €18–€25 per person. Carafes of house wine €6.' },
    { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Cacio_e_pepe.jpg/1200px-Cacio_e_pepe.jpg', alt: 'A plate of cacio e pepe' },
    { type: 'h2', text: 'Stop 3 — Otaleg gelateria (yes, that\'s gelato spelled backwards)', id: 'otaleg' },
    { type: 'p', text: 'Cross Viale Trastevere on your way back east. Otaleg\'s flavors change daily based on what owner Marco Radicioni found at the morning market. Try ricotta-fig if it\'s offered. Marco was named Italy\'s best gelato maker in 2019; he\'s still small enough to not have a queue at 9pm on a weeknight.' },
    { type: 'cta', kind: 'tour', targetId: 'tour_rome_trastevere', title: 'Get the full self-guided crawl', description: 'All 5 stops, GPS-guided, in-app maps, fun facts at every stop. €5 unlocks Rome forever and the first stop is on us.' },
    { type: 'h2', text: 'Stop 4 — Wine cellar at Enoteca Ferrara', id: 'enoteca' },
    { type: 'p', text: 'Wander south into the quieter lanes. Ferrara is a century-old enoteca in a brick-vaulted cellar that used to be part of a 16th-century convent. They stock 1,500+ labels of wine and you can roam the cellar yourself before ordering. Lazio reds by the glass start at €4. The cheese boards are excellent for a second-act dinner.' },
    { type: 'h2', text: 'Stop 5 — Ponte Sisto nightcap', id: 'ponte-sisto' },
    { type: 'p', text: 'End on the bridge. Ponte Sisto is a pedestrian-only span across the Tiber, built in 1479 by Pope Sixtus IV on the foundations of an ancient Roman bridge. A street musician usually plays here past midnight. Stop, look at the city, finish your night.' },
    { type: 'p', text: 'The whole crawl is about 2.2 km of walking, runs from 6pm to roughly midnight, and costs €40–€60 per person depending on how much wine you buy. We\'ve packaged the route as a self-guided GPS tour so you can do it without missing turns or burning data on Google Maps.' },
    { type: 'cta', kind: 'city', targetId: 'city_rome', title: 'Or pick something else in Rome', description: 'Rome on TourHunts is just getting started. The Trastevere tour is live; classic Colosseum + Vatican hunts ship next.' },
  ],
}

export const BLOG_POSTS: BlogPost[] = [
  // Newest first.
  romeTrastevere,
  selfGuidedVsGroup,
  utrechtHiddenGems,
]

export function getPostBySlug(slug: string): BlogPost | null {
  return BLOG_POSTS.find(p => p.slug === slug) ?? null
}
