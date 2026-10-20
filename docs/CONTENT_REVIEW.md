# Content review — TourHunts seed data (2026-10)

Scope: every country, city, hunt and stop in `scripts/seed-data/` (19 hunts, 116 stops, 6 languages).
Utrecht (6 hunts/tours, 38 stops) was fact-checked claim by claim; the other cities were spot-checked,
prioritising numbers, dates and superlatives. Anything that could not be verified was removed or softened.
Coordinates were compared with OpenStreetMap (Nominatim) for every stop.

## Summary

| | |
|---|---|
| Stops rewritten | 116 / 116 (every riddle, hint, fun fact, quiz and puzzle reviewed; riddles rewritten as first-person clues) |
| Stops replaced or relocated (invented or unverifiable) | 15 — Amsterdam Classic ×1, Hidden Amsterdam ×2, Haarlem hofje ×1, Utrecht Nijntje stop relocated, Utrecht food tour ×5 (rebuilt), Milan tour ×1, Rome tour ×4 (reshaped) |
| Coordinates corrected | 81 of the 101 kept stops moved by more than 50 m, 51 of them by more than 150 m (worst: 919 m, 676 m, 636 m). Many old pins were a block or more off, which breaks arrival detection at a 40 m radius |
| Fact fixes logged below | about 150 rows (Utrecht about 75) |
| Translations added | `it` +72 and `es` +94 clue blocks, `nl`/`de`/`fr` +15 each (tours, Milan, Rome); every hunt meta now has all 5 languages; slips fixed ("Los ocho essentials", "Torre del Duomo", "Tour du Dôme", Italian badge "Nascosto" — badges are gone) |
| Ciphers | The 14 old ciphers were all Caesar ±1/±3. Now 44 ciphers in 11 schemes (atbash 16, A1Z26 12, Caesar shifts 1–9), never the same scheme twice in a row in a hunt; every one is re-encoded and checked by the seeder |
| Puzzle types | cipher 44, wordplay 30, anagram 16, logic 4, rebus 3, numbers 2, reverse 2 (was 11 mostly trivial reverses); tours have no puzzles |
| `observe` puzzles | 5 moved to `onSite` (`fieldChecked: false`), each stop got a new non-observe puzzle; 5 more `onSite` questions added where a visible detail is documented. 10 in total, none field-checked yet |
| Data model | `hint3` removed everywhere; `rating`/`badge` removed; `radiusM` ≥ 40; mystery solution moved to `huntSecrets` |

## Data-model notes / schema questions for the app team

1. **Mystery secrets.** `huntSecrets/hunt_utrecht_mystery` = `{ mysterySolution: { suspect, weapon, place }, solutionStory: { en, nl, de, fr, it, es } }`. `solutionStory` (the old `solvedText` that named the killer) is an extra field; the public `mystery.solvedText` is now a generic "case closed" line, because the client already has it before accusing. `app/api/accuse` currently reads `hunt.mystery.solution` — it must read `huntSecrets` instead.
2. **Puzzle `scheme`.** Cipher and reverse puzzles carry `puzzle.scheme` (`caesar:N` | `atbash` | `a1z26` | `reverse`). The client can ignore it; the seeder uses it for verification.
3. **Puzzle answers** always include every language's place name (built automatically from `locationName`, with and without the bracketed part), so "Torre del Dom" or "Domturm" is accepted. Exception: Amsterdam "SINGEL 7" (`placeNames: false`).
4. **Puzzle types** `rebus` and `numbers` are used (they are in GAME_DESIGN.md but not yet in `types/index.ts` `PuzzleType`, which still lists `observe`/`sequence`).
5. **Display order.** Utrecht hunts had duplicate `order` values (1,1,2,2); they are now 0–4. The Milan and Rome tours had `order: 0` (same as the free classic hunt); they are now 10, like the Utrecht tour. (The "first hunt per city is free" rule this affected is gone: every account now gets one free hunt of its choice, see GAME_DESIGN.md › Pricing.)
6. **Stale clue docs.** Seeding is still upsert-only (`set` per doc). Clue counts per hunt are unchanged, so nothing stale is left behind, but a hunt that shrinks in future would need a cleanup step.
7. **Maastricht** is an active city with zero hunts (unchanged; flagging only).
8. **Tours** keep empty `hint1`/`hint2` (validation allows this only for `tourType: 'tour'`).

## Changes and sources

Links marked † are standard reference pages cited for context but not re-opened during this review; all other links were read during the review.

