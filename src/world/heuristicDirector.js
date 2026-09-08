/**
 * Deterministic world director used when no LLM credentials are configured.
 * Emits composition intent; SceneComposer expands dense procedural content.
 * This is not a fake LLM: the API reports director: 'heuristic'.
 */

function room(id, name, description, tags, objects, hotspots = [], composition = undefined) {
  return {
    id,
    name,
    environment: { type: 'panorama', description, tags },
    composition,
    objects,
    hotspots,
  }
}

function objectNeed(type, description, tags = [], extras = {}) {
  return { type, description, tags, ...extras }
}

function hotspot(id, label, targetRoom, description) {
  return { id, label, targetRoom, description }
}

const THEMES = [
  {
    test: /space|orbit|galaxy|nasa|starship|spaceship|cosmos/i,
    spec: {
      theme: 'space',
      description: 'An exploration of outer space',
      rooms: [
        room(
          'room1',
          'Orbital Station',
          'Orbital space station overlooking Earth and distant stars',
          ['space', 'station', 'orbit', 'stars'],
          [
            objectNeed('space_station', 'Main orbital habitat ring', ['station'], {
              position: [0, 3, -10],
              scale: [1.4, 1.4, 1.4],
              detail: 'high',
            }),
            objectNeed('spaceship', 'Docked scout ship', ['ship'], {
              position: [6, 2.5, -8],
              scale: [1.2, 1.2, 1.2],
            }),
            objectNeed('planet', 'Nearby planet', ['planet'], {
              position: [-14, 6, -22],
              scale: [3, 3, 3],
            }),
            objectNeed('asteroid', 'Drifting asteroid', ['rock'], { position: [8, 4, -14], scale: [1.5, 1.5, 1.5] }),
            objectNeed('asteroid', 'Small asteroid', ['rock'], { position: [-6, 2, -12], scale: [0.8, 0.8, 0.8] }),
            objectNeed('console', 'Station console', ['console'], { position: [-1.5, 0, -3] }),
            objectNeed('crate', 'Supply crate', ['crate'], { position: [1.6, 0, -3.2] }),
            objectNeed('lander', 'Utility lander', ['lander'], { position: [-5, 0, -6], scale: [1.1, 1.1, 1.1] }),
          ],
          [hotspot('to-moon', 'Moon Surface', 'room2', 'Step onto the lunar surface')]
        ),
        room(
          'room2',
          'Moon Surface',
          'A grey lunar landscape under a black sky with Earth visible',
          ['space', 'moon', 'surface', 'crater', 'lunar'],
          [
            objectNeed('lander', 'Landing module', ['lander'], { position: [2, 0, -6], scale: [1.3, 1.3, 1.3], detail: 'high' }),
            objectNeed('planet', 'Earth in the sky', ['earth', 'planet'], {
              position: [12, 8, -18],
              scale: [2.8, 2.8, 2.8],
              material: 'ice',
            }),
            objectNeed('rock', 'Lunar boulder', ['rock'], { position: [-3, 0, -4] }),
            objectNeed('rock', 'Crater rock', ['rock'], { position: [4, 0, -8] }),
            objectNeed('rock', 'Basalt chunk', ['rock'], { position: [-5, 0, -9] }),
            objectNeed('crate', 'Mission crate', ['crate'], { position: [0.5, 0, -3.5] }),
            objectNeed('console', 'Surface beacon console', ['console'], { position: [-1.2, 0, -3] }),
            objectNeed('asteroid', 'Low orbit rock', ['rock'], { position: [-10, 5, -16], scale: [1.2, 1.2, 1.2] }),
          ],
          [
            hotspot('to-station', 'Orbital Station', 'room1', 'Return to the station'),
            hotspot('to-deep', 'Deep Space', 'room3', 'Travel into deep space'),
          ]
        ),
        room(
          'room3',
          'Deep Space',
          'Deep space nebula field with distant planets and a drifting spaceship',
          ['space', 'nebula', 'deep', 'stars'],
          [
            objectNeed('spaceship', 'Drifting explorer', ['ship'], {
              position: [0, 2.5, -9],
              scale: [1.6, 1.6, 1.6],
              detail: 'high',
            }),
            objectNeed('planet', 'Gas giant', ['planet'], { position: [-16, 4, -24], scale: [4, 4, 4] }),
            objectNeed('planet', 'Small world', ['planet'], { position: [14, 3, -20], scale: [2, 2, 2] }),
            objectNeed('asteroid', 'Asteroid A', ['rock'], { position: [5, 1, -7] }),
            objectNeed('asteroid', 'Asteroid B', ['rock'], { position: [-4, 2, -11] }),
            objectNeed('asteroid', 'Asteroid C', ['rock'], { position: [8, 3, -13] }),
            objectNeed('space_station', 'Distant relay', ['station'], { position: [10, 5, -18], scale: [0.9, 0.9, 0.9] }),
            objectNeed('crate', 'Debris crate', ['crate'], { position: [1.5, 0, -3] }),
          ],
          [hotspot('to-moon-2', 'Moon Surface', 'room2', 'Return to the moon')]
        ),
      ],
    },
  },
  {
    test: /underwater|ocean|sea|coral|reef|atlantis|aquatic|fish/i,
    spec: {
      theme: 'underwater',
      description: 'An exploration of underwater worlds',
      rooms: [
        room(
          'room1',
          'Research Station',
          'Interior of an underwater research station',
          ['underwater', 'station', 'interior', 'ocean'],
          [
            objectNeed('habitat', 'Research habitat', ['habitat', 'landmark'], {
              position: [0, 0, -8],
              scale: [1.3, 1.3, 1.3],
              detail: 'high',
            }),
            objectNeed('console', 'Research console', ['console'], { position: [-1.5, 0, -3] }),
          ],
          [hotspot('to-reef', 'Coral Reef', 'room2', 'Exit to the reef')],
          {
            biome: 'ocean_floor',
            life: 'moderate',
            vegetation: 'seaweed',
            large_features: 'station',
            atmosphere: 'underwater_caustics',
            density: 0.65,
          }
        ),
        room(
          'room2',
          'Coral Reef',
          'A sunlit coral reef alive with fish and seaweed',
          ['underwater', 'reef', 'coral', 'ocean', 'fish'],
          [],
          [
            hotspot('to-station', 'Research Station', 'room1', 'Return to the station'),
            hotspot('to-city', 'Underwater City', 'room3', 'Travel to the city'),
          ],
          {
            biome: 'coral_reef',
            life: 'abundant',
            vegetation: 'coral_reef',
            large_features: 'reef',
            atmosphere: 'underwater_caustics',
            density: 0.9,
          }
        ),
        room(
          'room3',
          'Underwater City',
          'A futuristic underwater city of glass and light',
          ['underwater', 'city', 'futuristic', 'ocean'],
          [
            objectNeed('habitat', 'Central habitat', ['habitat', 'landmark'], {
              position: [0, 0, -12],
              scale: [1.6, 1.6, 1.6],
              detail: 'high',
            }),
          ],
          [hotspot('to-reef-2', 'Coral Reef', 'room2', 'Return to the reef')],
          {
            biome: 'open_ocean',
            life: 'abundant',
            vegetation: 'coral_reef',
            large_features: 'buildings',
            atmosphere: 'underwater_caustics',
            density: 0.75,
          }
        ),
      ],
    },
  },
  {
    test: /egypt|pyramid|pharaoh|nile|sphinx|tomb/i,
    spec: {
      theme: 'ancient_egypt',
      description: 'An exploration of ancient Egypt',
      rooms: [
        room(
          'room1',
          'Giza Plateau',
          'Sunlit desert plateau with clear blue sky and sand dunes around the pyramids',
          ['egypt', 'desert', 'giza', 'sand', 'clear'],
          [
            objectNeed('pyramid', 'Great Pyramid', ['pyramid', 'egypt'], {
              position: [0, 0, -14],
              scale: [5.5, 5.5, 5.5],
              material: 'limestone',
              detail: 'high',
            }),
            objectNeed('pyramid', 'Secondary Pyramid', ['pyramid'], {
              position: [11, 0, -20],
              scale: [3.2, 3.2, 3.2],
              material: 'limestone',
              detail: 'medium',
            }),
            objectNeed('pyramid', 'Third Pyramid', ['pyramid'], {
              position: [-10, 0, -22],
              scale: [2.4, 2.4, 2.4],
              detail: 'medium',
            }),
            objectNeed('obelisk', 'Temple obelisk', ['obelisk'], {
              position: [-6, 0, -8],
              scale: [1.2, 1.2, 1.2],
              detail: 'high',
            }),
            objectNeed('palm_tree', 'Oasis palm', ['palm'], { position: [5, 0, -4], detail: 'medium' }),
            objectNeed('palm_tree', 'Second palm', ['palm'], { position: [6.5, 0, -5.5] }),
            objectNeed('statue', 'Guardian statue', ['statue'], { position: [-4, 0, -6], detail: 'high' }),
            objectNeed('desert_dune', 'Sand dune', ['dune'], { position: [8, 0, -10], scale: [2.8, 2.8, 2.8] }),
            objectNeed('desert_dune', 'Far dune', ['dune'], { position: [-12, 0, -16], scale: [3.5, 3.5, 3.5] }),
            objectNeed('torch', 'Path torch', ['torch'], { position: [2, 0, -3] }),
          ],
          [hotspot('to-temple', 'Temple Court', 'room2', 'Enter the temple court')]
        ),
        room(
          'room2',
          'Temple Court',
          'Ancient Egyptian temple courtyard under warm sunset light',
          ['egypt', 'temple', 'columns', 'sunset'],
          [
            objectNeed('temple', 'Columned temple', ['temple'], {
              position: [0, 0, -10],
              scale: [1.5, 1.5, 1.5],
              material: 'limestone',
              detail: 'high',
            }),
            objectNeed('column', 'Court column', ['column'], { position: [-3, 0, -5] }),
            objectNeed('column', 'Court column B', ['column'], { position: [3, 0, -5] }),
            objectNeed('obelisk', 'Court obelisk', ['obelisk'], { position: [0, 0, -4], scale: [0.9, 0.9, 0.9] }),
            objectNeed('statue', 'Pharaoh statue', ['statue'], { position: [-5, 0, -7], detail: 'high' }),
            objectNeed('statue', 'Priest statue', ['statue'], { position: [5, 0, -7] }),
            objectNeed('hieroglyphic_panel', 'Wall glyphs', ['hieroglyph'], { position: [-6, 1, -9] }),
            objectNeed('ancient_door', 'Temple door', ['door'], { position: [0, 0, -8.2] }),
            objectNeed('torch', 'Left torch', ['torch'], { position: [-2, 0, -3.5] }),
            objectNeed('torch', 'Right torch', ['torch'], { position: [2, 0, -3.5] }),
          ],
          [
            hotspot('to-giza', 'Giza Plateau', 'room1', 'Return to the plateau'),
            hotspot('to-tomb', 'Tomb Passage', 'room3', 'Enter the tomb'),
          ]
        ),
        room(
          'room3',
          'Tomb Passage',
          'Dim limestone tomb corridor with torchlight and carved walls',
          ['egypt', 'tomb', 'interior', 'stone'],
          [
            objectNeed('stone_wall', 'Passage wall', ['wall'], { position: [-3, 0, -6], detail: 'high' }),
            objectNeed('stone_wall', 'Passage wall B', ['wall'], { position: [3, 0, -6], detail: 'high' }),
            objectNeed('hieroglyphic_panel', 'Tomb glyphs', ['hieroglyph'], { position: [-2.5, 1, -5] }),
            objectNeed('hieroglyphic_panel', 'Far glyphs', ['hieroglyph'], { position: [2.5, 1, -8] }),
            objectNeed('statue', 'Seated guardian', ['statue'], { position: [0, 0, -10], detail: 'high' }),
            objectNeed('ancient_door', 'Sealed door', ['door'], { position: [0, 0, -12] }),
            objectNeed('torch', 'Wall torch A', ['torch'], { position: [-2, 0, -4] }),
            objectNeed('torch', 'Wall torch B', ['torch'], { position: [2, 0, -4] }),
            objectNeed('torch', 'Deep torch', ['torch'], { position: [-1.5, 0, -9] }),
            objectNeed('crate', 'Offering chest', ['crate'], { position: [1.5, 0, -3.5] }),
          ],
          [hotspot('to-temple-2', 'Temple Court', 'room2', 'Return to the temple')]
        ),
      ],
    },
  },
  {
    test: /alien|mushroom|fungi|biolumines|exoplanet|glowing mushroom/i,
    spec: {
      theme: 'alien_planet',
      description: 'An alien world of glowing fungal forests',
      rooms: [
        room(
          'room1',
          'Mushroom Clearing',
          'Alien clearing ringed by giant glowing mushrooms',
          ['alien', 'mushroom', 'bioluminescent'],
          [
            {
              type: 'mushroom',
              name: 'Colossal mushroom',
              description: 'Giant glowing mushroom landmark',
              tags: ['landmark', 'mushroom'],
              category: 'organic_plant',
              form: 'mushroom',
              appearance: {
                scale_hint: 'giant',
                color: 'bioluminescent',
                surface: 'glowing',
                emission: 0.9,
                roughness: 0.4,
                metalness: 0,
                transparency: 0.05,
              },
              geometry: { primary_form: 'mushroom', facets: 8, height: 5, width: 4 },
              behavior: { floating: false, clustered: false, count: 1 },
              position: [0, 0, -10],
              scale: [2.5, 2.5, 2.5],
              detail: 'high',
            },
          ],
          [hotspot('to-grove', 'Fungal Grove', 'room2', 'Enter the glowing grove')],
          {
            biome: 'alien',
            life: 'moderate',
            vegetation: 'fungal',
            large_features: 'fungal_grove',
            atmosphere: 'bioluminescent',
            density: 0.9,
            motif: 'giant glowing mushrooms',
          }
        ),
        room(
          'room2',
          'Fungal Grove',
          'Dense alien grove of bioluminescent fungi',
          ['alien', 'fungi', 'grove'],
          [],
          [
            hotspot('to-clearing', 'Mushroom Clearing', 'room1', 'Return to the clearing'),
            hotspot('to-crystals', 'Crystal Ridge', 'room3', 'Climb toward the crystals'),
          ],
          {
            biome: 'alien',
            life: 'abundant',
            vegetation: 'fungal',
            large_features: 'fungal_grove',
            atmosphere: 'bioluminescent',
            density: 0.95,
            motif: 'glowing mushroom forest',
          }
        ),
        room(
          'room3',
          'Crystal Ridge',
          'Alien ridge of translucent glowing crystals',
          ['alien', 'crystal', 'ridge'],
          [
            {
              type: 'crystal_spire',
              name: 'Crystal spire',
              description: 'Tall glowing crystal formation',
              tags: ['landmark', 'crystal'],
              category: 'crystalline',
              form: 'crystalline',
              appearance: {
                scale_hint: 'giant',
                color: 'cool',
                surface: 'translucent',
                emission: 0.7,
                roughness: 0.15,
                metalness: 0.1,
                transparency: 0.5,
              },
              geometry: { primary_form: 'crystalline', facets: 12, height: 6, width: 2 },
              behavior: { floating: false, clustered: true, count: 1 },
              position: [0, 0, -12],
              scale: [2, 2, 2],
            },
          ],
          [hotspot('to-grove-2', 'Fungal Grove', 'room2', 'Return to the grove')],
          {
            biome: 'alien',
            life: 'sparse',
            vegetation: 'alien',
            large_features: 'crystals',
            atmosphere: 'bioluminescent',
            density: 0.7,
            motif: 'glowing crystal ridge',
          }
        ),
      ],
    },
  },
  {
    test: /flower|meadow|field of|wildflower|garden|bloom/i,
    spec: {
      theme: 'meadow',
      description: 'A field of flowers under open sky',
      rooms: [
        room(
          'room1',
          'Flower Field',
          'A wide meadow dense with wildflowers',
          ['meadow', 'flowers', 'field'],
          [],
          [hotspot('to-grove', 'Tree Grove', 'room2', 'Walk toward the trees')],
          {
            biome: 'meadow',
            life: 'moderate',
            vegetation: 'meadow',
            large_features: 'rocks',
            atmosphere: 'pollen',
            density: 0.9,
          }
        ),
        room(
          'room2',
          'Tree Grove',
          'A grove at the edge of the flower meadow',
          ['meadow', 'grove', 'trees'],
          [],
          [
            hotspot('to-field', 'Flower Field', 'room1', 'Return to the field'),
            hotspot('to-hill', 'Hilltop', 'room3', 'Climb the hill'),
          ],
          {
            biome: 'meadow',
            life: 'moderate',
            vegetation: 'forest',
            large_features: 'rocks',
            atmosphere: 'godrays',
            density: 0.7,
          }
        ),
        room(
          'room3',
          'Hilltop',
          'A breezy hilltop overlooking the meadow',
          ['meadow', 'hill', 'horizon'],
          [],
          [hotspot('to-grove-2', 'Tree Grove', 'room2', 'Return to the grove')],
          {
            biome: 'meadow',
            life: 'sparse',
            vegetation: 'meadow',
            large_features: 'rocks',
            atmosphere: 'pollen',
            density: 0.6,
          }
        ),
      ],
    },
  },
  {
    test: /cyberpunk|neon|futuristic city|night city/i,
    spec: {
      theme: 'cyberpunk',
      description: 'A futuristic cyberpunk city',
      rooms: [
        room(
          'room1',
          'Neon Street',
          'Rain-slick cyberpunk street with neon signs',
          ['cyberpunk', 'city', 'neon', 'street'],
          [
            objectNeed('sign', 'Neon sign kiosk', ['box', 'city']),
            objectNeed('crate', 'Street crate', ['crate']),
          ],
          [hotspot('to-roof', 'Rooftop', 'room2', 'Climb to the rooftops')]
        ),
        room(
          'room2',
          'Rooftop',
          'Cyberpunk city rooftop overlooking towers',
          ['cyberpunk', 'city', 'rooftop'],
          [objectNeed('antenna', 'Roof antenna array', ['box'])],
          [
            hotspot('to-street', 'Street', 'room1', 'Return to the street'),
            hotspot('to-club', 'Club', 'room3', 'Enter the club'),
          ]
        ),
        room(
          'room3',
          'Club',
          'Interior of a neon nightclub',
          ['cyberpunk', 'interior', 'club'],
          [
            objectNeed('console', 'DJ console', ['console']),
            objectNeed('orb', 'Light orb', ['sphere', 'lamp']),
          ],
          [hotspot('to-roof-2', 'Rooftop', 'room2', 'Return to the rooftop')]
        ),
      ],
    },
  },
  {
    test: /forest|jungle|woods|grove/i,
    spec: {
      theme: 'forest',
      description: 'An exploration of a forest',
      rooms: [
        room(
          'room1',
          'Forest Path',
          'A sun-dappled forest path',
          ['forest', 'nature', 'path'],
          [objectNeed('crate', 'Wooden crate', ['crate']), objectNeed('rock', 'Mossy rock', ['rock'])],
          [hotspot('to-grove', 'Grove', 'room2', 'Walk into the grove')]
        ),
        room(
          'room2',
          'Grove',
          'A quiet forest grove',
          ['forest', 'grove', 'nature'],
          [objectNeed('statue', 'Stone marker', ['statue'])],
          [
            hotspot('to-path', 'Path', 'room1', 'Return to the path'),
            hotspot('to-cabin', 'Cabin', 'room3', 'Approach the cabin'),
          ]
        ),
        room(
          'room3',
          'Cabin',
          'Interior of a woodland cabin',
          ['forest', 'interior', 'cabin'],
          [objectNeed('box', 'Storage box', ['box'])],
          [hotspot('to-grove-2', 'Grove', 'room2', 'Return to the grove')]
        ),
      ],
    },
  },
  {
    test: /mars|red planet/i,
    spec: {
      theme: 'mars',
      description: 'An exploration of Mars',
      rooms: [
        room(
          'room1',
          'Habitat',
          'Interior of a Mars habitat',
          ['mars', 'habitat', 'interior', 'space'],
          [objectNeed('console', 'Habitat console', ['console'])],
          [hotspot('to-surface', 'Surface', 'room2', 'Step onto Mars')]
        ),
        room(
          'room2',
          'Surface',
          'Red Martian desert with distant ridges',
          ['mars', 'desert', 'surface'],
          [objectNeed('rock', 'Martian rock', ['rock'])],
          [
            hotspot('to-habitat', 'Habitat', 'room1', 'Return to the habitat'),
            hotspot('to-canyon', 'Canyon', 'room3', 'Descend into the canyon'),
          ]
        ),
        room(
          'room3',
          'Canyon',
          'A deep canyon on Mars',
          ['mars', 'canyon', 'surface'],
          [objectNeed('lander', 'Scout lander', ['box'])],
          [hotspot('to-surface-2', 'Surface', 'room2', 'Return to the surface')]
        ),
      ],
    },
  },
]

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'world'
}

