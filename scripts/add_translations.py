#!/usr/bin/env python3
"""
Add Italian and Spanish translations to all i18n blocks in seed.mjs
that currently only have nl, de, fr translations.
"""

import re

def add_translations_to_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements for cities
    # Utrecht city
    old_utrecht_city = """    fr: {
      name: 'Utrecht',
      country: 'Pays-Bas',
      description: 'Canaux médiévaux, le plus haut clocher du pays et le véritable salon des Pays-Bas.',
    },
  },"""

    new_utrecht_city = """    fr: {
      name: 'Utrecht',
      country: 'Pays-Bas',
      description: 'Canaux médiévaux, le plus haut clocher du pays et le véritable salon des Pays-Bas.',
    },
    it: {
      name: 'Utrecht',
      country: 'Paesi Bassi',
      description: 'Canali medievali, la torre campanaria più alta del paese e il vero salotto dei Paesi Bassi.',
    },
    es: {
      name: 'Utrecht',
      country: 'Países Bajos',
      description: 'Canales medievales, la torre de la iglesia más alta del país y la verdadera sala de estar de los Países Bajos.',
    },
  },"""

    content = content.replace(old_utrecht_city, new_utrecht_city)

    # Amsterdam city
    old_amsterdam_city = """    fr: {
      name: 'Amsterdam',
      country: 'Pays-Bas',
      description: 'Canaux classés au patrimoine mondial de l\\'UNESCO, maisons de ville du XVIIe siècle et bicylettes partout.',
    },
  },"""

    new_amsterdam_city = """    fr: {
      name: 'Amsterdam',
      country: 'Pays-Bas',
      description: 'Canaux classés au patrimoine mondial de l\\'UNESCO, maisons de ville du XVIIe siècle et bicylettes partout.',
    },
    it: {
      name: 'Amsterdam',
      country: 'Paesi Bassi',
      description: 'Canali patrimonio UNESCO, case a schiera del XVII secolo e biciclette ovunque.',
    },
    es: {
      name: 'Ámsterdam',
      country: 'Países Bajos',
      description: 'Canales patrimonio de la UNESCO, casas adosadas del siglo XVII y bicicletas por todas partes.',
    },
  },"""

    content = content.replace(old_amsterdam_city, new_amsterdam_city)

    # Hunt metas
    # Utrecht Classic
    old_utrecht_classic = """      fr: {
        title: 'Utrecht Classique',
        description: 'Les huit incontournables. De la Tour du Dôme à un chef-d\\'œuvre UNESCO — 600 ans d\\'Utrecht à pied.',
        badge: 'Le plus populaire',
      },
    },"""

    new_utrecht_classic = """      fr: {
        title: 'Utrecht Classique',
        description: 'Les huit incontournables. De la Tour du Dôme à un chef-d\\'œuvre UNESCO — 600 ans d\\'Utrecht à pied.',
        badge: 'Le plus populaire',
      },
      it: {
        title: 'Utrecht Classica',
        description: 'Gli otto essentials. Dalla Torre del Duomo a un capolavoro UNESCO — passeggiata attraverso 600 anni di Utrecht.',
        badge: 'Più popolare',
      },
      es: {
        title: 'Utrecht Clásico',
        description: 'Los ocho essentials. Desde la Torre del Duomo hasta una obra maestra de la UNESCO — camina a través de 600 años de Utrecht.',
        badge: 'Más popular',
      },
    },"""

    content = content.replace(old_utrecht_classic, new_utrecht_classic)

    # Hidden Utrecht
    old_hidden_utrecht = """      fr: {
        title: 'Utrecht Cachée',
        description: 'Découvrez les secrets des ruelles médiévales, cours cachées et histoires que la plupart des touristes ne connaissent pas.',
        badge: 'Caché',
      },
    },"""

    new_hidden_utrecht = """      fr: {
        title: 'Utrecht Cachée',
        description: 'Découvrez les secrets des ruelles médiévales, cours cachées et histoires que la plupart des touristes ne connaissent pas.',
        badge: 'Caché',
      },
      it: {
        title: 'Utrecht Nascosta',
        description: 'Scopri i segreti delle stradine medievali, cortili nascosti e storie che la maggior parte dei turisti non conosce.',
        badge: 'Nascosto',
      },
      es: {
        title: 'Utrecht Oculta',
        description: 'Descubre los secretos de los callejones medievales, patios escondidos e historias que la mayoría de los turistas no conocen.',
        badge: 'Oculto',
      },
    },"""

    content = content.replace(old_hidden_utrecht, new_hidden_utrecht)

    # Canals & Cafes
    old_canals_cafes = """      fr: {
        title: 'Canaux & Cafés',
        description: 'Profitez des meilleurs cafés le long des canaux, avec des arrêts brunch et thé merveilleux.',
        badge: 'Détente',
      },
    },"""

    new_canals_cafes = """      fr: {
        title: 'Canaux & Cafés',
        description: 'Profitez des meilleurs cafés le long des canaux, avec des arrêts brunch et thé merveilleux.',
        badge: 'Détente',
      },
      it: {
        title: 'Canali e Caffè',
        description: 'Goditi il meglio dei caffè lungo i canali, con soste in brunch e tè meravigliosi.',
        badge: 'Relax',
      },
      es: {
        title: 'Canales y Cafés',
        description: 'Disfruta de lo mejor de los cafés junto a los canales, con paradas en brunch y tés maravillosos.',
        badge: 'Relax',
      },
    },"""

    content = content.replace(old_canals_cafes, new_canals_cafes)

    # Amsterdam Classic
    old_amsterdam_classic = """      fr: {
        title: 'Amsterdam Classique',
        description: 'Les neuf incontournables. Des canaux UNESCO au Quartier des Musées — explorez l\\'Âge d\\'or d\\'Amsterdam.',
        badge: 'Le plus populaire',
      },
    },"""

    new_amsterdam_classic = """      fr: {
        title: 'Amsterdam Classique',
        description: 'Les neuf incontournables. Des canaux UNESCO au Quartier des Musées — explorez l\\'Âge d\\'or d\\'Amsterdam.',
        badge: 'Le plus populaire',
      },
      it: {
        title: 'Amsterdam Classica',
        description: 'I nove essentials. Dai canali UNESCO al Quartiere dei Musei — esplora il secolo d\\'oro di Amsterdam.',
        badge: 'Più popolare',
      },
      es: {
        title: 'Ámsterdam Clásico',
        description: 'Los nueve essentials. Desde los canales UNESCO hasta el Barrio de los Museos — explora el siglo de oro de Ámsterdam.',
        badge: 'Más popular',
      },
    },"""

    content = content.replace(old_amsterdam_classic, new_amsterdam_classic)

    # Hidden Amsterdam
    old_hidden_amsterdam = """      fr: {
        title: 'Amsterdam Cachée',
        description: 'Découvrez les secrets d\\'Amsterdam loin des sentiers touristiques battus.',
        badge: 'Caché',
      },
    },"""

    new_hidden_amsterdam = """      fr: {
        title: 'Amsterdam Cachée',
        description: 'Découvrez les secrets d\\'Amsterdam loin des sentiers touristiques battus.',
        badge: 'Caché',
      },
      it: {
        title: 'Amsterdam Nascosta',
        description: 'Scopri i segreti di Amsterdam lontano dai sentieri turistici battuti.',
        badge: 'Nascosto',
      },
      es: {
        title: 'Ámsterdam Oculta',
        description: 'Descubre los secretos de Ámsterdam lejos de las rutas turísticas habituales.',
        badge: 'Oculto',
      },
    },"""

    content = content.replace(old_hidden_amsterdam, new_hidden_amsterdam)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Done! Added Italian and Spanish translations to cities and hunt metas.")

if __name__ == '__main__':
    add_translations_to_file(r'C:\Users\webdev\Desktop\mpas\tourist-utr\scripts\seed.mjs')