| Hunt | Stop | Field | Old | New | Source |
|---|---|---|---|---|---|
| Utrecht Classic | 1 Dom Tower | funFact | "During WWII it was used as a hiding spot for resistance fighters." | removed (no source) | — |
| Utrecht Classic | 1 Dom Tower | funFact | "The 13th-century carillon … one of the oldest in the world" | Oldest bells cast by Geert van Wou in 1505 still hang in the tower; a carillon was added in 1664 | https://en.wikipedia.org/wiki/Dom_Tower_of_Utrecht |
| Utrecht Classic | 1 Dom Tower | trivia.explain | "view stretches 50 km" | "the bell loft alone is 221 steps up" | https://www.inyourpocket.com/Utrecht-Nederlands/Domtoren_109137v |
| Utrecht Classic | 1 Dom Tower | riddle | stated "112 metres, tallest church tower" (Wikipedia-style) | first-person riddle; still true (tallest church tower in NL) | https://en.wikipedia.org/wiki/Dom_Tower_of_Utrecht |
| Utrecht Classic | 1 Dom Tower | lat/lng | 52.09079, 5.12133 | 52.09065, 5.12131 (OSM; ~15 m) | https://www.openstreetmap.org |
| Utrecht Classic | 2 Pandhof | (order) | was stop 3 | now stop 2 (route reordered: Dom → Pandhof → Speelklok → Mariaplaats → Oudegracht → Janskerkhof → Sonnenborgh → Rietveld) | — |
| Utrecht Classic | 2 Pandhof | puzzle (observe) | "number carved beneath Bishop Willibrord's statue … 1924 = 1,200 years since Willibrord's mission" | removed — no Willibrord statue/tablet documented in the Pandhof; Willibrord arrived c. 695, so "1,200 years in 1924" was wrong anyway. New rebus puzzle PAN+D+HOF; new onSite (fountain figure, Hugo Wstinc writing) — fieldChecked:false | https://www.uu.nl/organisatie/de-pandhof-van-de-dom/geschiedenis |
| Utrecht Classic | 2 Pandhof | funFact | "dates to 1390 … one of the oldest cloister gardens … monks grew medicinal herbs … survived the 1674 tornado" | cloister built from late 14th c.; garden itself laid out in the 1960s and made a medieval-style herb garden from 1975; fountain 1915, bronze 1913 (Brom brothers) | https://www.uu.nl/organisatie/de-pandhof-van-de-dom/geschiedenis |
| Utrecht Classic | 2 Pandhof | trivia | "What did medieval monks originally grow?" (unsourced; cathedral canons, not monks) | "Today's garden is planted in the style of a medieval… herb garden" | https://www.uu.nl/organisatie/de-pandhof-van-de-dom/de-kloostertuin |
| Utrecht Classic | 2 Pandhof | lat/lng | 52.09027, 5.12186 (~70 m off) | 52.09054, 5.12261 | OSM "Kruisgang en Pandhof Domkerk" |
| Utrecht Classic | 3 Speelklok | funFact/trivia | "Buurkerk — Utrecht's oldest parish church, built 1100 AD … older than the Dom" | church origins c. 1000, fires recorded 1131/1173; museum moved in 1984. Trivia now about the old museum name (Speelklok tot Pierement) | https://en.wikipedia.org/wiki/Buurkerk ; https://www.museumspeelklok.nl/en/history/ |
| Utrecht Classic | 3 Speelklok | lat/lng | 52.09248, 5.12201 (263 m off) | 52.09073, 5.11941 (Steenweg 6) | OSM |
| Utrecht Classic | 4 Nijntje | location | "Nijntje Pleintje … between Mariaplaats and the canal" at 52.08821, 5.1193 | Nijntje Pleintje is actually at Van Asch van Wijckskade (north); stop changed to the Jacques Tange statue on the Mariaplaats (since 2016) at 52.0896, 5.1175 | https://www.duic.nl/cultuur/na-maanden-van-afwezigheid-komt-nijntje-weer-terug-naar-de-mariaplaats-utrecht/ |
| Utrecht Classic | 4 Nijntje | funFact | "85 million … 50 languages" | kept (2017 obituaries); added Egmond aan Zee origin | https://en.wikipedia.org/wiki/Miffy |
| Utrecht Classic | 5 Oudegracht | funFact | "unique in Europe — no other city has this … lower wharves built in the 13th century" | canal completed 12th c. after 1122 city rights; first wharf-cellar tunnels late 12th c.; national monument. "Unique in Europe" removed (only a tourism claim) | https://www.duic.nl/algemeen/algemeen/54453/werfkelders-kanalen-en-rivieren-de-rol-van-water-in-utrecht-van-vroeger-tot-nu ; https://erfgoed.utrecht.nl/fileadmin/uploads/documenten/zz-erfgoed/publicaties/folders-cultuurhistorie/Publieksbrochure_Werk_aan_de_werf_december_2008_NL_1_.pdf |
| Utrecht Classic | 5 Oudegracht | trivia | answer restated riddle (boat-to-cellar trade) | "In which year did Utrecht receive city rights?" 1122 | same |
| Utrecht Classic | 5 Oudegracht | lat/lng | 52.09141, 5.11861 (canal, ill-defined) | 52.09243, 5.11688 (wharf at Jansbrug) | OSM |
| Utrecht Classic | 6 Janskerkhof | funFact | "Janskerk founded 1040 … flowers sold here since 1597 … bones moved out in the 1800s" | founded c. 1040–1050 by Bishop Bernold; name = churchyard; choir later city/university library. 1597 and "bones moved" removed (no source) | https://www.huizenaanhetjanskerkhof.nl/history-janskerkhof-utrecht/ ; https://kerkenkijken.nl/english/churches/janskerk/history-and-building |
| Utrecht Classic | 6 Janskerkhof | lat/lng | 52.09269, 5.12484 (226 m off) | 52.09336, 5.12172 | OSM |
| Utrecht Classic | 7 Sonnenborgh | riddle/funFact/trivia | "16th-c. bastion … three centuries later the Netherlands' first public observatory … 1853 … original 1850s telescope still operational" | bastion 1551–52 (one of four by Charles V); chemistry lab 1695; KNMI founded 1854 here under Buys Ballot, moved to De Bilt 1897. "First public observatory" + telescope claim removed | https://oud-utrecht.nl/images/pdf-bestanden/Tijdschrift/MOUT_1941-07.pdf ; https://www.knmi.nl/over-het-knmi/nieuws/knmi-even-terug-op-de-sonnenborgh ; https://chg.kncv.nl/erfgoed/locaties/laboratorium-chimicum%2C-sonnenborgh |
| Utrecht Classic | 7 Sonnenborgh | lat/lng | 52.0847, 5.12979 (~90 m) | 52.08549, 5.12863 | OSM |
| Utrecht Classic | 8 Rietveld | funFact | "the only building ever built fully according to De Stijl" | "often called the purest built example of De Stijl" (Wikipedia: "arguably") | https://en.wikipedia.org/wiki/Rietveld_Schr%C3%B6der_House ; https://whc.unesco.org/document/217522 |
| Utrecht Classic | 8 Rietveld | riddle | "I am a quiet residential street" (wrong subject) | first-person house riddle | — |
| Utrecht Classic | meta | i18n it/es | "Gli otto essentials … Torre del Duomo" / "Los ocho essentials … Torre del Duomo" | rewritten ("Le otto tappe imperdibili … Torre del Dom" / "Las ocho paradas imprescindibles … Torre del Dom") | — |
| Hidden Utrecht | (order) | — | Flora, Pieters, Zeven Steegjes, Paushuize, Sinkel, Lepelenburg, Bruntenhof | Sinkel, Flora, Pieterskerk, Paushuize, Bruntenhof, Lepelenburg, Zeven Steegjes (shorter walk) | — |
| Hidden Utrecht | Winkel van Sinkel | funFact | "statues shipped from England … crane broke … origin of 'daar helpt geen lieve moederen aan'" ; riddle "Doric pillars floated up the Oudegracht" | removed (no source). Kept: Anton Sinkel (born Cloppenburg), building by Pieter Adams 1839, first Dutch department store, cast-iron caryatids | https://en.wikipedia.org/wiki/Winkel_van_Sinkel ; https://dspace.library.uu.nl/handle/1874/288362 |
| Hidden Utrecht | Winkel van Sinkel | lat/lng | 52.09329, 5.12149 (245 m off) | 52.09193, 5.11867 (Oudegracht 158) | OSM |
| Hidden Utrecht | Flora's Hof | riddle/funFact/trivia | "statue of Saint Willibrord at its centre … tourists never find" | no Willibrord statue documented; garden on site of bishop's palace (demolished 1803), nursery until 1934, restored 2008, gate 1634, St Martin reliefs. Trivia now about St Martin | https://www.discover-utrecht.com/location/flora-s-hof ; https://www.inyourpocket.com/Utrecht-Nederlands/Floras-Hof_109112v |
| Hidden Utrecht | Pieterskerk | riddle/funFact | "survived the 1674 tornado … oldest stone church in the Netherlands … survived iconoclasm" | storm of 1 Aug 1674 destroyed both west towers (new façade 1677); built from 1039, consecrated 1048; Bernold's sarcophagus in crypt; Walloon church | https://en.wikipedia.org/wiki/St._Peter%27s_Church,_Utrecht ; https://monumentenregister.cultureelerfgoed.nl/monumenten/pdf/18297 ; https://archimon.nl/utrecht/utrechtpieter.html |
| Hidden Utrecht | Zeven Steegjes | funFact/hint2 | "1830–1850 … 4 m wide, 50 m² … named mostly after birds (Kievitdwarsstraat, Sperwerstraat, Leeuwerikstraat)" | built c. 1843–1860 behind the De Boog brewery by Catholic poor relief; streets named after the brewery (Brouwerstraat, Moutstraat, Boogstraat) | https://www.discover-utrecht.com/location/the-seven-alleys ; https://dspace.library.uu.nl/handle/1874/273551 |
| Hidden Utrecht | Zeven Steegjes | lat/lng | 52.0874, 5.1207 (436 m off) | 52.08353, 5.12176 | OSM |
| Hidden Utrecht | Paushuize | riddle/hint2/funFact | "rooms still dressed as he left them … oldest non-religious Renaissance building … stone relief of him" | removed: he never lived there. Kept 1517 / elected 1522 / died 1523; later governor's residence | https://www.discover-utrecht.com/location/paushuize ; https://www.oud-utrecht.nl/images/pdf-bestanden/Bijlagen/Publieksbrochure_Paus_Adrianus_VI_juli_2009,%20René%20de%20Kam.pdf |
| Hidden Utrecht | Paushuize | lat/lng | 52.09128, 5.12486 (105 m) | 52.09045, 5.12412 | OSM |
| Hidden Utrecht | Lepelenburg | riddle/funFact | "single walnut tree … warships patrolled … walls torn down 1830 … free classical festival every Sunday … 'spoon-fortress' from its shape … 1554 bastion" | named after a house; earthen bastion c. 1578–1580; Zocher park ring from 1830s (national monument). Invented details removed | https://www.discover-utrecht.com/location/park-lepelenburg ; https://www.duic.nl/algemeen/straatnamen-in-utrecht-waar-komt-de-naam-lucasbolwerk-vandaan/ |
| Hidden Utrecht | Lepelenburg | lat/lng | 52.08745, 5.12767 (199 m) | 52.08917, 5.12849 | OSM |
| Hidden Utrecht | Bruntenhof | riddle/hints | "Behind an easy-to-miss door on the Lange Nieuwstraat … courtyard … elderly poor" | It's a row of 15 one-room homes for poor widows with a baroque gate (1621), between Nieuwegracht and Maliesingel; 1742 will still pays out | https://www.discover-utrecht.com/location/bruntenhof ; https://monumentenregister.cultureelerfgoed.nl/monumenten/pdf/36278 |
| Hidden Utrecht | Bruntenhof | lat/lng | 52.08533, 5.1256 (389 m off) | 52.08859, 5.12767 | OSM |
| Hidden Utrecht | meta | description | "a papal palace, a Romanesque crypt" | rewritten | — |
| Canals & Cafés | 1 Neude | funFact/hint2 | "1917 post office … Art Deco parabolic ceiling covered in gold leaf … marketplace since the 14th century … Saturday book market" | built 1919–1924 by Joseph Crouwel (Amsterdam School), parabolic arches of yellow glazed brick, library since 2020. Gold leaf / 14th-c. market / book market removed | https://www.duic.nl/algemeen/wat-wordt-daar-gebouwd-het-postkantoor-op-de-neude/ ; https://www.architectureguide.nl/project/item/prj_id/614/alfa/C |
| Canals & Cafés | 1 Neude | lat/lng | 52.09345, 5.12105 (167 m) | 52.09317, 5.11865 | OSM |
| Canals & Cafés | 2 Ganzenmarkt | riddle/funFact/trivia | "geese sold since at least 1358 … accordion players … Stadhuis rebuilt 1830" | origin of the name undocumented (said so); medieval cart tunnel to the wharf + city crane; Droochsloot painting c. 1620. Trivia now "which building is next door" | https://www.discover-utrecht.com/location/t-tunneltje ; https://www.pubhist.com/w2928 |
| Canals & Cafés | 2 Ganzenmarkt | lat/lng | 52.09234, 5.12151 (155 m) | 52.09212, 5.11928 | OSM |
| Canals & Cafés | 3 Bakkerbrug | funFact/trivia | "stones still bear scorch marks from a fire in 1634 … single most photographed vista" | removed (invented). Trivia now about the nearby Winkel van Sinkel | — |
| Canals & Cafés | 3 Bakkerbrug | lat/lng | 52.09197, 5.12015 (203 m) | 52.09177, 5.11720 | OSM |
| Canals & Cafés | 4 Nieuwegracht | funFact | "dug in the 14th century as overflow canal … 1370 … one of the narrowest bridges" | dug c. 1390–1393; >100 listed houses, six bridges | https://livetheworld.com/activities/netherlands/nieuwegracht ; https://www.visitutrechtregion.com/en/routes/3833169755/canals-and-wharf-cellars-walk |
| Canals & Cafés | 4 Nieuwegracht | lat/lng | 52.08878, 5.12477 (~170 m from Pausdam) | 52.09026, 5.12395 (Pausdam) | OSM |
| Canals & Cafés | 5 Twijnstraat | funFact/trivia | "medieval rope-makers' quarter … Jordy's Bakery, Mama cheese shop … weekly organic farmers' market" | rope-maker origin unproven (an 1847 article already debated the name); named shops removed. Trivia now asks what "twijn" means (twisted thread) | https://dspace.library.uu.nl/handle/1874/289903 ; https://readtheplaque.com/plaque/oudegracht-twijnstraat |
| Canals & Cafés | 5 Twijnstraat | lat/lng | 52.08722, 5.12434 (~380 m) | 52.08380, 5.12320 | OSM |
| Canals & Cafés | 6 Ledig Erf | funFact/trivia | "three canals meet … Café Ledig Erf and Kafé België serve 300 beers … locals bring deck chairs … joke for 400 years" | Kafé België is elsewhere (Oudegracht 196); café took the name in 1978; Tolsteegpoort gate; police post 1860–1929 | https://www.duic.nl/cultuur/op-pad-met-oud-utrecht-een-blik-op-het-ledig-erf/ |
| Canals & Cafés | 6 Ledig Erf | lat/lng | 52.08491, 5.12585 (~380 m) | 52.08166, 5.12352 (café at Tolsteegbrug) | OSM |
| Utrecht Decoded | 1 Academiegebouw | puzzle | logic "1382 + 197 = 1579" (answer was a year, not the place) | Caesar-3 cipher → ACADEMIEGEBOUW. Trivia now founding year of the university (1636) | https://www.uu.nl/organisatie/academiegebouw/historie |
| Utrecht Decoded | 1 Academiegebouw | funFact | "present building built in 1894" | front built 1891–1894; Aula = chapter house (c. 1460s) where the Union was signed 23 Jan 1579 | https://www.uu.nl/organisatie/academiegebouw/historie |
| Utrecht Decoded | 2 Catharijneconvent | funFact | "built around 1468 for the Knights of St John and later the Carmelites … the only Roman Catholic cathedral in the Netherlands" | 15th-c. convent, later Knights of St John hospital; museum opened by Queen Juliana 1979; St Catharine's is the cathedral of the Archdiocese of Utrecht (NL has several RC cathedrals). "Largest collection of medieval art" softened (unverified) | https://www.frh-europe.org/museum-catharijneconvent/ ; https://artstalkmagazine.nl/?p=2133 |
| Utrecht Decoded | 2 Catharijneconvent | lat/lng | 52.08664, 5.12331 (105 m) | 52.08749, 5.12398 | OSM |
| Utrecht Decoded | 3 Centraal Museum | riddle/funFact | "the world's oldest seagoing boat … 'Utrecht Ship' roughly 1,000-year-old logboat" | ~1000-year-old ship found 1930, shown since 1936; museum in Agnieten convent since 1921; "oldest seagoing boat" removed | https://centraalmuseum.nl/en/permanent-collection/utrechts-ancient-ship ; https://en.wikipedia.org/wiki/Utrecht_ship |
| Utrecht Decoded | 3 Centraal Museum | lat/lng | 52.0847, 5.12356 (188 m) | 52.08361, 5.12566 | OSM |
| Utrecht Decoded | 4 TivoliVredenburg | funFact | "the Grote Zaal rests on springs" | removed (unverified); opened 2014 | — |
| Utrecht Decoded | 4 TivoliVredenburg | lat/lng | 52.09114, 5.11366 (158 m) | 52.09245, 5.11277 | OSM |
| Utrecht Decoded | 5 Hoog Catharijne | riddle/funFact | "the largest indoor shopping centre in Europe" | "one of the biggest covered shopping centres in Europe" (claim unverified as a superlative) | — |
| Utrecht Decoded | 5 Hoog Catharijne | lat/lng | 52.0898, 5.1103 (234 m) | 52.09070, 5.11339 | OSM |
| Utrecht Decoded | 6 Inktpot | funFact | "about 12 million bricks … red flying saucer for a millennium art project" | artist Marc Ruygrok, Panorama 2000, last surviving piece; brick count removed (sources say 22 million, unconfirmed) | https://www.atlasobscura.com/places/the-ufo-on-top-of-inktpot ; https://www.discover-utrecht.com/location/inktpot |
| Utrecht Decoded | 6 Inktpot | puzzle (observe) | "name the object (UFO)" | moved to onSite ("what colour is it?" → red, fieldChecked:false); new A1Z26 cipher INKTPOT | — |
| Utrecht Decoded | 6 Inktpot | lat/lng | 52.08889, 5.1099 (373 m) | 52.08726, 5.11468 | OSM |
| Murder at the Dom | 1 Dom | funFact | "13th-century carillon that still rings every quarter hour" | bells 1505 (Geert van Wou), carillon 1664 | https://en.wikipedia.org/wiki/Dom_Tower_of_Utrecht |
| Murder at the Dom | 2 Pandhof | funFact | "herbs the cathedral canons once used as medicine" | herb garden is a 1975 medieval-style creation; Hugo Wstinc fountain | https://www.uu.nl/organisatie/de-pandhof-van-de-dom/geschiedenis |
| Murder at the Dom | 3 Oudegracht | funFact | "the only canal in the country with two-level wharves" | late-12th-c. wharf tunnels; national monument | (see Classic 5) |
| Murder at the Dom | 3 Oudegracht | lat/lng | 52.09141, 5.11861 | 52.08839, 5.12145 (Hamburgerbrug) | OSM |
| Murder at the Dom | 4 Speelklok | funFact | "keeps the carillon alive — the murdered ringer tuned its bells" (story presented as fact) | real facts only; story stays in the riddle | — |
| Murder at the Dom | 5 Janskerkhof | puzzle (observe) | "whose churchyard is it? → JAN" | moved to onSite (fieldChecked:false); new rebus JAN+S+KERK+HOF | — |
| Murder at the Dom | 5 Janskerkhof | funFact | "burial ground for 500 years; bones cleared in the 19th century when the flower market moved in" | removed (unsourced) | — |
| Murder at the Dom | 6 Vismarkt | funFact | "Stadhuisbrug is the widest bridge over the Oudegracht … old scales weighed the catch" | fish market by name; cellars hold fragments of palace Lofen | https://download.osmand.net/wiki/Category:Paleis_Lofen |
| Murder at the Dom | case file | mystery.solution, solvedText | solution in public hunt doc; solvedText named the killer | solution → huntSecrets.mysterySolution; solvedText now generic; original reveal story kept in huntSecrets.solutionStory; "Torre del Duomo/Dôme" → Dom | — |
| Utrecht Bites & Bars | all stops | venues | "De Rechtbank lunch wharf (courthouse until 2010, jury room)", "Blackbird Coffee", "De Kromme Haring tap room (three physics students)", "Trattoria Vittoria (three generations, 14th-c. wine store)", "Café Olivier … 19th-c. refectory, 100+ bottles" | could not verify these venues/claims (Kromme Haring is not in the centre) → tour rebuilt: Café Olivier (former hidden church Maria Minor c. 1860, 40+ Belgian beers), Stadskasteel Oudaen (own beer), Winkel van Sinkel, Kafé België, Café Ledig Erf | https://www.duic.nl/algemeen/twee-utrechtse-kroegen-cafe-top-100/ ; https://www.inyourpocket.com/netherlands/utrecht/venues/olivier |
| Amsterdam Classic | (route) | order | Palace, Oude Kerk, Anne Frank, Van Gogh, Herengracht, 't Smalle, Stadhouderskade, Singel 7 (zig-zag) | Palace, Oude Kerk, Singel 7, 't Smalle, Anne Frank, Herengracht, Rijksmuseum passage, Van Gogh | — |
| Amsterdam Classic | 1 Royal Palace | funFact | "marble floor features the largest known medieval map" ; "built 1648–1655" | Citizens' Hall floor: eastern/western hemispheres + northern sky (18th-c. replacement floor); inaugurated 1655 | https://www.teara.govt.nz/en/node/20576 ; https://www.nh-hotels.com/en/travel-guides/amsterdam/royal-palace |
| Amsterdam Classic | 1 Royal Palace | lat/lng | 52.37308, 4.89418 (193 m, on the Dam square) | 52.37314, 4.89134 | OSM |
| Amsterdam Classic | 2 Oude Kerk | funFact | "wooden ceiling 1390 survived fires 1421/1452 … leans about 2 metres to the east" | lean removed (unsourced); consecrated c. 1306, oldest building; Saskia 1642 | https://en.wikipedia.org/wiki/Oude_Kerk_(Amsterdam) † |
| Amsterdam Classic | 3 Singel 7 | riddle/funFact/trivia | "the narrowest house in Amsterdam — 2.02 m … built 1730 for a widow … tax-avoidance trick" | Singel 7 is only a narrow back façade (~1 m); the narrowest house is Oude Hoogstraat 22 (2.02 m × 5 m); tax story = popular explanation. "1730 widow" removed | https://en.wikipedia.org/wiki/Smallest_house_in_Amsterdam ; https://dutchreview.com/culture/narrowest-house-amsterdam/ |
| Amsterdam Classic | 3 Singel 7 | lat/lng | 52.37351, 4.89245 (534 m off) | 52.37823, 4.89384 | OSM |
| Amsterdam Classic | 4 't Smalle | riddle/funFact | "Amsterdam's oldest café — open since 1642 … jenever recipe unchanged 380 years … survived both World Wars" | Pieter Hoppe's distillery started here c. 1780; "oldest café"/1642 removed; trivia now "what is jenever" | https://www.iamsterdam.com/en/whats-on/calendar/eating-and-drinking/cafes-and-bars/cafe-t-smalle ; https://www.gillespudlowski.com/?p=9469 |
| Amsterdam Classic | 4 't Smalle | lat/lng | 52.37741, 4.8819 (170 m) | 52.37672, 4.88414 | OSM |
| Amsterdam Classic | 5 Anne Frank House | trivia/funFact | "1.3 million visitors — the most visited museum in the Netherlands" | removed (Rijksmuseum draws more); dates 6 Jul 1942 – 4 Aug 1944; diary 1947 (Het Achterhuis), 70+ languages, museum 1960. Reverse puzzle → atbash cipher | https://www.annefrank.org/en/anne-frank/ † |
| Amsterdam Classic | 6 Herengracht | funFact/trivia | "mansions 30 metres deep"; "dug 1612" | dug from 1613; Golden Bend between Leidsestraat and Vijzelstraat; trivia now UNESCO 2010 | https://whc.unesco.org/en/list/1349 † |
| Amsterdam Classic | 6 Herengracht | lat/lng | 52.36801, 4.88701 | 52.36511, 4.89161 (Golden Bend, Herengracht ~476) | OSM |
| Amsterdam Classic | 7 (new) | stop | "Stadhouderskade crossing — 40,000 cyclists, lights every 4 seconds, redesigned 2019 for the world's first bicycle traffic jam … 12,000 bikes under the Rijksmuseum" | invented → replaced by the Rijksmuseum cycle passage (Cuypers 1885; cars banned 1931; cyclists kept access after the 2013 reopening debate) | https://wiki.fietsersbondamsterdam.nl/_media/2012/nrc_120704.pdf ; https://www.bnnvara.nl/kassa/artikelen/conflict-over-fietspassage-rijksmuseum |
| Amsterdam Classic | 8 Van Gogh | riddle/funFact | "over 2,000 letters … more than 2 million visitors" | "hundreds of letters"; visitor number removed; trivia now the Rietveld design | https://www.vangoghmuseum.nl/en/about/organisation/history † |
| Hidden Amsterdam | 1 Begijnhof | riddle/funFact | "oldest house built 1425 … Amsterdam's oldest wooden building … one resident hid her faith behind a secret church" | Houten Huis date disputed (c. 1420–1528); hidden chapel at nos. 29–30 after Reformation | https://aviewoncities.com/amsterdam/beguinage ; https://www.lonelyplanet.com/points-of-interest/houten-huis/1392737 |
| Hidden Amsterdam | 1 Begijnhof | lat/lng | 52.37191, 4.88998 (280 m) | 52.36940, 4.88996 | OSM |
| Hidden Amsterdam | 2 Ons' Lieve Heer | riddle | "a church facade that faces the wrong way … full Catholic cathedral" | removed; built 1661–1663, tolerated hidden church, museum since 1888 | https://www.opsolder.nl/en/ † |
| Hidden Amsterdam | 3 Waag | riddle/funFact | "the last remaining medieval city gate … held the city keys … night watchman" | gate 1488 (St Anthony's), weighing house in 17th c.; "last gate"/keys removed | https://en.wikipedia.org/wiki/Waag_(Amsterdam) † |
| Hidden Amsterdam | 4 Boekhandel De Roos | stop | "floating bookshop on a 19th-century ship, 35,000 books, moored since 1986" | no evidence it exists → replaced by Huis met de Hoofden (1622, six Roman gods, maid legend) | https://en.wikipedia.org/wiki/Huis_met_de_Hoofden |
| Hidden Amsterdam | 5 Hortus | riddle/hint2/funFact | "unchanged since 1660 … Middenweg 42 … founded by the VOC … 300-year-old cycad" | founded 1638 by the city as a medicinal herb garden, moved to the Plantage 1682; address Plantage Middenlaan 2a; cycad age unverified → removed | https://en.wikipedia.org/wiki/Hortus_Botanicus_(Amsterdam) |
| Hidden Amsterdam | 5 Hortus | lat/lng | 52.36681, 4.90551 (154 m) | 52.36681, 4.90778 | OSM |
| Hidden Amsterdam | 6 Theater Museum | stop | "Theatre Museum near Leidseplein on the site of the Stadsschouwburg that burned in 1772, ~50 dead, current building 1894" | wrong place and facts → replaced by Schreierstoren (c. 1480–87; Hudson 1609 plaque placed 1927; "weeping women" is folk etymology) | https://en.wikipedia.org/wiki/Schreierstoren |
| Hidden Amsterdam | 7 Poezenboot | riddle/funFact | "on the Prinsengracht (riddle) … since 1968 … over 1,000 cats … the only floating cat sanctuary in the world … charity in three countries" | Singel 38G; began 1966, boat 1968, current boat since 1979; counts/superlatives removed | https://www.hollandtimes.nl/2023-edition-3-may/the-poezenboot-needs-a-new-home/ ; https://www.amsterdammuseum.nl/en/topic/women-of-amsterdam/contribution/144220-oprichtster-van-de-poezenboot |
| Hidden Amsterdam | 7 Poezenboot | lat/lng | 52.37701, 4.88831 (349 m) | 52.37813, 4.89311 | OSM |
| Amsterdam Underground | 1 Vrankrijk | funFact/trivia | "squatted 1982 … bought from the city in 1992 … one of the few legalized squats" | squatted Nov 1982 after 7 years empty; owner offered to sell in early 1990s (purchase year unconfirmed) | https://en.wikipedia.org/wiki/Vrankrijk |
| Amsterdam Underground | 1 Vrankrijk | lat/lng | 52.37424, 4.89042 (295 m) | 52.37169, 4.88922 | OSM |
| Amsterdam Underground | 2 Waterlooplein | theme | "Europe's oldest flea market" | removed; market here since 1893, canals filled 1882 | https://en.wikipedia.org/wiki/Waterlooplein |
| Amsterdam Underground | 3 Vondelbunker | riddle/funFact | "squatted in 2010 … acoustics awful" | bunker in the 1947 bridge; youth centre 1968; volunteer-run venue today | https://www.lonelyplanet.com/points-of-interest/vondelbunker/1420073 |
| Amsterdam Underground | 4 OT301 | funFact/trivia | "built 1929 … paid the city a symbolic €1 a year … legalized 2006" | squatted 1999; users' association EHBK bought it from the city in 2006. €1/year and 1929 removed | https://en.wikipedia.org/wiki/OT301 |
| Amsterdam Underground | 5 Westergasfabriek | funFact | "Gashouder … a perfect circle 30 metres tall" | built 1883–85, park opened 2003; dimensions removed. Reverse puzzle → atbash | https://en.wikipedia.org/wiki/Westergasfabriek |
| Amsterdam Underground | 6 STRAAT | puzzle (observe) | museum name | moved to onSite; new A1Z26 cipher; "world's biggest" → "calls itself one of the largest" | https://straat.museum † |
| Amsterdam School | 1 Het Schip | coords/hint2 | "Hembrugstraat 297" at 52.38935, 4.88291 (636 m off) | Museum Het Schip, Oostzaanstraat 45, 52.39049, 4.87373; completed 1920 | OSM ; https://www.hetschip.nl † |
| Amsterdam School | 2 Beurs van Berlage | address | "Damrak 277" | Damrak 243 (OSM); "his students at the Quellinus school founded the Amsterdam School" removed | OSM |
| Amsterdam School | 4 Tuschinski | trivia.explain | "a unique combination found nowhere else in Europe … the most beautiful cinema in the Netherlands" | superlatives removed | — |
| Amsterdam School | 5 De Dageraad | trivia | "most expensive social housing ever built per m²" | invented → "What does De Dageraad mean?" | — |
| Amsterdam School | 6 Olympic Stadium | puzzle (observe) | "year carved on the façade" | moved to onSite (fieldChecked:false — not verified that a year is visible); trivia now about Jan Wils (gold medal, 1928 art competitions) | https://en.wikipedia.org/wiki/Jan_Wils † |
| The Hague Royal | 1 Binnenhof | riddle/funFact | "the Dutch government has met for 800 years … one of the oldest still-functioning parliament buildings … king delivers throne speech here every September" | parliament moved out in 2021 for renovation; since 2022 the throne speech is in the Koninklijke Schouwburg | https://www.eerstekamer.nl/nieuws/20250826/bezoek_de_koninklijke_schouwburg |
| The Hague Royal | 2 Mauritshuis | funFact | "built in 1644 … holds 800 paintings" | built c. 1636–1641; painting count removed; trivia size 44.5 × 39 cm kept | https://www.mauritshuis.nl/en/discover/the-building/ † |
| The Hague Royal | 3 Escher in Het Paleis | lat/lng | 52.0815, 4.3094 (394 m off) | 52.08342, 4.31426 (Lange Voorhout 74) | OSM |
| The Hague Royal | 3 Escher | puzzle.explain | "his name happens not to be a palindrome … a small museum joke" | reverse → A1Z26 cipher | — |
| The Hague Royal | 4 Noordeinde | riddle/funFact | "Royal Standard flies overhead when he's inside … the orange royal flag" | removed (unverified); working palace since 1984; William of Orange equestrian statue | https://www.koninklijkhuis.nl/bezoeken/paleis-noordeinde † |
| The Hague Royal | 4 Noordeinde | lat/lng | 52.0828, 4.3091 (244 m) | 52.08075, 4.30648 | OSM |
| The Hague Royal | 5 Peace Palace | riddle | "Every flag of every state in the world hangs in my hall" | removed (invented); cipher hint "O→N→… wait, try the other direction" (broken) → atbash | — |
| The Hague Royal | 6 Scheveningen | riddle/funFact/trivia | "1900-metre boardwalk … 19th-century pier … casino at its end … pier opened 1959"; shibboleth stated as fact | pier opened 1961, Ferris wheel 2016; shibboleth framed as a popular wartime story | https://nl.wikipedia.org/wiki/Pier_van_Scheveningen † |
| The Hague Royal | 6 Scheveningen | lat/lng | 52.1124, 4.2722 (in the sea, ~800 m off) | 52.11530, 4.28340 (Pierplein, pier entrance) | OSM |
| Rotterdam | (route) | order | Cube Houses, Markthal, Witte Huis, Wilhelminapier, Erasmusbrug, Oude Haven, Euromast | Markthal, Cube Houses, Oude Haven, Witte Huis, Erasmusbrug, Wilhelminapier, Euromast | — |
| Rotterdam | Witte Huis | riddle/funFact | "tallest building in Europe when it opened … Europe's first skyscraper … erased 24,000 buildings in 90 minutes" | "often called one of Europe's first high-rise office buildings"; casualty/building numbers removed; trivia now the date (14 May 1940) | https://nl.wikipedia.org/wiki/Witte_Huis_(Rotterdam) † |
| Rotterdam | Witte Huis | lat/lng | 51.921, 4.489 (306 m) | 51.91882, 4.49171 | OSM |
| Rotterdam | Euromast | funFact/trivia | "Space Tower added in 1970 to reclaim the tallest-in-NL title — they'd been overtaken by Utrecht"; "see Belgium"; "€13.50" | overtaken in 1968 by the Erasmus MC tower (Rotterdam's tallest); Belgium view and prices removed | https://en.wikipedia.org/wiki/Euromast |
| Rotterdam | Wilhelminapier | funFact/trivia | "more than a million emigrants 1873–1971 … KPN tower" | HAL carried close to two million people over its history; last crossing 1971; Hotel New York opened 1993 | https://www.hollandamerica.com/content/dam/hal/inventory-assets/newsroom/presskits/History/hotel-new-york-fact-sheet-final-ada.pdf ; https://americanheritage.com/hotel-new-york |
| Rotterdam | Erasmusbrug | funFact | "bascule opens 1,200 times a year … pylon leans 8 degrees" | removed (unverified); 1996, ~800 m, 139 m pylon. Caesar → atbash | https://en.wikipedia.org/wiki/Erasmusbrug † |
| Rotterdam | Oude Haven | funFact | "one of the only stretches of pre-war Rotterdam still standing" | removed (the area was heavily bombed); name origin = dam in the Rotte | https://en.wikipedia.org/wiki/Rotterdam † |
| Rotterdam | Oude Haven | lat/lng | 51.9168, 4.492 (300 m) | 51.91975, 4.49330 | OSM |
| Rotterdam | Cube Houses | funFact | "show home €4 … each apartment 100 m² over three floors" | removed (prices/sizes); built 1982–84, 54.7° | https://en.wikipedia.org/wiki/Cube_house † |
| Delft | Nieuwe Kerk | riddle/funFact | "every Dutch monarch since 1584 … 46 members … 376 steps … 109-metre" | William of Orange + House of Orange-Nassau; last burials Juliana & Bernhard 2004; step count removed | https://en.wikipedia.org/wiki/Nieuwe_Kerk_(Delft) † |
| Delft | Nieuwe Kerk | lat/lng | 52.0118, 4.358 (194 m) | 52.01229, 4.36072 | OSM |
| Delft | Prinsenhof | funFact/trivia | "the very first bullet holes ever made by a handgun on record … Catholic Frenchman … pistol in the Rijksmuseum" | Balthasar Gérard (Burgundian, supporter of Philip II); "first" claim removed; trivia now "who shot him"; reverse → A1Z26 | https://en.wikipedia.org/wiki/Assassination_of_William_the_Silent † |
| Delft | Royal Delft | funFact/trivia | "royal family bought a share … cobalt from a single mine in Saxony … eight hand-applied glazes" | only survivor of 30+ 17th-c. potteries; "Koninklijke" title 1919; cobalt/Saxony removed; trivia now 1919 | https://museum.royaldelft.com/en/discover-the-collection/history/ ; https://www.gracesguide.co.uk/Royal_Delft_Pottery |
| Delft | Royal Delft | lat/lng | 52.005, 4.3588 (676 m off) | 52.00149, 4.36687 (Rotterdamseweg 196) | OSM |
| Delft | Beestenmarkt | funFact/trivia | "livestock every Thursday until 1960 … trees planted 1830 to shade animals … best terrace in NL" | removed (unverified) | — |
| Delft | Beestenmarkt | lat/lng | 52.0145, 4.3582 (449 m) | 52.01147, 4.36254 | OSM |
| Haarlem | Grote Kerk | riddle/funFact/trivia | Mozart "on 11 April 1766 … played for two hours" stated as fact; "Mendelssohn 1838" | Mozart visit framed as tradition (contested); organ by Christian Müller 1735–38; trivia now the builder | https://www.nhnieuws.nl/nieuws/353891/mozart-speelde-als-kind-op-een-orgel-in-haarlem-feit-of-verzonnen ; https://pipeorganmap.com/organ/haarlem-grote-of-st-bavokerk |
| Haarlem | Frans Hals Museum | funFact | "1610 Oudemannenhuis … museum opened 1862 in it" | museum founded 1862, moved into the early-17th-c. Oudemannenhuis in 1913 | https://www.franshalsmuseum.nl/en/ † |
| Haarlem | Teylers | puzzle | logic "digits add to 20 → 1784" (answer a year) | Caesar-7 cipher TEYLERS; "Napoleon visited 1811", "330,000-volt sparks" removed | https://www.teylersmuseum.nl/en † |
| Haarlem | Molen De Adriaan | funFact | "paint mill grinding tuff for pigments … 70 years most-petitioned … crowdfunding" | tuff was ground for cement; burned 23 Apr 1932; reopened 23 Apr 2002 | https://www.molenadriaan.nl/wp-content/uploads/2015/06/MdA-Opmaak-panelen-22-09-2016.pdf |
| Haarlem | hofje stop | stop | "Hofje van Loo (sample hofje), 24 houses … 23 hofjes … UNESCO intangible heritage candidate" | replaced by Hofje van Bakenes (1395, oldest hofje in NL still in use; rebuilt 1650s); invented numbers/UNESCO removed | https://en.wikipedia.org/wiki/Hofje_van_Bakenes |
| Haarlem | hofje stop | lat/lng | 52.3812, 4.6398 | 52.38155, 4.63939 (Wijde Appelaarsteeg 11) | OSM |
| Leiden | Pieterskerk | funFact | "Pilgrims lived in Leiden 1608–1620" | 1609–1620; Robinson buried 1625 | https://en.wikipedia.org/wiki/Pieterskerk,_Leiden † |
| Leiden | Pieterskerk | lat/lng | 52.1568, 4.4849 (221 m) | 52.15762, 4.48785 | OSM |
| Leiden | Academiegebouw | funFact | "Einstein, Rembrandt (briefly), and four Dutch monarchs studied here"; tax-vs-university choice as fact | Einstein was a visiting professor (removed); Juliana, Beatrix, Willem-Alexander; choice framed as legend; building used since 1581 | https://www.universiteitleiden.nl/en/about-us/profile/history † |
| Leiden | De Burcht | funFact | "shell-keep built around 1050 … tourist attraction since the 1650s" | mound c. 11th c., brick ring wall later (dates disputed); 1650s claim removed | https://www.visitleiden.nl/en/locations/2380897422/de-burcht |
| Leiden | Hortus | funFact | "bulbs from the Ottoman court of Suleiman … people climbed the wall and stole bulbs" | founded 1590, Clusius 1593, garden laid out 1594 (today a reconstruction); theft legend removed | https://en.wikipedia.org/wiki/Hortus_Botanicus_Leiden |
| Leiden | De Valk | funFact | "seventh on this site … family lived there until 1964 … museum 1966" | 1743, 29 m, Van Rhijn family, museum 1966, milling again since 2000; reverse → A1Z26 | https://molenmuseumdevalk.nl/en/over-het-museum/geschiedenis ; https://en.wikipedia.org/wiki/Museum_De_Valk |
| Leiden | De Valk | lat/lng | 52.1632, 4.488 (150 m) | 52.16452, 4.48642 | OSM |
| Milan Classic | Galleria | funFact | "Camparino bar where the Negroni Sbagliato was invented … re-tiled three times" | Sbagliato was created at Bar Basso (removed); Mengoni fell end of 1877; bull = Turin's emblem | https://en.wikipedia.org/wiki/Galleria_Vittorio_Emanuele_II † |
| Milan Classic | Duomo | funFact | "Candoglia quarry is a tax-free zone granted 1387 and never revoked … last spire 1965" | Candoglia quarries granted by Gian Galeazzo Visconti, still used for repairs; completion "into the 20th century" | https://www.duomomilano.it/en/ † |
| Milan Classic | Brera | riddle | "Caravaggio's only altarpiece in Milan … one of Italy's top three galleries" | removed (unverified) | — |
| Rome Classic | Forum | funFact | "fresh flowers still appear daily … Via Sacra paving stones are the same ones generals walked" | "visitors still leave flowers"; paving claim removed | — |
| Rome Classic | Pantheon | trivia | "22 small drainage holes … no upgrades since 126 AD" | "small drains in the slightly sloping floor" | https://en.wikipedia.org/wiki/Pantheon,_Rome † |
| Rome Classic | Trevi | funFact | "throwing the coin became a tradition after the 1954 film … municipal government tried to claim them in 2017" | "popularised by" the film; 2017 claim removed | — |
| Milan Aperitivo tour | stops | venues | "N'Ombra de Vin — cellar of a 16th-century friary, 3,000+ references", "Terrazza Gallia — bergamot from the chef's farm", "Vinile — DJ booth in a Vespa", "locks designed by Leonardo still in use" | unverifiable details removed; Vinile replaced by the Darsena (restored 2015); Leonardo "studied the locks" | https://en.wikipedia.org/wiki/Navigli † |
| Rome Trastevere tour | stops | venues | "Otaleg — owner named Italy's best gelato maker 2019" (main shop is in Colli Portuensi, 4 km away), "Enoteca Ferrara 87 years", "Ponte Sisto obelisks are 1990s replacements", "Bourdain ate here" | stops reshaped: Ponte Sisto, S. Maria in Trastevere, Biscottificio Innocenti, Da Enzo al 29, Piazza Trilussa | OSM |
| Cities | Haarlem | description | "a Gothic church where Mozart played the organ" | "a Gothic church with one of Europe's most famous organs" | (see Grote Kerk) |
| Cities | Maastricht | description | "the treaty that named the euro" | "the 1992 treaty that paved the way for the euro" (the name was chosen in Madrid, 1995) | https://en.wikipedia.org/wiki/Euro † |
| Cities | duplicates | data | The Hague, Rotterdam, Delft, Haarlem, Leiden were defined twice in the old seed (second definition silently overwrote the first) | deduplicated, keeping the definition that was actually written | — |

## Needs on-site check

`fieldChecked` is `false` for every on-site question, so the app will not show them until someone walks the route and flips the flag in `scripts/seed-data/hunts/*.mjs`.

### On-site questions (10)
- [ ] Utrecht Classic / clue_2 Pandhof — the bronze figure on the fountain is *writing* (Hugo Wstinc). Is the garden open and the action clear?
- [ ] Hidden Utrecht / clue_1 Winkel van Sinkel — *4* caryatids hold the balcony.
- [ ] Hidden Utrecht / clue_2 Flora's Hof — wall reliefs show the life of *St Martin*. Also check the garden's opening hours.
- [ ] Hidden Utrecht / clue_5 Bruntenhof — is the year *1621* visible on the baroque gate? (The monument register dates the gate 1621; not confirmed that it is inscribed.)
- [ ] Utrecht Decoded / clue_6 Inktpot — the flying saucer is *red* and visible from the street.
- [ ] Murder at the Dom / clue_5 Janskerkhof — church named after *St John (Jan)*.
- [ ] Hidden Amsterdam / clue_2 Huis met de Hoofden — *6* heads on the façade.
- [ ] Hidden Amsterdam / clue_5 Schreierstoren — the plaque commemorates *Henry Hudson* (1609).
- [ ] Amsterdam Underground / clue_6 STRAAT — museum name visible at the entrance.
- [ ] Amsterdam School / clue_6 Olympic Stadium — is a year *1928* actually visible on the stadium? (original claim, unverified)

### Hints that describe what you see (please confirm while walking)
- [ ] Utrecht Dom — outline of the vanished nave in the Domplein paving.
- [ ] Utrecht Mariaplaats — the Nijntje/Dick Bruna statue (Jacques Tange) is on the square (it has been away for repairs before).
- [ ] Utrecht Bakkerbrug — it is the next bridge after the Stadhuisbrug, walking towards the station.
- [ ] Utrecht Pieterskerk — small bell turret; Zeven Steegjes street names (Boogstraat, Brouwerstraat).
- [ ] Amsterdam Royal Palace — ship weathervane on the cupola; Begijnhof entrance from the Spui; Poezenboot at Singel 38G; Huis met de Hoofden step gable.
- [ ] Amsterdam Rijksmuseum passage — still open to cyclists and pedestrians.
- [ ] The Hague Noordeinde — equestrian statue in front of the palace; Escher in Het Paleis still open.
- [ ] Rotterdam Witte Huis — green dome / corner turrets; Hotel New York's two copper towers.
- [ ] Haarlem Hofje van Bakenes — entrance at Wijde Appelaarsteeg 11 and visiting hours.

### Claims kept but not fully verified
- Hoog Catharijne "one of the biggest covered shopping centres in Europe" when it opened (1973).
- Centraal Museum "world's largest Rietveld collection" (the museum's own claim).
- Inktpot "largest brick building in the Netherlands" (widely repeated; the brick count was removed).
- Vrankrijk purchase year (the owner offered the building for sale in 1991; the actual purchase is not confirmed).
- Twijnstraat: origin of the name (presented as debated).
- Catharijneconvent: Carmelites vs. Knights of St John as builders (sources disagree; the text says a 15th-century convent later run by the Knights of St John).
- Haarlem: Mozart playing the Bavo organ in 1766 (presented as tradition).
- Leiden: the tax-or-university choice (presented as legend); dating of De Burcht.
- Scheveningen shibboleth (presented as a popular story).
- Rome/Milan: Cassius Dio's 9,000 animals (attributed to him), Trevi coin total ("well over a million euros a year").

### Venues (food & drink tours) — check they still exist and are open
- Utrecht: Café Olivier (Achter Clarenburg 6a), Stadskasteel Oudaen (Oudegracht 99), Winkel van Sinkel (Oudegracht 158), Kafé België (Oudegracht 196), Café Ledig Erf (Tolsteegbrug 3).
- Milan: Camparino in Galleria, N'Ombra de Vin (Via San Marco 2), Terrazza Gallia (Excelsior Hotel Gallia), Mag Café (Ripa di Porta Ticinese 43), Darsena.
- Rome: Biscottificio Innocenti (Via della Luce 21), Da Enzo al 29 (Via dei Vascellari 29).

## How the seeder protects this content

`node scripts/seed.mjs --dry-run` (no credentials needed) fails if: a radius is below 40 m; any `hint3` exists; `rating`/`badge` appears anywhere in a hunt; a stop is missing nl/de/fr/it/es (or a language lacks the trivia/puzzle/onSite block); trivia doesn't have exactly 4 distinct options or `correctIndex` is out of range; a puzzle answer is empty; an `onSite` lacks `fieldChecked`; a puzzle type is outside the design's list; a cipher/reverse whose re-encoded answer isn't printed in every language's prompt; an anagram whose letters don't match its answer; two consecutive ciphers in a hunt share a scheme; a hunt stop has no puzzle; coordinates are more than 12 km from the city centre; ids are duplicated; a mystery solution sits in the public doc, or the evidence doesn't narrow down to exactly the solution.