function titleCase(value) {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .slice(0, 80)
}

export function heuristicWorldFromPrompt(prompt) {
  const text = String(prompt ?? '').trim()
  for (const entry of THEMES) {
    if (entry.test.test(text)) {
      return structuredClone(entry.spec)
    }
  }

  const theme = slug(text) || 'exploration'
  const label = (titleCase(text).replace(/^(A|An|The)\s+/, '').split(' ').slice(0, 4).join(' ') || 'Exploration').slice(0, 32)
  return {
    theme,
    description: `An exploration of ${label}`,
    rooms: [
      room(
        'room1',
        `${label} Arrival`,
        `${label} arrival interior`,
        [theme, 'interior'],
        [objectNeed('console', `${label} welcome console`, ['console']), objectNeed('crate', 'Supply crate', ['crate'])],
        [hotspot('to-room-2', 'Landmark', 'room2', `Continue through ${label}`)]
      ),
      room(
        'room2',
        `${label} Landmark`,
        `${label} landmark environment`,
        [theme, 'landmark'],
        [objectNeed('statue', `${label} landmark statue`, ['statue'])],
        [
          hotspot('to-room-1', 'Arrival', 'room1', 'Return to arrival'),
          hotspot('to-room-3', 'Horizon', 'room3', `Go onward through ${label}`),
        ]
      ),
      room(
        'room3',
        `${label} Horizon`,
        `${label} horizon landscape`,
        [theme, 'horizon'],
        [objectNeed('orb', `${label} marker orb`, ['sphere'])],
        [hotspot('to-room-2', 'Landmark', 'room2', 'Return to the landmark')]
      ),
    ],
  }
}
