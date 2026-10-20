// Everything the seeder writes. Add a hunt: create a module in ./hunts and
// list it below (order here = write order only; display order is meta.order).
import { COUNTRIES } from './countries.mjs'
import { CITIES } from './cities.mjs'

import utrechtClassic from './hunts/utrecht-classic.mjs'
import utrechtHidden from './hunts/utrecht-hidden.mjs'
import utrechtCanals from './hunts/utrecht-canals.mjs'
import utrechtDecoded from './hunts/utrecht-decoded.mjs'
import utrechtMystery from './hunts/utrecht-mystery.mjs'
import tourUtrechtBites from './hunts/tour-utrecht-bites.mjs'
import amsterdamClassic from './hunts/amsterdam-classic.mjs'
import amsterdamHidden from './hunts/amsterdam-hidden.mjs'
import amsterdamUnderground from './hunts/amsterdam-underground.mjs'
import amsterdamSchool from './hunts/amsterdam-school.mjs'
import theHagueRoyal from './hunts/the-hague-royal.mjs'
import rotterdamModern from './hunts/rotterdam-modern.mjs'
import delftVermeer from './hunts/delft-vermeer.mjs'
import haarlemClassic from './hunts/haarlem-classic.mjs'
import leidenClassic from './hunts/leiden-classic.mjs'
import milanClassic from './hunts/milan-classic.mjs'
import romeClassic from './hunts/rome-classic.mjs'
import tourMilanAperitivo from './hunts/tour-milan-aperitivo.mjs'
import tourRomeTrastevere from './hunts/tour-rome-trastevere.mjs'

export { COUNTRIES, CITIES }

export const HUNTS = [
  utrechtClassic, utrechtHidden, utrechtCanals, utrechtDecoded, utrechtMystery,
  amsterdamClassic, amsterdamHidden, amsterdamUnderground, amsterdamSchool,
  theHagueRoyal, rotterdamModern, delftVermeer,
  haarlemClassic, leidenClassic,
  milanClassic, romeClassic,
  tourUtrechtBites, tourMilanAperitivo, tourRomeTrastevere,
]
