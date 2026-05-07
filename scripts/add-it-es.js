// scripts/add-it-es.js
// Adds Italian and Spanish translations to all i18n blocks in seed.mjs
const fs = require('fs')
const path = require('path')

const seedPath = path.join(__dirname, 'seed.mjs')
let c = fs.readFileSync(seedPath, 'utf8')

// ── Helper: add it/es to city i18n block ──
function addCityItEs(c, cityName, itName, itCountry, itDesc, esName, esCountry, esDesc) {
  // Check if already present
  if (c.includes(`name: '${itName}'`) && c.includes(`name: '${esName}'`)) {
    console.log(`  skip city ${cityName} — it/es already present`)
    return c
  }
  // Find the city block with i18n containing fr: block, insert after it
  const pattern = new RegExp(
    `(name: '${cityName}'.*?fr:\\s*\\{[^}]*?\\})`,
    's'
  )
  if (pattern.test(c)) {
    c = c.replace(
      pattern,
      `$1,\n        it: {\n          name: '${itName}',\n          country: '${itCountry}',\n          description: '${itDesc}',\n        },\n        es: {\n          name: '${esName}',\n          country: '${esCountry}',\n          description: '${esDesc}',\n        }`
    )
    console.log(`  added it/es to city: ${cityName}`)
  }
  return c
}

// ── Helper: add it/es to hunt meta i18n block ──
function addHuntMetaItEs(c, huntId, itTitle, itDesc, itBadge, esTitle, esDesc, esBadge) {
  // Check if already present
  if (c.includes(`title: '${itTitle}'`) && c.includes(`title: '${esTitle}'`)) {
    console.log(`  skip hunt meta ${huntId} — it/es already present`)
    return c
  }
  const pattern = new RegExp(
    `(id: '${huntId}'.*?fr:\\s*\\{[^}]*?badge: '.*?'\\})`,
    's'
  )
  if (pattern.test(c)) {
    c = c.replace(
      pattern,
      `$1,\n        it: {\n          title: '${itTitle}',\n          description: '${itDesc}',\n          badge: '${itBadge}',\n        },\n        es: {\n          title: '${esTitle}',\n          description: '${esDesc}',\n          badge: '${esBadge}',\n        }`
    )
    console.log(`  added it/es to hunt meta: ${huntId}`)
  }
  return c
}

console.log('Adding Italian & Spanish translations...\n')

// ── Cities ──
// Utrecht (already done manually in earlier edit, skip)
// Amsterdam
c = addCityItEs(c, 'Amsterdam', 'Amsterdam', 'Paesi Bassi', 'La città dei canali, musei mondiali e le case dei mercanti del Secolo d\'Oro che hanno costruito i Paesi Bassi.', 'Ámsterdam', 'Países Bajos', 'La ciudad de los canales, museos mundiales y las casas de los comerciantes del Siglo de Oro que construyeron los Países Bajos.')

// ── Hunt metas ──
// Utrecht Classic (already done manually, skip)
// Hidden Utrecht
c = addHuntMetaItEs(c, 'hunt_utrecht_hidden', 'Utrecht Nascosta', 'Sette segreti che le guide turistiche hanno dimenticato. Vicoli medievali, un palazzo papale, una cripta romanica e il primo grande magazzino dei Paesi Bassi.', 'Scelta dei locali', 'Utrecht Oculta', 'Siete secretos que las guías turísticas olvidaron. Callejuelas medievales, un palacio papal, una cripta románica y el primer gran almacén de los Países Bajos.', 'Favorito de los locales')

// Canals & Cafés
c = addHuntMetaItEs(c, 'hunt_utrecht_canals', 'Canali & Caffè', 'Una passeggiata rilassante di sei tappe lungo i canali di Utrecht. Perfetta per un pomeriggio di sole — terrazza dopo terrazza, ponte dopo ponte.', 'Preferito della domenica', 'Canales & Cafés', 'Un paseo relajado de seis paradas por los canales de Utrecht. Perfecto para una tarde soleada — terraza tras terraza, puente tras puente.', 'Favorito del domingo')

// Amsterdam Classic
c = addHuntMetaItEs(c, 'hunt_amsterdam_classic', 'Amsterdam Classica', 'Le otto tappe indispensabili. Dal Palazzo Reale ai capolavori di Van Gogh — cammina attraverso 700 anni di gloria del Secolo d\'Oro.', 'Più popolare', 'Amsterdam Clásica', 'Las ocho paradas esenciales. Del Palacio Real a las obras maestras de Van Gogh — camina por 700 años de gloria del Siglo de Oro.', 'Más popular')

console.log('\nWriting updated seed.mjs...')
fs.writeFileSync(seedPath, c, 'utf8')
console.log('Done!')
