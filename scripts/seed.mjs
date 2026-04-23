import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { readFileSync } from 'fs'

// Load .env file
const envFile = readFileSync('.env', 'utf8')
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
})

const db = getFirestore(app)

// ══════════════════════════════════════════════════════════════════
// HUNT 1 — Utrecht Classic (8 stops, medium)
// ══════════════════════════════════════════════════════════════════
const utrechtClassic = {
  id: 'hunt_utrecht_classic',
  meta: {
    title: 'Utrecht Classic',
    description: 'The essential eight. From the Dom Tower to a UNESCO masterpiece — walk through 600 years of Utrecht.',
    city: 'Utrecht',
    difficulty: 'medium',
    durationMin: 150,
    distanceKm: 4.2,
    priceEuros: 5,
    rating: 4.9,
    badge: 'Most popular',
  },
  clues: [
    {
      id: 'clue_1', order: 1, icon: '🗼', theme: 'Medieval giant',
      riddle: "I have stood guard over Utrecht for over 600 years. At 112 metres I am the tallest church tower in the Netherlands — though my nave was blown away by a storm in 1674. Find my base.",
      locationName: 'Dom Tower', lat: 52.09079, lng: 5.12133, radiusM: 45,
      hint1: "You're looking for Utrecht's most famous landmark, right in the old city centre. Look for the Gothic spire rising above the rooftops.",
      hint2: 'Head to Domplein square. The tower is free-standing — the nave that once connected it to the cathedral collapsed in the 1674 tornado.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'The Dom Tower took 60 years to build (1321–1382) and has 465 steps to the top. During WWII it was used as a hiding spot for resistance fighters. The 13th-century carillon still plays every 15 minutes — one of the oldest in the world.',
      trivia: { question: 'How many steps does it take to reach the top of the Dom Tower?', options: ['265', '365', '465', '565'], correctIndex: 2, explain: '465 steps — and the view stretches 50 km on a clear day.' },
    },
    {
      id: 'clue_2', order: 2, icon: '🚤', theme: 'Two-level canal',
      riddle: "For seven centuries I have been the main artery of Utrecht, a canal lined with two-level wharves. The lower level — once used to unload boats — now holds restaurants and cafes. Find my stone steps down to the water.",
      locationName: 'Oudegracht canal wharf', lat: 52.09141, lng: 5.11861, radiusM: 50,
      hint1: "You're looking for a long canal that runs through the heart of the old town. It's the most photographed street in Utrecht.",
      hint2: 'Find the Oudegracht — look for the distinctive double-level street with arched cellars opening onto the water.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'The Oudegracht is unique in Europe — no other city has this two-level wharf system. The lower wharves were built in the 13th century so merchants could unload goods directly from boats into cellars.',
      trivia: { question: 'What made the Oudegracht\'s double-level design necessary?', options: ['Flood protection', 'Direct boat-to-cellar trade', 'Defensive moat', 'Carriage parking'], correctIndex: 1, explain: 'Merchants unloaded boats straight into their warehouse cellars — faster trade, less theft.' },
    },
    {
      id: 'clue_3', order: 3, icon: '🌿', theme: 'Hidden cloister',
      riddle: "I am one of Utrecht's best-kept secrets: a 14th-century garden cloister hidden behind the Dom. Most tourists walk right past my entrance. Listen for the birdsong.",
      locationName: 'Pandhof garden', lat: 52.09027, lng: 5.12186, radiusM: 35,
      hint1: "You're looking for a hidden courtyard garden very close to the Dom Tower — the entrance is easy to miss.",
      hint2: 'Walk around the south side of the Dom. Look for a low archway leading into a peaceful square garden with a central lawn.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'The Pandhof dates to 1390 and is one of the oldest cloister gardens in the Netherlands. Monks grew medicinal herbs here. It survived the 1674 tornado that destroyed the cathedral nave.',
      trivia: { question: 'What did medieval monks originally grow in the Pandhof?', options: ['Grapes for wine', 'Medicinal herbs', 'Tulips', 'Vegetables for market'], correctIndex: 1, explain: 'Herbs for healing — the cloister was effectively the city\'s pharmacy.' },
    },
    {
      id: 'clue_4', order: 4, icon: '🎵', theme: 'Self-playing music',
      riddle: "I am a museum that celebrates mechanical music — from tiny music boxes to enormous fairground organs. My collection plays itself.",
      locationName: 'Museum Speelklok', lat: 52.09248, lng: 5.12201, radiusM: 40,
      hint1: "You're looking for a museum on one of the canal streets a few minutes' walk north-east of the Dom Tower.",
      hint2: 'Head to Steenweg. Museum Speelklok is housed in a former church — the medieval Buurkerk.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Museum Speelklok houses the world\'s most important collection of automatically playing musical instruments. It lives inside the Buurkerk — Utrecht\'s oldest parish church, built 1100 AD.',
      trivia: { question: 'What building houses Museum Speelklok?', options: ['A Gothic cathedral', 'Utrecht\'s oldest parish church', 'A former train station', 'A 17th-century granary'], correctIndex: 1, explain: 'The Buurkerk, built around 1100 AD — older than the Dom itself.' },
    },
    {
      id: 'clue_5', order: 5, icon: '💐', theme: 'Flower square',
      riddle: "Each Saturday morning my square fills with tulips, peonies and roses. A medieval church watches over the market, and on weekdays students spill out of its shadow onto sunny café terraces.",
      locationName: 'Janskerkhof', lat: 52.09269, lng: 5.12484, radiusM: 40,
      hint1: "You're looking for a lively square north-east of the Dom that hosts a famous Saturday flower market.",
      hint2: 'Head to Janskerkhof — a broad square dominated by the Janskerk (Saint John\'s Church).',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'The Janskerk was founded in 1040. The square was originally the church\'s graveyard — "Janskerkhof" literally means "John\'s church yard". Farmers have sold flowers here since 1597.',
      trivia: { question: 'What did "Janskerkhof" originally mean?', options: ['John\'s garden', 'John\'s church yard (cemetery)', 'John\'s market', 'John\'s harbour'], correctIndex: 1, explain: '"Kerkhof" means graveyard — this whole square was once a cemetery.' },
    },
    {
      id: 'clue_6', order: 6, icon: '🐰', theme: 'Children\'s icon',
      riddle: "A little white rabbit was born in this city in 1955 and became famous across the world. A bronze statue of her sits on a square named in her honour.",
      locationName: 'Nijntje Pleintje', lat: 52.08821, lng: 5.11930, radiusM: 35,
      hint1: "You're looking for a small square named after a beloved Dutch children\'s character — a simple rabbit drawn in black lines.",
      hint2: 'Head south-west of the Dom toward the Mariaplaats. Nijntje Pleintje sits between Mariaplaats and the canal.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Miffy (Nijntje in Dutch) was created by Utrecht illustrator Dick Bruna in 1955, after he saw a rabbit hopping in the dunes on holiday. Over 85 million Miffy books have been sold in more than 50 languages.',
      trivia: { question: 'In what year was Miffy (Nijntje) created?', options: ['1935', '1955', '1975', '1995'], correctIndex: 1, explain: '1955 — Dick Bruna sketched her after a family holiday on the Dutch coast.' },
    },
    {
      id: 'clue_7', order: 7, icon: '🔭', theme: 'Star-gazing bastion',
      riddle: "I was built as a 16th-century bastion to defend the city, but three centuries later I became the Netherlands\' first public observatory.",
      locationName: 'Sonnenborgh Museum & Observatory', lat: 52.08470, lng: 5.12979, radiusM: 45,
      hint1: "You're looking for a star-shaped bastion on the eastern edge of the old city, now an observatory museum.",
      hint2: 'Head south-east to the Zonnenburg bastion on the Singel canal ring. Look for the round domes poking up above the grassy ramparts.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Sonnenborgh was built in 1552 as part of Utrecht\'s star-shaped defensive wall. In 1853 it became the Netherlands\' first national weather and astronomy institute. The original 1850s telescope is still operational.',
      trivia: { question: 'What famous scientific institute was founded at Sonnenborgh in 1853?', options: ['A chemistry lab', 'The Dutch weather & astronomy institute (KNMI)', 'A medical school', 'An engineering academy'], correctIndex: 1, explain: 'The KNMI — still the Netherlands\' national weather service today.' },
    },
    {
      id: 'clue_8', order: 8, icon: '🏛️', theme: 'Modernist masterpiece',
      riddle: "I am a quiet residential street on the edge of Utrecht, but inside me hides a UNESCO World Heritage site — a 1924 house so radical that architects still travel here to study it.",
      locationName: 'Rietveld Schröder House', lat: 52.08506, lng: 5.14734, radiusM: 60,
      hint1: "You're looking for a 1920s modernist house on the eastern edge of the city, about 1.5 km from the Dom.",
      hint2: 'Head east along Prins Hendriklaan. The Rietveld Schröder House is at number 50 — a white block with bright red, yellow and blue accents.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'The Rietveld Schröder House (1924) is the only building ever built fully according to the De Stijl movement — the same art school as Piet Mondrian. UNESCO World Heritage since 2000.',
      trivia: { question: 'The Rietveld Schröder House is built fully according to which art movement?', options: ['Bauhaus', 'Art Deco', 'De Stijl', 'Brutalism'], correctIndex: 2, explain: 'De Stijl — the same movement as painter Piet Mondrian\'s primary-colour grids.' },
    },
  ],
}

