// Public case file for "Murder at the Dom" (no solution here — that lives in
// huntSecrets via SOLUTION below and is never written to the public hunt doc).
// solvedText is deliberately generic: the client shows it after a correct
// accusation, and the specific answer comes back from /api/accuse.

export const MYSTERY = {
  victim: 'Murder at the Dom: the night bell-ringer is dead.',
  intro: 'At dawn the Dom Tower\'s night bell-ringer was found dead. Four suspects, four weapons, four places. Visit every stop, read the evidence, cross off what it rules out — then accuse: who, with what, and where.',
  accuseTitle: 'Who killed the bell-ringer?',
  failedText: 'Not quite — the evidence pointed elsewhere. Here is what really happened.',
  suspects: [
    {
      id: 'organist',
      icon: '🎹',
      name: 'The Organist',
      i18n: {
        nl: { name: 'De Organist' },
        de: { name: 'Der Organist' },
        fr: { name: 'L\'Organiste' },
        it: { name: 'L\'Organista' },
        es: { name: 'El Organista' },
      },
    },
    {
      id: 'clockmaker',
      icon: '⚙️',
      name: 'The Clockmaker',
      i18n: {
        nl: { name: 'De Klokkenmaker' },
        de: { name: 'Der Uhrmacher' },
        fr: { name: 'L\'Horloger' },
        it: { name: 'L\'Orologiaio' },
        es: { name: 'El Relojero' },
      },
    },
    {
      id: 'bargee',
      icon: '🚤',
      name: 'The Bargee',
      i18n: {
        nl: { name: 'De Schipper' },
        de: { name: 'Der Schiffer' },
        fr: { name: 'Le Batelier' },
        it: { name: 'Il Barcaiolo' },
        es: { name: 'El Barquero' },
      },
    },
    {
      id: 'baker',
      icon: '🥖',
      name: 'The Baker',
      i18n: {
        nl: { name: 'De Bakker' },
        de: { name: 'Der Bäcker' },
        fr: { name: 'Le Boulanger' },
        it: { name: 'Il Fornaio' },
        es: { name: 'El Panadero' },
      },
    },
  ],
  weapons: [
    {
      id: 'bellrope',
      icon: '🪢',
      name: 'The bell rope',
      i18n: {
        nl: { name: 'Het klokkentouw' },
        de: { name: 'Das Glockenseil' },
        fr: { name: 'La corde de cloche' },
        it: { name: 'La fune della campana' },
        es: { name: 'La cuerda de la campana' },
      },
    },
    {
      id: 'chisel',
      icon: '⛏️',
      name: 'The stone chisel',
      i18n: {
        nl: { name: 'De steenbeitel' },
        de: { name: 'Der Steinmeißel' },
        fr: { name: 'Le ciseau à pierre' },
        it: { name: 'Lo scalpello' },
        es: { name: 'El cincel' },
      },
    },
    {
      id: 'poison',
      icon: '☠️',
      name: 'Poison',
      i18n: {
        nl: { name: 'Gif' },
        de: { name: 'Gift' },
        fr: { name: 'Le poison' },
        it: { name: 'Il veleno' },
        es: { name: 'El veneno' },
      },
    },
    {
      id: 'candlestick',
      icon: '🕯️',
      name: 'The candlestick',
      i18n: {
        nl: { name: 'De kandelaar' },
        de: { name: 'Der Kerzenständer' },
        fr: { name: 'Le chandelier' },
        it: { name: 'Il candeliere' },
        es: { name: 'El candelabro' },
      },
    },
  ],
  places: [
    {
      id: 'tower',
      icon: '🗼',
      name: 'The Dom Tower',
      i18n: {
        nl: { name: 'De Domtoren' },
        de: { name: 'Der Domturm' },
        fr: { name: 'La Tour du Dom' },
        it: { name: 'La Torre del Dom' },
        es: { name: 'La Torre del Dom' },
      },
    },
    {
      id: 'pandhof',
      icon: '🌿',
      name: 'The cloister garden',
      i18n: {
        nl: { name: 'De Pandhof' },
        de: { name: 'Der Kreuzgang' },
        fr: { name: 'Le cloître' },
        it: { name: 'Il chiostro' },
        es: { name: 'El claustro' },
      },
    },
    {
      id: 'wharf',
      icon: '⚓',
      name: 'The canal wharf',
      i18n: {
        nl: { name: 'De werf' },
        de: { name: 'Die Werft' },
        fr: { name: 'Le quai' },
        it: { name: 'La banchina' },
        es: { name: 'El muelle' },
      },
    },
    {
      id: 'speelklok',
      icon: '🎶',
      name: 'Museum Speelklok',
      i18n: {
        nl: { name: 'Museum Speelklok' },
        de: { name: 'Museum Speelklok' },
        fr: { name: 'Museum Speelklok' },
        it: { name: 'Museum Speelklok' },
        es: { name: 'Museum Speelklok' },
      },
    },
  ],
  i18n: {
    nl: {
      victim: 'Moord bij de Dom: de nachtklokkenluider is dood.',
      intro: 'Bij het ochtendgloren werd de nachtklokkenluider van de Domtoren dood gevonden. Vier verdachten, vier wapens, vier plekken. Bezoek elke stop, lees het bewijs, streep weg wat het uitsluit — en beschuldig dan: wie, waarmee en waar.',
      accuseTitle: 'Wie doodde de klokkenluider?',
      solvedText: 'Zaak gesloten. Je noemde de dader, het wapen en de plek — de klokkenluider kan rusten.',
      failedText: 'Net niet — het bewijs wees elders heen. Dit is wat er echt gebeurde.',
    },
    de: {
      victim: 'Mord am Dom: der Nacht-Glöckner ist tot.',
      intro: 'Im Morgengrauen wurde der Nacht-Glöckner des Domturms tot aufgefunden. Vier Verdächtige, vier Waffen, vier Orte. Besuche jede Station, lies die Beweise, streiche aus, was sie ausschließen — und klage dann an: wer, womit und wo.',
      accuseTitle: 'Wer tötete den Glöckner?',
      solvedText: 'Fall gelöst. Du hast Täter, Waffe und Ort benannt — der Glöckner kann in Frieden ruhen.',
      failedText: 'Knapp daneben — die Beweise wiesen woanders hin. So geschah es wirklich.',
    },
    fr: {
      victim: 'Meurtre au Dom : le sonneur de nuit est mort.',
      intro: 'À l\'aube, le sonneur de nuit de la Tour du Dom fut trouvé mort. Quatre suspects, quatre armes, quatre lieux. Visite chaque étape, lis les indices, raye ce qu\'ils éliminent — puis accuse : qui, avec quoi et où.',
      accuseTitle: 'Qui a tué le sonneur ?',
      solvedText: 'Affaire classée. Tu as désigné le coupable, l\'arme et le lieu — le sonneur peut reposer en paix.',
      failedText: 'Presque — les indices menaient ailleurs. Voici ce qui s\'est vraiment passé.',
    },
    it: {
      victim: 'Delitto al Dom: il campanaro notturno è morto.',
      intro: 'All\'alba il campanaro notturno della Torre del Dom fu trovato morto. Quattro sospetti, quattro armi, quattro luoghi. Visita ogni tappa, leggi gli indizi, cancella ciò che escludono — poi accusa: chi, con cosa e dove.',
      accuseTitle: 'Chi ha ucciso il campanaro?',
      solvedText: 'Caso chiuso. Hai indicato l\'assassino, l\'arma e il luogo: il campanaro può riposare in pace.',
      failedText: 'Quasi — gli indizi puntavano altrove. Ecco cosa è successo davvero.',
    },
    es: {
      victim: 'Asesinato en el Dom: el campanero nocturno ha muerto.',
      intro: 'Al amanecer, el campanero nocturno de la Torre del Dom apareció muerto. Cuatro sospechosos, cuatro armas, cuatro lugares. Visita cada parada, lee las pistas, tacha lo que descarten — y luego acusa: quién, con qué y dónde.',
      accuseTitle: '¿Quién mató al campanero?',
      solvedText: 'Caso cerrado. Has señalado al culpable, el arma y el lugar: el campanero ya puede descansar.',
      failedText: 'Casi — las pistas apuntaban a otro sitio. Esto es lo que pasó de verdad.',
    },
  },
  solvedText: 'Case closed. You named the killer, the weapon and the place — the bell-ringer can rest.',
}

