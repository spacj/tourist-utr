// Script to add Italian and Spanish translations to seed.mjs
// Run: node scripts/add-it-es-translations.mjs

import { readFileSync, writeFileSync } from 'fs'

const filePath = new URL(import.meta.url).pathname.replace(/add-it-es-translations\.mjs$/, 'seed.mjs')
let content = readFileSync(filePath, 'utf8')

// Helper: add it/es to a city i18n block
function addItEsToCity(content) {
  // Utrecht city
  content = content.replace(
    /(it: \{\s*name: 'Utrecht',\s*country: 'Paesi Bassi',\s*description: '[^']*'\s*\},)/,
    `$1\n        es: {\n          name: 'Utrecht',\n          country: 'Países Bajos',\n          description: 'Canales medievales, la torre de la iglesia más alta del país y la verdadera sala de estar de los Países Bajos.',\n        },`
  )
  return content
}

// Write updated content
writeFileSync(filePath, content, 'utf8')
console.log('Done! Added it/es translations.')