// ══════════════════════════════════════════════════════════════════
// HUNT 2 — Hidden Utrecht (7 stops, hard) — secret gems most tourists miss
// ══════════════════════════════════════════════════════════════════
const hiddenUtrecht = {
  id: 'hunt_utrecht_hidden',
  meta: {
    title: 'Hidden Utrecht',
    description: 'Seven secrets the guidebooks forgot. Medieval alleys, a papal palace, a Romanesque crypt and the first Dutch department store.',
    city: 'Utrecht',
    difficulty: 'hard',
    durationMin: 135,
    distanceKm: 3.5,
    priceEuros: 5,
    rating: 4.8,
    badge: 'Locals\' pick',
  },
  clues: [
    {
      id: 'clue_1', order: 1, icon: '🌹', theme: 'Garden of forgotten roses',
      riddle: "I am a tiny hidden garden tucked into a courtyard, closer to the Dom than most tourists ever get. Pass through an unmarked gate and you\'ll find me — rose bushes, a statue of Willibrord, and near-total silence.",
      locationName: 'Flora\'s Hof', lat: 52.09068, lng: 5.12200, radiusM: 30,
      hint1: 'Search for an unmarked archway very close to the Dom tower — on the side opposite the main square.',
      hint2: 'Look for a narrow passage leading off Servetstraat or Achter de Dom. The gate is painted wrought iron and often open during the day.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Flora\'s Hof sits on the footprint of the medieval bishop\'s palace — gone for 300 years. The statue at its centre honours Saint Willibrord, the English monk who founded Utrecht\'s bishopric in 695 AD. Locals use it as a lunch spot that tourists never find.',
      trivia: { question: 'Who is honoured by the statue in Flora\'s Hof?', options: ['Willem of Orange', 'Saint Willibrord', 'Rembrandt', 'Charlemagne'], correctIndex: 1, explain: 'Willibrord — the English missionary who founded the Utrecht diocese in 695 AD.' },
    },
    {
      id: 'clue_2', order: 2, icon: '⛪', theme: 'Oldest stone in the Netherlands',
      riddle: "I am older than the Dom itself. My Romanesque crypt has stood here since 1048 — nearly a thousand years — and I am one of the oldest stone churches in the Netherlands. Bishop Bernold laid my first stone.",
      locationName: 'Pieterskerk', lat: 52.09194, lng: 5.12360, radiusM: 35,
      hint1: 'You\'re looking for a small Romanesque church on a quiet square east of the Dom.',
      hint2: 'Head to Pieterskerkhof — a serene grassy square hidden behind the cathedral district, lined with old trees.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'The Pieterskerk (1048) is the oldest of four churches built by Bishop Bernold in the shape of a cross around the Dom. The crypt beneath still has its original Romanesque columns. The church survived the 1674 tornado and centuries of Calvinist iconoclasm — it\'s effectively a frozen slice of 11th-century Utrecht.',
      trivia: { question: 'In what year was the Pieterskerk consecrated?', options: ['948', '1048', '1348', '1548'], correctIndex: 1, explain: '1048 — founded by Bishop Bernold as part of a cross of four churches around the Dom.' },
    },
    {
      id: 'clue_3', order: 3, icon: '🏘️', theme: 'Seven tiny alleys',
      riddle: "I am seven narrow parallel streets of tiny brick houses, built for working-class families in the 1830s. Tourists rarely wander into me, but locals still live here, flower boxes on every sill.",
      locationName: 'De Zeven Steegjes', lat: 52.08740, lng: 5.12070, radiusM: 45,
      hint1: 'You\'re looking for a residential neighbourhood of tiny terraced houses south-west of the Dom, between Springweg and Geertebolwerk.',
      hint2: 'Find Springweg and walk south — the seven alleys branch off to the west. Names include Kievitdwarsstraat, Sperwerstraat, Leeuwerikstraat.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'De Zeven Steegjes ("the seven little alleys") were built in 1830–1850 by a Catholic charity to house the city\'s poorest workers. The houses are only 4 metres wide and 50 m² inside. Despite being right next to the city centre, the streets still feel like a 19th-century village — named mostly after birds.',
      trivia: { question: 'Why were the Zeven Steegjes built in the 1830s?', options: ['As student housing', 'Workers\' cottages by a Catholic charity', 'Stable blocks', 'Quarantine housing'], correctIndex: 1, explain: 'Built by a Catholic charity to shelter the city\'s poorest working families.' },
    },
    {
      id: 'clue_4', order: 4, icon: '🏺', theme: 'First Dutch pope',
      riddle: "I am the most beautiful house you\'ve never heard of. A cardinal built me in 1517, intending to retire here. Instead he was elected Pope — the only Dutchman ever — and died in Rome a year later. My rooms are still dressed as he left them.",
      locationName: 'Paushuize', lat: 52.09128, lng: 5.12486, radiusM: 40,
      hint1: 'You\'re looking for a grand Renaissance mansion on a quiet canal east of the Dom.',
      hint2: 'Head to Kromme Nieuwegracht 49. Look for a richly ornamented facade — it\'s the oldest non-religious Renaissance building in the Netherlands.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Paushuize ("Pope\'s House") was built in 1517 for cardinal Adriaan Florisz Boeyens — who was elected Pope Adrian VI in 1522, becoming the first and only Dutch pope. He died in Rome before he could return to Utrecht. The house still features a stone relief of him and is now used for civic receptions.',
      trivia: { question: 'How many Dutch popes have there ever been?', options: ['0', '1', '3', '7'], correctIndex: 1, explain: 'Exactly one — Adrian VI, the cardinal who built this very house.' },
    },
    {
      id: 'clue_5', order: 5, icon: '🏬', theme: 'First department store',
      riddle: "I opened in 1839 as the first department store in the Netherlands — a revolutionary idea at the time. My grand columns were so heavy they had to be floated up the Oudegracht on barges. Today I house a restaurant, but my Doric pillars still stand tall.",
      locationName: 'Winkel van Sinkel', lat: 52.09329, lng: 5.12149, radiusM: 35,
      hint1: 'You\'re looking for a monumental building on the Oudegracht with enormous classical columns at its front.',
      hint2: 'Head to Oudegracht 158. Look for four huge cast-iron caryatid statues framing the entrance — impossible to miss once you see them.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Winkel van Sinkel opened in 1839 and invented the modern department store in the Netherlands — goods sold at fixed prices, no haggling. The four gigantic female statues flanking the entrance were shipped from England; they were so heavy the crane broke while unloading them. That incident created the Dutch saying "daar helpt geen lieve moederen aan" — "even a loving mother can\'t help now."',
      trivia: { question: 'What broke while the famous statues were being unloaded?', options: ['The wharf', 'The crane', 'A barge', 'The front door'], correctIndex: 1, explain: 'The crane snapped — the statues were so heavy it gave birth to a Dutch proverb.' },
    },
    {
      id: 'clue_6', order: 6, icon: '🛡️', theme: 'Secret rampart park',
      riddle: "I am a tiny park on top of a medieval defensive bastion. From my high point you can look down over the Singel canal where warships once patrolled — now only ducks. A single walnut tree grows on my highest corner.",
      locationName: 'Lepelenburg park', lat: 52.08745, lng: 5.12767, radiusM: 50,
      hint1: 'You\'re looking for a small raised park built on the remains of an old bastion in the city wall, south-east of the centre.',
      hint2: 'Head to the eastern part of the Singel canal ring. Lepelenburg is between Maliesingel and Servaasbolwerk — a green mound surrounded by water.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Lepelenburg is one of the last surviving bastions of Utrecht\'s 16th-century star-shaped city wall. When the walls were torn down in 1830, architect Jan David Zocher (who also designed Amsterdam\'s Vondelpark) turned Utrecht\'s bastions into a ring of romantic parks. In summer there\'s a free classical music festival here every Sunday.',
      trivia: { question: 'Who turned Utrecht\'s old bastions into parks in the 19th century?', options: ['Pierre Cuypers', 'Jan David Zocher', 'Gerrit Rietveld', 'Napoleon'], correctIndex: 1, explain: 'Jan David Zocher — the same landscape architect behind Amsterdam\'s Vondelpark.' },
    },
    {
      id: 'clue_7', order: 7, icon: '🍺', theme: 'Where three canals meet',
      riddle: "I am where three canals meet at the southern tip of the old town. Two hundred years ago, my wharf bustled with beer barrels from the breweries nearby. Today I am the heart of Utrecht\'s craft-beer scene.",
      locationName: 'Ledig Erf', lat: 52.08491, lng: 5.12585, radiusM: 45,
      hint1: 'You\'re looking for a square at the confluence of three canals on the southern edge of the old centre.',
      hint2: 'Head south along the Oudegracht until it meets the Vollerstraat and the Tolsteegsingel. The square gets its name from being the "empty yard" at the end of the canal.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Ledig Erf means "empty yard" — it was long an unpaved loading area at the end of the Oudegracht. Today it\'s home to Café Ledig Erf and Kafé België, two of the Netherlands\' most famous craft-beer cafés. On summer Sundays, the square\'s outdoor terraces fill up before noon.',
      trivia: { question: 'What does "Ledig Erf" literally mean?', options: ['Lazy inn', 'Empty yard', 'Water gate', 'Beer market'], correctIndex: 1, explain: 'Empty yard — once the unpaved end of the canal where boats unloaded.' },
    },
  ],
}