/** Server-only: written to huntSecrets/hunt_utrecht_mystery. */
export const SECRETS = {
  mysterySolution: { suspect: 'organist', weapon: 'bellrope', place: 'pandhof' },
  solutionStory: {
    en: 'Correct. The Organist strangled him with the bell rope in the cloister garden — silencing the one witness to his forged carillon scores.',
    nl: 'Correct. De Organist wurgde hem met het klokkentouw in de Pandhof — de enige getuige van zijn vervalste beiaardpartituren tot zwijgen gebracht.',
    de: 'Richtig. Der Organist erwürgte ihn mit dem Glockenseil im Kreuzgang — den einzigen Zeugen seiner gefälschten Glockenspiel-Partituren zum Schweigen gebracht.',
    fr: 'Exact. L\'Organiste l\'a étranglé avec la corde de cloche dans le cloître — réduisant au silence le seul témoin de ses partitions de carillon falsifiées.',
    it: 'Esatto. L\'Organista lo ha strangolato con la fune della campana nel chiostro — zittendo l\'unico testimone delle sue partiture di carillon falsificate.',
    es: 'Correcto. El Organista lo estranguló con la cuerda de la campana en el claustro — silenciando al único testigo de sus partituras de carillón falsificadas.',
  },
}

/** Evidence revealed on arrival at each stop (clue docs are server-only). */
export const EVIDENCE = {
  clue_1: {
    text: 'The tower door was bolted from within — only a keyholder could enter, and the Baker has no key. The body was also carried here: the killing happened elsewhere.',
    eliminates: {
      suspects: ['baker'],
      places: ['tower'],
    },
    i18n: {
      nl: {
        text: 'De torendeur was van binnenuit vergrendeld — alleen een sleutelhouder kon erin, en de Bakker heeft geen sleutel. Het lichaam is hierheen gedragen: de moord gebeurde elders.',
      },
      de: {
        text: 'Die Turmtür war von innen verriegelt — nur ein Schlüsselträger kam hinein, und der Bäcker hat keinen Schlüssel. Die Leiche wurde hierher getragen: der Mord geschah anderswo.',
      },
      fr: {
        text: 'La porte de la tour était verrouillée de l\'intérieur — seul un détenteur de clé pouvait entrer, et le Boulanger n\'en a pas. Le corps a été transporté ici : le meurtre a eu lieu ailleurs.',
      },
      it: {
        text: 'La porta della torre era sprangata dall\'interno — solo chi aveva la chiave poteva entrare, e il Fornaio non ce l\'ha. Il corpo è stato portato qui: il delitto è avvenuto altrove.',
      },
      es: {
        text: 'La puerta de la torre estaba cerrada por dentro — solo alguien con llave podía entrar, y el Panadero no la tiene. El cuerpo fue traído aquí: el crimen ocurrió en otro lugar.',
      },
    },
  },
  clue_2: {
    text: 'An apothecary\'s vial was found here in the herb beds — full, sealed, untouched. Whoever struck did not use poison.',
    eliminates: {
      weapons: ['poison'],
    },
    i18n: {
      nl: {
        text: 'Tussen de kruidenbedden lag een apothekersflesje — vol, verzegeld, ongebruikt. De dader gebruikte geen gif.',
      },
      de: {
        text: 'In den Kräuterbeeten fand sich ein Apothekerfläschchen — voll, versiegelt, unberührt. Der Täter benutzte kein Gift.',
      },
      fr: {
        text: 'Dans les carrés d\'herbes, on a trouvé une fiole d\'apothicaire — pleine, scellée, intacte. Le meurtrier n\'a pas employé de poison.',
      },
      it: {
        text: 'Tra le aiuole di erbe c\'era una fiala da speziale — piena, sigillata, intatta. L\'assassino non ha usato veleno.',
      },
      es: {
        text: 'Entre los canteros de hierbas apareció un frasco de botica — lleno, sellado, intacto. El asesino no usó veneno.',
      },
    },
  },
  clue_3: {
    text: 'The Bargee was unloading crates at the lock all night — a dozen dockworkers vouch for him. He is innocent, and nothing happened on the wharf.',
    eliminates: {
      suspects: ['bargee'],
      places: ['wharf'],
    },
    i18n: {
      nl: {
        text: 'De Schipper loste de hele nacht kratten bij de sluis — een tiental sjouwers staat voor hem in. Hij is onschuldig, en op de werf gebeurde niets.',
      },
      de: {
        text: 'Der Schiffer entlud die ganze Nacht Kisten an der Schleuse — ein Dutzend Hafenarbeiter bürgt für ihn. Er ist unschuldig, und auf der Werft geschah nichts.',
      },
      fr: {
        text: 'Le Batelier a déchargé des caisses à l\'écluse toute la nuit — une douzaine de dockers le confirment. Il est innocent, et rien ne s\'est passé sur le quai.',
      },
      it: {
        text: 'Il Barcaiolo ha scaricato casse alla chiusa tutta la notte — una dozzina di portuali lo conferma. È innocente, e sulla banchina non è successo nulla.',
      },
      es: {
        text: 'El Barquero estuvo descargando cajas en la esclusa toda la noche — una docena de estibadores lo confirman. Es inocente, y en el muelle no pasó nada.',
      },
    },
  },
  clue_4: {
    text: 'The mason\'s stone chisel hangs clean in its case — never the weapon. And the curator locked the museum at six; the killing came later, elsewhere.',
    eliminates: {
      weapons: ['chisel'],
      places: ['speelklok'],
    },
    i18n: {
      nl: {
        text: 'De steenbeitel van de metselaar hangt schoon in zijn kist — nooit het wapen. En de conservator sloot het museum om zes uur; de moord kwam later, elders.',
      },
      de: {
        text: 'Der Steinmeißel des Maurers hängt sauber im Kasten — nie die Waffe. Und der Kurator schloss das Museum um sechs; der Mord kam später, anderswo.',
      },
      fr: {
        text: 'Le ciseau à pierre du maçon est propre dans son coffret — jamais l\'arme. Et le conservateur a fermé le musée à six heures ; le meurtre est venu plus tard, ailleurs.',
      },
      it: {
        text: 'Lo scalpello del muratore è pulito nella sua cassetta — mai l\'arma. E il curatore ha chiuso il museo alle sei; il delitto è venuto dopo, altrove.',
      },
      es: {
        text: 'El cincel del cantero está limpio en su caja — nunca fue el arma. Y el conservador cerró el museo a las seis; el crimen vino después, en otro lugar.',
      },
    },
  },
  clue_5: {
    text: 'A pawned pocket-watch turned up at a market stall — the Clockmaker was here all night selling his wares, three sellers confirm it. He was nowhere near the Dom.',
    eliminates: {
      suspects: ['clockmaker'],
    },
    i18n: {
      nl: {
        text: 'Bij een marktkraam dook een verpand zakhorloge op — de Klokkenmaker stond hier de hele nacht zijn waar te verkopen, drie kooplui bevestigen het. Hij was nergens bij de Dom.',
      },
      de: {
        text: 'An einem Marktstand tauchte eine verpfändete Taschenuhr auf — der Uhrmacher verkaufte hier die ganze Nacht seine Ware, drei Händler bestätigen es. Er war nie in Domnähe.',
      },
      fr: {
        text: 'À un étal, une montre de gousset mise en gage refit surface — l\'Horloger y vendait sa marchandise toute la nuit, trois marchands le confirment. Il n\'était pas près du Dom.',
      },
      it: {
        text: 'A una bancarella spuntò un orologio da tasca impegnato — l\'Orologiaio vendeva qui la sua merce tutta la notte, tre venditori lo confermano. Non era vicino al Dom.',
      },
      es: {
        text: 'En un puesto apareció un reloj de bolsillo empeñado — el Relojero estuvo aquí toda la noche vendiendo su mercancía, tres vendedores lo confirman. No estuvo cerca del Dom.',
      },
    },
  },
  clue_6: {
    text: 'The victim\'s ledger floated up here — its pages name forged carillon scores. The vestry candlestick was found polished and unused; the killing weapon left only a rope-burn.',
    eliminates: {
      weapons: ['candlestick'],
    },
    i18n: {
      nl: {
        text: 'Het kasboek van het slachtoffer dreef hier op — de bladzijden noemen vervalste beiaardpartituren. De kandelaar uit de sacristie was gepoetst en ongebruikt; het moordwapen liet alleen een touwstriem na.',
      },
      de: {
        text: 'Das Kassenbuch des Opfers trieb hier auf — die Seiten nennen gefälschte Glockenspiel-Partituren. Der Kerzenständer aus der Sakristei war poliert und unbenutzt; die Mordwaffe hinterließ nur eine Seilstrieme.',
      },
      fr: {
        text: 'Le registre de la victime a refait surface ici — ses pages citent des partitions de carillon falsifiées. Le chandelier de la sacristie était astiqué et inutilisé ; l\'arme n\'a laissé qu\'une marque de corde.',
      },
      it: {
        text: 'Il registro della vittima è riemerso qui — le pagine citano partiture di carillon falsificate. Il candeliere della sacrestia era lucidato e inutilizzato; l\'arma del delitto ha lasciato solo un segno di fune.',
      },
      es: {
        text: 'El libro de cuentas de la víctima salió a flote aquí — sus páginas citan partituras de carillón falsificadas. El candelabro de la sacristía estaba pulido y sin usar; el arma solo dejó una marca de cuerda.',
      },
    },
  },
}
