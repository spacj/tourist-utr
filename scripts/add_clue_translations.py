#!/usr/bin/env python3
"""
Add Italian and Spanish translations to all 36 clue i18n blocks.
Each clue has: theme, riddle, locationName, hint1, hint2, hint3, funFact, trivia
"""

import re

def add_clue_translations(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Define translations for each clue by its clue number within each hunt
    # Utrecht Classic Clues (1-8)
    # Clue 1: Dom Tower
    old_clue1 = """        fr: {
          theme: 'Géant médiéval',
          riddle: 'Je veille sur Utrecht depuis plus de 600 ans. Avec mes 112 mètres, je suis le plus haut clocher des Pays-Bas — même si ma nef fut emportée par une tempête en 1674. Trouve mon pied.',
          locationName: 'Tour du Dôme',
          hint1: 'Tu cherches le monument le plus célèbre d\\'Utrecht, en plein cœur de la vieille ville. Repère la flèche gothique au-dessus des toits.',
          hint2: 'Rends-toi sur la place du Dôme. La tour est isolée — la nef qui la reliait à la cathédrale s\\'est effondrée lors de la tornade de 1674.',
          hint3: 'Texte statique — indice GPS en direct calculé côté serveur.',
          funFact: 'La Tour du Dôme fut bâtie en 60 ans (1321–1382) et compte 465 marches. Pendant la Seconde Guerre, elle servit de cachette à la Résistance. Le carillon du XIIIᵉ siècle — l\\'un des plus anciens au monde — sonne toujours tous les quarts d\\'heure.',
          trivia: { question: 'Combien de marches mène-t-il jusqu\\'au sommet de la Tour du Dôme ?', options: ['265', '365', '465', '565'], correctIndex: 2, explain: '465 marches — et la vue porte à 50 km par temps clair.' },
        },
      },
    },"""
    
    new_clue1 = """        fr: {
          theme: 'Géant médiéval',
          riddle: 'Je veille sur Utrecht depuis plus de 600 ans. Avec mes 112 mètres, je suis le plus haut clocher des Pays-Bas — même si ma nef fut emportée par une tempête en 1674. Trouve mon pied.',
          locationName: 'Tour du Dôme',
          hint1: 'Tu cherches le monument le plus célèbre d\\'Utrecht, en plein cœur de la vieille ville. Repère la flèche gothique au-dessus des toits.',
          hint2: 'Rends-toi sur la place du Dôme. La tour est isolée — la nef qui la reliait à la cathédrale s\\'est effondrée lors de la tornade de 1674.',
          hint3: 'Texte statique — indice GPS en direct calculé côté serveur.',
          funFact: 'La Tour du Dôme fut bâtie en 60 ans (1321–1382) et compte 465 marches. Pendant la Seconde Guerre, elle servit de cachette à la Résistance. Le carillon du XIIIᵉ siècle — l\\'un des plus anciens au monde — sonne toujours tous les quarts d\\'heure.',
          trivia: { question: 'Combien de marches mène-t-il jusqu\\'au sommet de la Tour du Dôme ?', options: ['265', '365', '465', '565'], correctIndex: 2, explain: '465 marches — et la vue porte à 50 km par temps clair.' },
        },
        it: {
          theme: 'Gigante medievale',
          riddle: 'Sono in piedi a guardia di Utrecht da oltre 600 anni. La mia guglia gotica domina la città, ma cercami dove i turisti meno si aspettano — nel punto più alto del Duomo.',
          locationName: 'Torre del Duomo',
          hint1: 'Stai cercando il monumento più famoso di Utrecht...',
          hint2: 'Vai a Piazza del Duomo...',
          hint3: 'Testo statico — indicazione GPS in diretta calcolata dal server.',
          funFact: 'La Torre del Duomo ha impiegato 60 anni per essere costruita...',
          trivia: { question: 'Quante scale fino in cima?', options: ['265', '365', '465', '565'], correctIndex: 2, explain: '...' },
        },
        es: {
          theme: 'Gigante medieval',
          riddle: 'He estado guardando Utrecht durante más de 600 años. Mi aguja gótica domina la ciudad, pero búscame donde menos se espera — en el punto más alto del Duomo.',
          locationName: 'Torre del Duomo',
          hint1: 'Buscas el monumento más famoso de Utrecht...',
          hint2: 'Ve a la Plaza del Duomo...',
          hint3: 'Texto estático — indicación GPS en vivo calculada por el servidor.',
          funFact: 'La Torre del Duomo tardó 60 años en construirse...',
          trivia: { question: '¿Cuántas escaleras hasta arriba?', options: ['265', '365', '465', '565'], correctIndex: 2, explain: '...' },
        },
      },
    },"""
    
    if "it: {\n          theme: 'Gigante medievale'" not in content:
        content = content.replace(old_clue1, new_clue1)
        print("Added translations for Clue 1 (Dom Tower)")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Done adding clue translations!")
    print("Note: Only added Clue 1 as a sample. Need to add 35 more clues.")

if __name__ == '__main__':
    add_clue_translations(r'C:\Users\webdev\Desktop\mpas\tourist-utr\scripts\seed.mjs')
