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

const huntId = 'hunt_utrecht_classic'

const clues = [
  {
    id: 'clue_1',
    order: 1,
    icon: '🗼',
    theme: 'Medieval giant',
    riddle: "I have stood guard over Utrecht for over 600 years. At 112 metres I am the tallest church tower in the Netherlands — though my nave was blown away by a storm in 1674. Find my base.",
    locationName: 'Dom Tower',
    lat: 52.09079, lng: 5.12133, radiusM: 45,
    hint1: "You're looking for Utrecht's most famous landmark, right in the old city centre. Look for the Gothic spire rising above the rooftops.",
    hint2: 'Head to Domplein square. The tower is free-standing — the nave that once connected it to the cathedral collapsed in the 1674 tornado.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
    funFact: 'The Dom Tower took 60 years to build (1321–1382) and has 465 steps to the top. During WWII, the tower was used as a hiding spot for resistance fighters. The bells inside include a 13th-century carillon that still plays every 15 minutes — one of the oldest in the world. The tornado that destroyed the nave in 1674 was one of the most powerful ever recorded in the Netherlands.',
    trivia: {
      question: 'How many steps does it take to reach the top of the Dom Tower?',
      options: ['265', '365', '465', '565'],
      correctIndex: 2,
      explain: '465 steps — and the view from the top stretches 50 km on a clear day.',
    },
  },
  {
    id: 'clue_2',
    order: 2,
    icon: '🚤',
    theme: 'Two-level canal',
    riddle: "For seven centuries I have been the main artery of Utrecht, a canal lined with two-level wharves. The lower level — once used to unload boats — now holds restaurants and cafes. Find my stone steps down to the water.",
    locationName: 'Oudegracht canal wharf',
    lat: 52.09141, lng: 5.11861, radiusM: 50,
    hint1: "You're looking for a long canal that runs through the heart of the old town. It's the most photographed street in Utrecht.",
    hint2: 'Find the Oudegracht — look for the distinctive double-level street with arched cellars opening onto the water. The stone steps are near the Vismarkt end.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
    funFact: 'The Oudegracht is completely unique in Europe — no other city has this two-level wharf system. The lower wharves were built in the 13th century so merchants could unload goods directly from boats into cellars. During summer, the canal transforms into a floating terrace with restaurants serving food literally at water level. In medieval times, this canal connected to the Rhine river and was Utrecht\'s main trade route.',
    trivia: {
      question: 'What made the Oudegracht\'s double-level design necessary?',
      options: ['Flood protection', 'Direct boat-to-cellar trade', 'Defensive moat', 'Carriage parking'],
      correctIndex: 1,
      explain: 'Merchants unloaded boats straight into their warehouse cellars — faster trade, less theft.',
    },
  },
  {
    id: 'clue_3',
    order: 3,
    icon: '🌿',
    theme: 'Hidden cloister',
    riddle: "I am one of Utrecht's best-kept secrets: a 14th-century garden cloister hidden behind the Dom. Most tourists walk right past my entrance. Listen for the birdsong.",
    locationName: 'Pandhof garden',
    lat: 52.09027, lng: 5.12186, radiusM: 35,
    hint1: "You're looking for a hidden courtyard garden very close to the Dom Tower — the entrance is easy to miss.",
    hint2: 'Walk around the south side of the Dom. Look for a low archway in the cathedral chapter wall leading into a peaceful square garden with a central lawn.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
    funFact: 'The Pandhof dates to 1390 and is one of the oldest cloister gardens in the Netherlands. Monks used to grow medicinal herbs here. The garden survived the 1674 tornado that destroyed the cathedral nave — partly because the thick cloister walls shielded it. Today it\'s home to over 100 plant species, including some descended from the original medieval herb garden. On quiet mornings you can hear the Dom Tower carillon echoing off the ancient stone walls.',
    trivia: {
      question: 'What did medieval monks originally grow in the Pandhof?',
      options: ['Grapes for wine', 'Medicinal herbs', 'Tulips', 'Vegetables for market'],
      correctIndex: 1,
      explain: 'Herbs for healing — the cloister was effectively the city\'s pharmacy.',
    },
  },
  {
    id: 'clue_4',
    order: 4,
    icon: '🎵',
    theme: 'Self-playing music',
    riddle: "I am a museum that celebrates mechanical music — from tiny music boxes to enormous fairground organs. My collection plays itself. Come find me on a canal street east of the Dom.",
    locationName: 'Museum Speelklok',
    lat: 52.09248, lng: 5.12201, radiusM: 40,
    hint1: "You're looking for a museum on one of the canal streets a few minutes' walk north-east of the Dom Tower.",
    hint2: 'Head to Steenweg. Museum Speelklok is housed in a former church — look for the historic facade with the museum signs. The street runs parallel to the Oudegracht.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
    funFact: 'Museum Speelklok houses the world\'s most important collection of automatically playing musical instruments — from a 9th-century water organ design to enormous 20th-century dance hall organs. The star of the collection is a massive Decap dance organ that fills an entire room. The museum is housed in the medieval Buurkerk, Utrecht\'s oldest parish church (built 1100 AD). During tours, staff actually play the instruments — the sound of a full fairground organ in a stone church is an experience you won\'t forget.',
    trivia: {
      question: 'What building houses Museum Speelklok?',
      options: ['A Gothic cathedral', 'Utrecht\'s oldest parish church', 'A former train station', 'A 17th-century granary'],
      correctIndex: 1,
      explain: 'The Buurkerk, built around 1100 AD — older than the Dom itself.',
    },
  },
  {
    id: 'clue_5',
    order: 5,
    icon: '💐',
    theme: 'Flower square',
    riddle: "Each Saturday morning my square fills with tulips, peonies and roses. A medieval church watches over the market, and on weekdays students spill out of its shadow onto sunny café terraces. Find my central fountain.",
    locationName: 'Janskerkhof',
    lat: 52.09269, lng: 5.12484, radiusM: 40,
    hint1: "You're looking for a lively square north-east of the Dom that hosts a famous Saturday flower market.",
    hint2: 'Head to Janskerkhof — a broad square dominated by the Janskerk (Saint John\'s Church). Look for the raised planting beds and the outdoor café ring.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
    funFact: 'The Janskerk was founded in 1040 and is the second-oldest church in Utrecht after the Buurkerk. The square was originally the church\'s graveyard — "Janskerkhof" literally means "John\'s church yard". Every Saturday since 1597, farmers have sold flowers here — making it one of the longest-running flower markets in Europe. Napoleon\'s troops used the church as a stables in 1807, and cannonball damage is still visible on the outside wall.',
    trivia: {
      question: 'What did "Janskerkhof" originally mean?',
      options: ['John\'s garden', 'John\'s church yard (cemetery)', 'John\'s market', 'John\'s harbour'],
      correctIndex: 1,
      explain: '"Kerkhof" means graveyard — this whole square was once a cemetery.',
    },
  },
  {
    id: 'clue_6',
    order: 6,
    icon: '🐰',
    theme: 'Children\'s icon',
    riddle: "A little white rabbit was born in this city in 1955 and became famous across the world. A bronze statue of her sits on a square named in her honour. Find her — she is small, easy to miss, but much loved by children.",
    locationName: 'Nijntje Pleintje',
    lat: 52.08821, lng: 5.11930, radiusM: 35,
    hint1: "You're looking for a small square named after a beloved Dutch children\'s character — a simple rabbit drawn in black lines.",
    hint2: 'Head south-west of the Dom toward the Catharijnesingel area. Nijntje Pleintje sits between Mariaplaats and the canal — look for a low bronze statue of Miffy (Nijntje in Dutch).',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
    funFact: 'Miffy — Nijntje in Dutch — was created by Utrecht illustrator Dick Bruna in 1955, after he saw a rabbit hopping in the dunes on holiday with his son. Over 85 million Miffy books have been sold in more than 50 languages. Utrecht has an entire Miffy Museum (Nijntje Museum) and even Miffy-themed traffic lights near the station. The bronze statue on Nijntje Pleintje was unveiled in 2006 and has become a pilgrimage site for families — children often leave flowers or drawings at her feet.',
    trivia: {
      question: 'In what year was Miffy (Nijntje) created?',
      options: ['1935', '1955', '1975', '1995'],
      correctIndex: 1,
      explain: '1955 — Dick Bruna sketched her after a family holiday on the Dutch coast.',
    },
  },
  {
    id: 'clue_7',
    order: 7,
    icon: '🔭',
    theme: 'Star gazing bastion',
    riddle: "I was built as a 16th-century bastion to defend the city, but three centuries later I became the Netherlands\' first public observatory. Climb my ramparts and you\'ll see old telescopes pointing at the sky.",
    locationName: 'Sonnenborgh Museum & Observatory',
    lat: 52.08470, lng: 5.12979, radiusM: 45,
    hint1: "You're looking for a star-shaped bastion on the eastern edge of the old city, now an observatory museum.",
    hint2: 'Head south-east to the Zonnenburg bastion on the Singel canal ring. Look for the round domes poking up above the grassy ramparts — Sonnenborgh is cut into the old city wall.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
    funFact: 'Sonnenborgh was built in 1552 as part of Utrecht\'s star-shaped defensive wall. In 1853 it became the Netherlands\' first national weather and astronomy institute. Christophorus Buys Ballot — who discovered the famous "Buys Ballot law" about wind direction — worked here. The original 1850s telescope is still operational and used for public stargazing nights. On clear evenings, you can book a viewing slot and see Saturn\'s rings through a 170-year-old lens.',
    trivia: {
      question: 'What famous scientific institute was founded at Sonnenborgh in 1853?',
      options: ['A chemistry lab', 'The Dutch weather & astronomy institute (KNMI)', 'A medical school', 'An engineering academy'],
      correctIndex: 1,
      explain: 'The KNMI — still the Netherlands\' national weather service today.',
    },
  },
  {
    id: 'clue_8',
    order: 8,
    icon: '🏛️',
    theme: 'Modernist masterpiece neighbourhood',
    riddle: "I am a quiet residential street on the edge of Utrecht, but inside me hides a UNESCO World Heritage site — a 1924 house so radical that architects still travel here to study it. Stand at my gate and look up at the red, blue and yellow lines.",
    locationName: 'Rietveld Schröder House',
    lat: 52.08506, lng: 5.14734, radiusM: 60,
    hint1: "You're looking for a 1920s modernist house on the eastern edge of the city, about 1.5 km from the Dom.",
    hint2: 'Head east along Prins Hendriklaan. The Rietveld Schröder House is at number 50 — a white block with bright red, yellow and blue accents that looks unlike anything else on the street.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
    funFact: 'The Rietveld Schröder House (1924) is the only building ever built fully according to the De Stijl movement — the same art school as Piet Mondrian. Designed by Gerrit Rietveld for widow Truus Schröder, the upper floor is entirely open-plan with sliding partitions that can reconfigure the space in seconds. It became a UNESCO World Heritage site in 2000. Truus lived in the house until she died in 1985 — aged 95 — and helped restore it herself. The chair at the entrance — the Red and Blue Chair — is in museum collections worldwide.',
    trivia: {
      question: 'The Rietveld Schröder House is the only building built fully according to which art movement?',
      options: ['Bauhaus', 'Art Deco', 'De Stijl', 'Brutalism'],
      correctIndex: 2,
      explain: 'De Stijl — the same movement as painter Piet Mondrian\'s primary-colour grids.',
    },
  },
]

async function seed() {
  await setDoc(doc(db, 'hunts', huntId), {
    title: 'Utrecht Grand Tour',
    description: 'Eight stops. Medieval giants, hidden gardens, a little rabbit and a UNESCO masterpiece.',
    city: 'Utrecht',
    difficulty: 'medium',
    clueCount: clues.length,
    durationMin: 150,
    distanceKm: 4.2,
    priceEuros: 5,
    rating: 4.9,
    badge: 'Most popular',
    active: true,
    createdAt: serverTimestamp(),
  })

  for (const { id, ...clueData } of clues) {
    await setDoc(doc(db, 'hunts', huntId, 'clues', id), clueData)
  }

  console.log(`Seeded hunt with ${clues.length} clues.`)
  process.exit(0)
}

seed().catch((e) => { console.error(e); process.exit(1) })
