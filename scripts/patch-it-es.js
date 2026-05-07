// scripts/patch-it-es.js
const fs = require('fs')
const path = require('path')

const seedPath = path.join(__dirname, 'seed.mjs')
let c = fs.readFileSync(seedPath, 'utf8')

console.log('File loaded, length:', c.length)

// ── Utrecht Classic ──
// clue_1: Dom Tower
if (!c.includes("theme: 'Gigante medievale'")) {
  c = c.replace(
    /(fr: \{\s*theme: 'Géant médiéval[\s\S]*?fr: \{\s*theme: 'Géant médiéval'[\s\S]*?)(\s*\},)/,
    `$1,\n        it: {\n          theme: 'Gigante medievale',\n          riddle: 'Faccio la guardia su Utrecht da oltre 600 anni. Con i miei 112 metri sono la torre campanaria più alta dei Paesi Bassi — anche se la mia navata fu spazzata via da una tempesta nel 1674. Trova la mia base.',\n          locationName: 'Torre del Dom',\n          hint1: 'Cerchi il monumento più famoso di Utrecht, nel cuore della vecchia città. Cerca la guglia gotica che si alza sopra i tetti.',\n          hint2: 'Vai a Domplein. La torre è isolata — la navata che un tempo la collegava alla cattedrale crollò nel tornado del 1674.',\n          hint3: 'Testo statico — nudge GPS calcolato dal server.',\n          funFact: 'La Torre del Dom impiegò 60 anni per essere costruita (1321–1382) e ha 465 gradini fino in cima. Durante la seconda guerra mondiale fu usata come nascondiglio per i combattenti della resistenza. Il carillon del XIII secolo suona ancora ogni 15 minuti — uno dei più antichi al mondo.',\n          trivia: { question: 'Quanti gradini ci vogliono per raggiungere la cima della Torre del Dom?', options: ['265', '365', '465', '565'], correctIndex: 2, explain: '465 gradini — e in una giornata serena la vista arriva fino a 50 km.' },\n        },\n        es: {\n          theme: 'Gigante medieval',\n          riddle: 'He guardado Utrecht por más de 600 años. Con mis 112 metros soy el campanario más alto de los Países Bajos — aunque mi nave fue arrastrada por una tormenta en 1674. Encuentra mi base.',\n          locationName: 'Torre del Dom',\n          hint1: 'Busca el monumento más famoso de Utrecht, en el corazón del casco antiguo. Busca la aguja gótica que se alza sobre los tejados.',\n          hint2: 'Dirígete a Domplein. La torre está aislada — la nave que unía con la catedral se derrumbó en el tornado de 1674.',\n          hint3: 'Texto estático — nudge GPS calculado por el servidor.',\n          funFact: 'La Torre del Dom tardó 60 años en construirse (1321–1382) y tiene 465 escalones hasta la cima. Durante la segunda guerra mundial se usó como escondite para los combatientes de la resistencia. El carillón del siglo XIII suena todavía cada 15 minutos — uno de los más antiguos del mundo.',\n          trivia: { question: 'Cuántos escalones hay hasta la cima de la Torre del Dom?', options: ['265', '365', '465', '565'], correctIndex: 2, explain: '465 escalones — y en un día claro la vista alcanza 50 km.' },\n        }$2`
  )
  console.log('  Added it/es to clue_1 (Dom Tower)')
}

fs.writeFileSync(seedPath, c, 'utf8')
console.log('Done!')
