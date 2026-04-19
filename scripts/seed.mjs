import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, collection, serverTimestamp } from 'firebase/firestore'
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
    riddle: "I have stood guard over Utrecht for over 600 years. At 112 metres I am the tallest church tower in the Netherlands — though my nave was blown away by a storm in 1674. Find my base.",
    locationName: 'Dom Tower',
    lat: 52.09079, lng: 5.12133, radiusM: 45,
    hint1: "You're looking for Utrecht's most famous landmark, right in the old city centre. Look for the Gothic spire rising above the rooftops.",
    hint2: 'Head to Domplein square. The tower is free-standing — the nave that once connected it to the cathedral collapsed in the 1674 tornado.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
  },
  {
    id: 'clue_2',
    order: 2,
    riddle: "For seven centuries I have been the main artery of Utrecht, a canal lined with two-level wharves. The lower level — once used to unload boats — now holds restaurants and cafes. Find my stone steps down to the water.",
    locationName: 'Oudegracht canal wharf',
    lat: 52.09141, lng: 5.11861, radiusM: 50,
    hint1: "You're looking for a long canal that runs through the heart of the old town. It's the most photographed street in Utrecht.",
    hint2: 'Find the Oudegracht — look for the distinctive double-level street with arched cellars opening onto the water. The stone steps are near the Vismarkt end.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
  },
  {
    id: 'clue_3',
    order: 3,
    riddle: "I am one of Utrecht's best-kept secrets: a 14th-century garden cloister hidden behind the Dom. Most tourists walk right past my entrance. Listen for the birdsong.",
    locationName: 'Pandhof garden',
    lat: 52.09027, lng: 5.12186, radiusM: 35,
    hint1: "You're looking for a hidden courtyard garden very close to the Dom Tower — the entrance is easy to miss.",
    hint2: 'Walk around the south side of the Dom. Look for a low archway in the cathedral chapter wall leading into a peaceful square garden with a central lawn.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
  },
  {
    id: 'clue_4',
    order: 4,
    riddle: "I am a museum that celebrates mechanical music — from tiny music boxes to enormous fairground organs. My collection plays itself. Come find me on a canal street east of the Dom.",
    locationName: 'Museum Speelklok',
    lat: 52.09248, lng: 5.12201, radiusM: 40,
    hint1: "You're looking for a museum on one of the canal streets a few minutes' walk north-east of the Dom Tower.",
    hint2: 'Head to Steenweg. Museum Speelklok is housed in a former church — look for the historic facade with the museum signs. The street runs parallel to the Oudegracht.',
    hint2PhotoUrl: null,
    hint3: 'Static fallback — live GPS nudge computed from server.',
  },
]

async function seed() {
  await setDoc(doc(db, 'hunts', huntId), {
    title: 'Utrecht classics',
    description: '4 iconic spots · ~90 min on foot',
    city: 'Utrecht',
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
