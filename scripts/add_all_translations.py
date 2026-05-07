#!/usr/bin/env python3
"""
Add Italian and Spanish translations to ALL i18n blocks in seed.mjs
that currently only have nl, de, fr translations.
This includes: 2 cities, 5 hunt metas, and 36 clues (43 total blocks)
"""

def add_all_translations(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # ========== CITY TRANSLATIONS ==========
    
    # Utrecht city - add it: and es: after fr: block
    old = """      fr: {
        name: 'Utrecht',
        country: 'Pays-Bas',
        description: 'Canaux médiévaux, le plus haut clocher du pays et le véritable salon des Pays-Bas.',
      },
    },
  },
  {"""
    
    new = """      fr: {
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
    },
  },
  {"""
    
    content = content.replace(old, new)
    
    # Amsterdam city
    old = """      fr: {
        name: 'Amsterdam',
        country: 'Pays-Bas',
        description: 'La ville des canaux, des musées mondiales et des hôtels particuliers du Siècle d\\'or qui ont bâti les Pays-Bas.',
      },
    },
  },
]"""
    
    new = """      fr: {
        name: 'Amsterdam',
        country: 'Pays-Bas',
        description: 'La ville des canaux, des musées mondiales et des hôtels particuliers du Siècle d\\'or qui ont bâti les Pays-Bas.',
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
    },
  },
]"""
    
    content = content.replace(old, new)

    # ========== HUNT META TRANSLATIONS ==========
    
    # Utrecht Classic (already done by earlier script, but let's make sure)
    old = """        badge: 'Le plus populaire',
      },
    },
  },
  clues: ["""
    
    new = """        badge: 'Le plus populaire',
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
    },
  },
  clues: ["""
    
    if "it: {\n        title: 'Utrecht Classica'" not in content:
        content = content.replace(old, new)
    
    # Hidden Utrecht
    old = """        badge: 'Caché',
      },
    },
  },
  clues: ["""
    
    new = """        badge: 'Caché',
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
    },
  },
  clues: ["""
    
    content = content.replace(old, new)
    
    # Canals & Cafes
    old = """        badge: 'Détente',
      },
    },
  },
  clues: ["""
    
    new = """        badge: 'Détente',
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
    },
  },
  clues: ["""
    
    content = content.replace(old, new)
    
    # Amsterdam Classic
    old = """        badge: 'Le plus populaire',
      },
    },
  },
  clues: ["""
    
    # Need to be more specific - let's target Amsterdam Classic specifically
    # Actually the pattern is the same, let me use a different approach with more context
    
    # Let me write the file and handle clues separately
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Added city and hunt meta translations!")
    print("Now need to add clue translations...")

if __name__ == '__main__':
    add_all_translations(r'C:\Users\webdev\Desktop\mpas\tourist-utr\scripts\seed.mjs')
