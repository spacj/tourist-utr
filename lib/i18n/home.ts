import type { Dict } from './types'

// Home page (app/HomeClient.tsx): the itinerary slip, the city list, the
// price menu, the letter, the index-card FAQ and the footer invitation.
export const home: Dict = {
  navHow: { en: 'How it works', nl: 'Zo werkt het', de: 'So geht’s', fr: 'Comment ça marche', it: 'Come funziona', es: 'Cómo funciona' },
  navPrices: { en: 'Prices', nl: 'Prijzen', de: 'Preise', fr: 'Tarifs', it: 'Prezzi', es: 'Precios' },
  navMain: { en: 'Main', nl: 'Hoofdmenu', de: 'Hauptmenü', fr: 'Menu principal', it: 'Menu principale', es: 'Menú principal' },

  heroPhotoAlt: { en: 'A Utrecht canal with its quays a storey below the street, cellar doors under the road and the Dom Tower behind', nl: 'Een Utrechtse gracht met de werven een verdieping onder de straat, kelderdeuren onder de weg en de Domtoren erachter', de: 'Eine Utrechter Gracht mit Kais ein Stockwerk unter der Straße, Kellertüren unter der Fahrbahn und dem Domturm dahinter', fr: 'Un canal d’Utrecht, ses quais un étage sous la rue, des portes de caves sous la chaussée et la tour du Dom au fond', it: 'Un canale di Utrecht con le banchine un piano sotto la strada, porte di cantine sotto la via e la Torre del Dom sullo sfondo', es: 'Un canal de Utrecht con los muelles un piso por debajo de la calle, puertas de bodegas bajo la calzada y la Torre del Dom al fondo' },
  heroPhotoBefore: { en: 'Stop 5 of Utrecht Classic', nl: 'Stop 5 van Utrecht Klassiek', de: 'Stopp 5 von Utrecht Klassik', fr: 'Étape 5 d’Utrecht Classique', it: 'Tappa 5 di Utrecht Classica', es: 'Parada 5 de Utrecht Clásico' },

  itinIntro: { en: 'Every hunt is a walk past real places, each one hidden behind a puzzle. This is Utrecht Classic, the one most people start with.', nl: 'Elke tocht is een wandeling langs echte plekken, elk verstopt achter een puzzel. Dit is Utrecht Klassiek, waar de meeste mensen mee beginnen.', de: 'Jede Tour führt an echten Orten vorbei, jeder hinter einem Rätsel versteckt. Das ist Utrecht Klassik, mit der die meisten anfangen.', fr: 'Chaque chasse passe par de vrais lieux, chacun caché derrière une énigme. Voici Utrecht Classique, celle par laquelle la plupart commencent.', it: 'Ogni caccia è una passeggiata tra luoghi veri, ognuno nascosto dietro un enigma. Questa è Utrecht Classica, quella da cui parte quasi tutti.', es: 'Cada búsqueda es un paseo por lugares reales, cada uno escondido tras un acertijo. Esta es Utrecht Clásico, con la que empieza casi todo el mundo.' },
  itinEveryStop: { en: 'At every stop', nl: 'Bij elke stop', de: 'An jedem Stopp', fr: 'À chaque étape', it: 'A ogni tappa', es: 'En cada parada' },
  itinRoute: { en: 'Utrecht Classic, stop by stop', nl: 'Utrecht Klassiek, stop voor stop', de: 'Utrecht Klassik, Stopp für Stopp', fr: 'Utrecht Classique, étape par étape', it: 'Utrecht Classica, tappa per tappa', es: 'Utrecht Clásico, parada a parada' },
  itinStopsKm: { en: '{n} stops · {km} km', nl: '{n} stops · {km} km', de: '{n} Stopps · {km} km', fr: '{n} étapes · {km} km', it: '{n} tappe · {km} km', es: '{n} paradas · {km} km' },
  itinTime: { en: 'about 2½ hours', nl: 'ongeveer 2½ uur', de: 'etwa 2½ Stunden', fr: 'environ 2 h 30', it: 'circa 2 ore e mezza', es: 'unas 2 horas y media' },
  pandhofCaption: { en: 'Stop 2: the Pandhof, the cloister garden behind the Dom', nl: 'Stop 2: de Pandhof, de kloostertuin achter de Dom', de: 'Stopp 2: der Pandhof, der Kreuzganggarten hinter dem Dom', fr: 'Étape 2 : le Pandhof, le jardin du cloître derrière le Dom', it: 'Tappa 2: il Pandhof, il giardino del chiostro dietro il Dom', es: 'Parada 2: el Pandhof, el jardín del claustro detrás del Dom' },
  pandhofAlt: { en: 'Gothic cloister arches around a walled herb garden with a small fountain', nl: 'Gotische kloostergangen rond een ommuurde kruidentuin met een fonteintje', de: 'Gotische Kreuzgangbögen um einen ummauerten Kräutergarten mit kleinem Brunnen', fr: 'Arcades gothiques d’un cloître autour d’un jardin d’herbes avec une petite fontaine', it: 'Archi gotici di un chiostro attorno a un giardino di erbe con una piccola fontana', es: 'Arcos góticos de un claustro alrededor de un jardín de hierbas con una pequeña fuente' },

  cityHuntOne: { en: '1 hunt', nl: '1 tocht', de: '1 Tour', fr: '1 parcours', it: '1 caccia', es: '1 búsqueda' },
  cityHuntMany: { en: '{n} hunts', nl: '{n} tochten', de: '{n} Touren', fr: '{n} parcours', it: '{n} cacce', es: '{n} búsquedas' },
  cityGo: { en: 'See the hunts', nl: 'Bekijk de tochten', de: 'Zu den Touren', fr: 'Voir les parcours', it: 'Vedi le cacce', es: 'Ver las búsquedas' },
  citiesNext: { en: 'Coming soon: {list}', nl: 'Binnenkort: {list}', de: 'Demnächst: {list}', fr: 'Bientôt : {list}', it: 'Presto: {list}', es: 'Próximamente: {list}' },

  menuHunts: { en: 'Hunts', nl: 'Tochten', de: 'Touren', fr: 'Chasses', it: 'Cacce', es: 'Búsquedas' },
  menuFirstHunt: { en: 'Your first hunt', nl: 'Je eerste tocht', de: 'Deine erste Tour', fr: 'Votre première chasse', it: 'La tua prima caccia', es: 'Tu primera búsqueda' },
  menuFirstHuntDesc: { en: 'Any hunt in any city, every stop. No card needed.', nl: 'Elke tocht in elke stad, alle stops. Geen betaalkaart nodig.', de: 'Jede Tour in jeder Stadt, alle Stopps. Ohne Karte.', fr: 'N’importe quelle chasse, dans n’importe quelle ville, toutes les étapes. Sans carte bancaire.', it: 'Qualsiasi caccia, in qualsiasi città, tutte le tappe. Senza carta.', es: 'Cualquier búsqueda en cualquier ciudad, todas las paradas. Sin tarjeta.' },
  menuNextHunt: { en: 'Every hunt after that', nl: 'Elke volgende tocht', de: 'Jede weitere Tour', fr: 'Chaque chasse suivante', it: 'Ogni caccia successiva', es: 'Cada búsqueda siguiente' },
  menuNextHuntDesc: { en: 'Paid once, yours to replay whenever you like.', nl: 'Eén keer betalen, daarna speel je hem zo vaak je wilt.', de: 'Einmal bezahlt, so oft spielbar, wie du willst.', fr: 'Payée une fois, à rejouer autant que vous voulez.', it: 'Pagata una volta, da rigiocare quando vuoi.', es: 'Se paga una vez y la repites cuando quieras.' },
  menuHints: { en: 'Hints', nl: 'Hints', de: 'Hinweise', fr: 'Indices', it: 'Indizi', es: 'Pistas' },
  menuHintFree: { en: 'Which neighbourhood to head for', nl: 'Naar welke buurt je moet', de: 'In welches Viertel es geht', fr: 'Le quartier où aller', it: 'Il quartiere dove andare', es: 'A qué barrio ir' },
  menuHintFreeDesc: { en: 'The first hint at every stop, always.', nl: 'De eerste hint bij elke stop, altijd.', de: 'Der erste Hinweis an jedem Stopp, immer.', fr: 'Le premier indice de chaque étape, toujours.', it: 'Il primo indizio di ogni tappa, sempre.', es: 'La primera pista de cada parada, siempre.' },
  menuPackDesc: { en: 'Every hunt already starts with 12 credits.', nl: 'Elke tocht begint al met 12 credits.', de: 'Jede Tour startet schon mit 12 Credits.', fr: 'Chaque chasse commence déjà avec 12 crédits.', it: 'Ogni caccia parte già con 12 crediti.', es: 'Cada búsqueda empieza ya con 12 créditos.' },
  menuTogether: { en: 'Together', nl: 'Samen', de: 'Zusammen', fr: 'Ensemble', it: 'Insieme', es: 'Juntos' },
  menuRace: { en: 'A race room for your group', nl: 'Een raceroom voor je groep', de: 'Ein Rennraum für eure Gruppe', fr: 'Une salle de course pour votre groupe', it: 'Una stanza di gara per il gruppo', es: 'Una sala de carrera para tu grupo' },
  menuFree: { en: 'Free', nl: 'Gratis', de: 'Gratis', fr: 'Gratuit', it: 'Gratis', es: 'Gratis' },
  menuIncluded: { en: 'Included', nl: 'Inbegrepen', de: 'Inklusive', fr: 'Inclus', it: 'Incluso', es: 'Incluido' },
  wharfAlt: { en: 'Wharf cellars along the Oudegracht, their doors opening onto the water', nl: 'Werfkelders langs de Oudegracht, met de deuren aan het water', de: 'Werftkeller an der Oudegracht, die Türen zum Wasser hin', fr: 'Caves de quai le long de l’Oudegracht, portes ouvertes sur l’eau', it: 'Cantine sulla banchina dell’Oudegracht, con le porte sull’acqua', es: 'Bodegas del muelle del Oudegracht, con las puertas hacia el agua' },
  wharfCaption: { en: 'The wharf cellars of the Oudegracht', nl: 'De werfkelders van de Oudegracht', de: 'Die Werftkeller der Oudegracht', fr: 'Les caves de quai de l’Oudegracht', it: 'Le cantine della banchina dell’Oudegracht', es: 'Las bodegas del muelle del Oudegracht' },

  mapAlt: { en: 'Joan Blaeu’s 1652 map of Utrecht inside its walls and moat', nl: 'De kaart van Utrecht binnen de muren en de singel door Joan Blaeu, 1652', de: 'Joan Blaeus Karte von Utrecht innerhalb von Mauer und Graben, 1652', fr: 'La carte d’Utrecht dans ses remparts par Joan Blaeu, 1652', it: 'La mappa di Utrecht entro le mura di Joan Blaeu, 1652', es: 'El mapa de Utrecht dentro de sus murallas de Joan Blaeu, 1652' },
  letterStrip: { en: 'Found a stop that has changed? Write to us:', nl: 'Is een stop veranderd? Schrijf ons:', de: 'Hat sich ein Stopp verändert? Schreib uns:', fr: 'Une étape a changé ? Écrivez-nous :', it: 'Una tappa è cambiata? Scrivici:', es: '¿Ha cambiado una parada? Escríbenos:' },

  blogRead: { en: 'Read the story', nl: 'Lees het verhaal', de: 'Geschichte lesen', fr: 'Lire l’article', it: 'Leggi la storia', es: 'Leer la historia' },
  blogTabsAria: { en: 'Recent stories', nl: 'Recente verhalen', de: 'Neue Geschichten', fr: 'Articles récents', it: 'Storie recenti', es: 'Historias recientes' },

  faqTopic1: { en: 'The app', nl: 'De app', de: 'Die App', fr: 'L’appli', it: 'L’app', es: 'La app' },
  faqTopic2: { en: 'Time', nl: 'Tijd', de: 'Dauer', fr: 'Durée', it: 'Durata', es: 'Tiempo' },
  faqTopic3: { en: 'Stuck', nl: 'Vast', de: 'Hängen', fr: 'Bloqué', it: 'Bloccati', es: 'Atascado' },
  faqTopic4: { en: 'Kids', nl: 'Kinderen', de: 'Kinder', fr: 'Enfants', it: 'Bambini', es: 'Niños' },
  faqTopic5: { en: 'Offline', nl: 'Offline', de: 'Offline', fr: 'Hors ligne', it: 'Offline', es: 'Sin conexión' },

  letterTitle: { en: 'Written in Utrecht, on foot', nl: 'Geschreven in Utrecht, te voet', de: 'Geschrieben in Utrecht, zu Fuß', fr: 'Écrit à Utrecht, à pied', it: 'Scritto a Utrecht, a piedi', es: 'Escrito en Utrecht, a pie' },

  footerInvite: { en: 'Your first hunt is on us.', nl: 'Je eerste tocht is van ons.', de: 'Deine erste Tour geht auf uns.', fr: 'La première chasse est offerte.', it: 'La prima caccia la offriamo noi.', es: 'La primera búsqueda corre de nuestra cuenta.' },
  footerPhotos: { en: 'Pictures', nl: 'Beeld', de: 'Bilder', fr: 'Images', it: 'Immagini', es: 'Imágenes' },
}