// ══════════════════════════════════════════════════════════════════
// HUNT 3 — Canals & Cafés (6 stops, easy) — relaxed afternoon stroll
// ══════════════════════════════════════════════════════════════════
const canalsCafes = {
  id: 'hunt_utrecht_canals',
  meta: {
    title: 'Canals & Cafés',
    description: 'A relaxed six-stop stroll along Utrecht\'s waterways. Perfect for a sunny afternoon — terrace to terrace, bridge to bridge.',
    city: 'Utrecht',
    difficulty: 'easy',
    durationMin: 90,
    distanceKm: 2.4,
    priceEuros: 5,
    rating: 4.7,
    badge: 'Sunday favourite',
  },
  clues: [
    {
      id: 'clue_1', order: 1, icon: '☕', theme: 'Terrace square',
      riddle: "I am Utrecht\'s biggest open square, ringed with café terraces. Locals call me the city\'s living room. On Saturdays a book market spreads across my cobbles.",
      locationName: 'Neude', lat: 52.09345, lng: 5.12105, radiusM: 40,
      hint1: 'You\'re looking for a large cobbled square in the city centre, north of the Dom.',
      hint2: 'Head a few minutes north from the Dom — Neude is surrounded by cafés and anchored by a striking 1917 post-office building, now the city\'s library.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'The old main post office on Neude (1917) was reopened in 2020 as Utrecht\'s Central Library. Inside, you can look up into an Art Deco parabolic ceiling covered in gold leaf. The square has been a marketplace since the 14th century.',
      trivia: { question: 'What is the Neude post-office building now used for?', options: ['A cinema', 'Utrecht\'s Central Library', 'A hotel', 'A parking garage'], correctIndex: 1, explain: 'It became the Central Library in 2020 — free to enter, and the ceiling alone is worth the visit.' },
    },
    {
      id: 'clue_2', order: 2, icon: '🍵', theme: 'Goose market',
      riddle: "My name means Goose Market — though no geese have been sold here for 200 years. Today my terraces overlook a small bridge where accordion players often busk on summer evenings.",
      locationName: 'Ganzenmarkt', lat: 52.09234, lng: 5.12151, radiusM: 35,
      hint1: 'You\'re looking for a small square with a bridge over the Oudegracht, between Neude and the Stadhuis (city hall).',
      hint2: 'Head to the Oudegracht next to Utrecht\'s town hall. The square is tucked on the west side of the canal.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Ganzenmarkt ("Goose Market") has been a marketplace since at least 1358. The Stadhuis (city hall) next door was rebuilt in 1830 in neoclassical style — its back terrace overhangs the canal and is a lovely photo spot at sunset.',
      trivia: { question: 'Which century did geese start being sold at Ganzenmarkt?', options: ['13th', '14th', '16th', '18th'], correctIndex: 1, explain: 'Records mention the market as early as 1358 — the 14th century.' },
    },
    {
      id: 'clue_3', order: 3, icon: '🌉', theme: 'Baker\'s bridge',
      riddle: "I am one of the prettiest bridges on the Oudegracht — photographed a thousand times a day. A bakery stood here in the Middle Ages, and that\'s still my name.",
      locationName: 'Bakkerbrug', lat: 52.09197, lng: 5.12015, radiusM: 30,
      hint1: 'You\'re looking for a small stone bridge over the Oudegracht, close to Utrecht\'s main shopping street.',
      hint2: 'Head to the Oudegracht near Choorstraat. The Bakkerbrug crosses the canal with a cluster of cafés on either side.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Bakkerbrug literally means "Baker\'s bridge" — there was a medieval bakery at its eastern end, and the bridge\'s stones still bear scorch marks from a fire in 1634. The view from Bakkerbrug toward the Dom Tower is the single most photographed vista in Utrecht.',
      trivia: { question: 'What caused the dark scorch marks still visible on the Bakkerbrug stones?', options: ['A 1634 fire', 'World War II bombing', 'Lightning in 1812', 'A 1999 boat crash'], correctIndex: 0, explain: 'A 1634 fire at the bakery beside the bridge — the scorched stones were re-used when the bridge was repaired.' },
    },
    {
      id: 'clue_4', order: 4, icon: '🕊️', theme: 'Quiet sister canal',
      riddle: "I am the Oudegracht\'s quieter, prettier sister. No shops, no tourist boats — just willows, swans and 17th-century patrician houses. Walk my banks for the sound of water and nothing else.",
      locationName: 'Nieuwegracht at Pausdam', lat: 52.08878, lng: 5.12477, radiusM: 45,
      hint1: 'You\'re looking for a quieter canal running parallel to the Oudegracht, one street east.',
      hint2: 'Head to Pausdam — a small square where the Nieuwegracht meets the Kromme Nieuwegracht, next to Paushuize.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'The Nieuwegracht was dug in the 14th century as an "overflow" canal for the Oudegracht. Unlike its rowdy sister, it\'s lined with patrician houses and former convents. At Pausdam you\'ll find the famous Paushuize — home of the only Dutch pope — and one of the narrowest bridges in Utrecht.',
      trivia: { question: 'When was the Nieuwegracht dug?', options: ['12th century', '14th century', '17th century', '19th century'], correctIndex: 1, explain: 'Around the 14th century — as an overflow channel for the busier Oudegracht.' },
    },
    {
      id: 'clue_5', order: 5, icon: '🥐', theme: 'Old market street',
      riddle: "I am a narrow, bustling market street where you can buy everything from cheese to flowers to fresh-baked stroopwafels. On Saturday mornings my wharves become a floating market.",
      locationName: 'Twijnstraat', lat: 52.08722, lng: 5.12434, radiusM: 40,
      hint1: 'You\'re looking for a lively shopping street south of the centre, along the eastern bank of the Oudegracht.',
      hint2: 'Head to Twijnstraat aan de Werf. The street runs parallel to the canal for about 300 metres and is packed with tiny artisanal shops.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: '"Twijn" means "twine" — this was the medieval rope-makers\' quarter. Today Twijnstraat is a foodie pilgrimage: Jordy\'s Bakery, the Mama cheese shop, the famous stroopwafel stand, and a weekly organic farmers\' market on the wharf below.',
      trivia: { question: 'What did "Twijn" originally refer to?', options: ['Twin towers', 'Rope-makers\' trade', 'A type of bread', 'Wooden twin doors'], correctIndex: 1, explain: 'Twine — rope-makers worked here in the Middle Ages.' },
    },
    {
      id: 'clue_6', order: 6, icon: '🍻', theme: 'Three-canal finale',
      riddle: "Three canals meet at my square. Finish your walk with a Belgian beer on the terrace — this is where Utrecht slows down and watches the ducks go by.",
      locationName: 'Ledig Erf', lat: 52.08491, lng: 5.12585, radiusM: 45,
      hint1: 'You\'re looking for a square where three canals come together, at the southern tip of the old town.',
      hint2: 'Continue south along the Oudegracht until it meets the Tolsteegsingel. Ledig Erf sits at the corner.',
      hint3: 'Static fallback — live GPS nudge computed from server.',
      funFact: 'Ledig Erf ("empty yard") is the traditional finish line of a canal walk. Café Ledig Erf and Kafé België between them serve over 300 different beers. On summer evenings, locals bring their own deck chairs and park them along the canal.',
      trivia: { question: 'Between them, roughly how many beers do Ledig Erf\'s two cafés serve?', options: ['30', '100', '300', '1000'], correctIndex: 2, explain: 'Around 300 — from Belgian Trappist to local Utrecht craft beers.' },
    },
  ],
}

// ══════════════════════════════════════════════════════════════════
// Write everything
// ══════════════════════════════════════════════════════════════════
const HUNTS = [utrechtClassic, hiddenUtrecht, canalsCafes]

async function seed() {
  for (const hunt of HUNTS) {
    await setDoc(doc(db, 'hunts', hunt.id), {
      ...hunt.meta,
      clueCount: hunt.clues.length,
      active: true,
      createdAt: serverTimestamp(),
    })
    for (const { id, ...clueData } of hunt.clues) {
      await setDoc(doc(db, 'hunts', hunt.id, 'clues', id), { ...clueData, hint2PhotoUrl: null })
    }
    console.log(`✓ ${hunt.id}: "${hunt.meta.title}" (${hunt.clues.length} clues)`)
  }
  console.log(`\nSeeded ${HUNTS.length} hunts.`)
  process.exit(0)
}

seed().catch((e) => { console.error(e); process.exit(1) })
