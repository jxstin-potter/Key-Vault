import prisma from './lib/prisma.js';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Ambiguous characters (0/O, 1/I/L) left out so keys stay readable.
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const issuedKeys = new Set();

const randomBlock = (len) =>
  Array.from(
    { length: len },
    () => KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)]
  ).join('');

// Console platforms use longer 25-character codes, storefronts use 15.
function generateKey(platform) {
  const blocks = ['XBOX', 'PLAYSTATION', 'NINTENDO'].includes(platform) ? 5 : 3;
  let code;
  do {
    code = Array.from({ length: blocks }, () => randomBlock(5)).join('-');
  } while (issuedKeys.has(code));
  issuedKeys.add(code);
  return code;
}

const img = (id) => [
  'https://images.unsplash.com/' + id + '?w=400&h=400&fit=crop',
  'https://images.unsplash.com/' + id + '?w=900&h=1200&fit=crop'
];

const ART = [
  'photo-1552820728-8b83bb6b773f',
  'photo-1538481199705-c710c4e965fc',
  'photo-1550745165-9bc0b252726f',
  'photo-1493711662062-fa541adb3fc8',
  'photo-1511512578047-dfb367046420',
  'photo-1542751371-adc38448a05e',
  'photo-1509198397868-475647b2a1e5',
  'photo-1591370874773-6702e8f12fd8',
  'photo-1616588589676-62b3bd4ff6d2',
  'photo-1526374965328-7f61d4dc18c5'
];

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const GENRES = [
  { name: 'Action', icon: 'Swords', tagline: 'Reflex-testing combat and spectacle', description: 'Fast-paced action games and character brawlers' },
  { name: 'RPG', icon: 'Sparkles', tagline: 'Long stories, deep character builds', description: 'Role-playing games with rich worlds and real choice' },
  { name: 'Strategy', icon: 'Castle', tagline: 'Out-think the opposition', description: 'Turn-based and real-time strategy' },
  { name: 'Simulation', icon: 'Plane', tagline: 'Build, manage, and tinker', description: 'Management, building, and life simulation' },
  { name: 'Indie', icon: 'Puzzle', tagline: 'Small teams, big ideas', description: 'Independent games with distinctive design' },
  { name: 'Shooter', icon: 'Crosshair', tagline: 'Aim, click, repeat', description: 'First and third-person shooters' },
  { name: 'Horror', icon: 'Ghost', tagline: 'Play with the lights off', description: 'Survival horror and psychological scares' },
  { name: 'Sports & Racing', icon: 'Trophy', tagline: 'Podiums, pitches, and lap times', description: 'Sports simulations and racing games' }
];

// keys: how many CD keys to mint. 0 deliberately models a sold-out listing.
const GAMES = [
  { name: 'Elden Ring', genre: 'Action', platform: 'STEAM', region: 'GLOBAL', price: 59.99, developer: 'FromSoftware', publisher: 'Bandai Namco', releaseDate: '2022-02-25', keys: 24, description: 'A vast open world of grim beauty from FromSoftware and George R. R. Martin. Explore the Lands Between, master punishing combat, and become Elden Lord.' },
  { name: 'God of War', genre: 'Action', platform: 'STEAM', region: 'GLOBAL', price: 49.99, developer: 'Santa Monica Studio', publisher: 'PlayStation PC', releaseDate: '2022-01-14', keys: 18, description: 'Kratos and his son Atreus journey through the Norse wilds in a brutal, single-shot retelling of a father-son myth.' },
  { name: 'Sekiro: Shadows Die Twice', genre: 'Action', platform: 'STEAM', region: 'GLOBAL', price: 39.99, developer: 'FromSoftware', publisher: 'Activision', releaseDate: '2019-03-22', keys: 15, description: 'A one-armed shinobi seeks revenge in Sengoku-era Japan. Posture-breaking swordplay that demands precision over patience.' },
  { name: 'Hades', genre: 'Action', platform: 'STEAM', region: 'GLOBAL', price: 24.99, developer: 'Supergiant Games', publisher: 'Supergiant Games', releaseDate: '2020-09-17', keys: 32, description: 'Defy the god of the dead in a rogue-like dungeon crawler where every escape attempt deepens the story.' },

  { name: 'Baldurs Gate 3', genre: 'RPG', platform: 'STEAM', region: 'GLOBAL', price: 59.99, developer: 'Larian Studios', publisher: 'Larian Studios', releaseDate: '2023-08-03', keys: 21, description: 'A sprawling D&D adventure where nearly every choice reshapes the story. Turn-based combat with extraordinary freedom.' },
  { name: 'The Witcher 3: Wild Hunt', genre: 'RPG', platform: 'GOG', region: 'GLOBAL', price: 39.99, developer: 'CD PROJEKT RED', publisher: 'CD PROJEKT', releaseDate: '2015-05-19', keys: 40, description: 'Play as Geralt of Rivia, monster hunter for hire, in an open world defined by consequence and superb side quests.' },
  { name: 'Cyberpunk 2077', genre: 'RPG', platform: 'GOG', region: 'GLOBAL', price: 49.99, developer: 'CD PROJEKT RED', publisher: 'CD PROJEKT', releaseDate: '2020-12-10', keys: 27, description: 'Night City is an open-world megalopolis obsessed with power and body modification. Build a mercenary and carve out a legend.' },
  { name: 'Divinity: Original Sin 2', genre: 'RPG', platform: 'STEAM', region: 'GLOBAL', price: 44.99, developer: 'Larian Studios', publisher: 'Larian Studios', releaseDate: '2017-09-14', keys: 12, description: 'A tactical RPG with elemental combat so systemic it rewards inventiveness over brute force.' },
  { name: 'Persona 5 Royal', genre: 'RPG', platform: 'STEAM', region: 'GLOBAL', price: 59.99, developer: 'ATLUS', publisher: 'SEGA', releaseDate: '2022-10-21', keys: 9, description: 'Balance high-school life with heists of the heart in a stylish JRPG about rebellion and reinvention.' },

  { name: 'Civilization VI', genre: 'Strategy', platform: 'STEAM', region: 'GLOBAL', price: 29.99, developer: 'Firaxis Games', publisher: '2K', releaseDate: '2016-10-21', keys: 30, description: 'Build an empire to stand the test of time. Just one more turn, every single time.' },
  { name: 'Total War: WARHAMMER III', genre: 'Strategy', platform: 'STEAM', region: 'EU', price: 49.99, developer: 'Creative Assembly', publisher: 'SEGA', releaseDate: '2022-02-17', keys: 14, description: 'Grand campaign strategy married to enormous real-time battles across the Realm of Chaos.' },
  { name: 'Age of Empires IV', genre: 'Strategy', platform: 'STEAM', region: 'GLOBAL', price: 39.99, developer: 'Relic Entertainment', publisher: 'Xbox Game Studios', releaseDate: '2021-10-28', keys: 17, description: 'The classic RTS returns with eight asymmetric civilisations and genuinely useful history lessons.' },
  { name: 'Frostpunk', genre: 'Strategy', platform: 'STEAM', region: 'GLOBAL', price: 19.99, developer: '11 bit studios', publisher: '11 bit studios', releaseDate: '2018-04-24', keys: 26, description: 'Command the last city on a frozen earth and decide how much of your humanity survival is worth.' },

  { name: 'Microsoft Flight Simulator', genre: 'Simulation', platform: 'XBOX', region: 'GLOBAL', price: 59.99, developer: 'Asobo Studio', publisher: 'Xbox Game Studios', releaseDate: '2020-08-18', keys: 8, description: 'The whole planet, rendered to scale, with weather pulled from the real world. Fly anywhere.' },
  { name: 'Cities: Skylines II', genre: 'Simulation', platform: 'STEAM', region: 'GLOBAL', price: 49.99, developer: 'Colossal Order', publisher: 'Paradox Interactive', releaseDate: '2023-10-24', keys: 11, description: 'City building at genuine scale, with deep traffic, economy, and zoning simulation.' },
  { name: 'Stardew Valley', genre: 'Simulation', platform: 'STEAM', region: 'GLOBAL', price: 14.99, developer: 'ConcernedApe', publisher: 'ConcernedApe', releaseDate: '2016-02-26', keys: 45, description: 'Inherit a run-down farm and quietly build a life. Endlessly generous, made almost entirely by one person.' },
  { name: 'The Sims 4', genre: 'Simulation', platform: 'EPIC', region: 'GLOBAL', price: 39.99, developer: 'Maxis', publisher: 'Electronic Arts', releaseDate: '2014-09-02', keys: 22, description: 'Create people, build homes, and orchestrate their lives with as much or as little kindness as you like.' },

  { name: 'Hollow Knight', genre: 'Indie', platform: 'STEAM', region: 'GLOBAL', price: 14.99, developer: 'Team Cherry', publisher: 'Team Cherry', releaseDate: '2017-02-24', keys: 38, description: 'A hand-drawn metroidvania through the ruined kingdom of Hallownest. Melancholy, enormous, and precise.' },
  { name: 'Celeste', genre: 'Indie', platform: 'STEAM', region: 'GLOBAL', price: 19.99, developer: 'Maddy Makes Games', publisher: 'Maddy Makes Games', releaseDate: '2018-01-25', keys: 29, description: 'Climb a mountain, one impeccably tuned jump at a time, in a platformer about anxiety and persistence.' },
  { name: 'Disco Elysium', genre: 'Indie', platform: 'GOG', region: 'GLOBAL', price: 39.99, developer: 'ZA/UM', publisher: 'ZA/UM', releaseDate: '2019-10-15', keys: 0, description: 'A detective RPG with no combat and extraordinary writing. Argue with the parts of your own mind.' },
  { name: 'Outer Wilds', genre: 'Indie', platform: 'EPIC', region: 'GLOBAL', price: 24.99, developer: 'Mobius Digital', publisher: 'Annapurna Interactive', releaseDate: '2019-05-28', keys: 16, description: 'Explore a hand-built solar system stuck in a 22-minute time loop. Knowledge is the only progression.' },

  { name: 'DOOM Eternal', genre: 'Shooter', platform: 'STEAM', region: 'GLOBAL', price: 39.99, developer: 'id Software', publisher: 'Bethesda Softworks', releaseDate: '2020-03-20', keys: 23, description: 'Aggressive, resource-juggling combat set to a heavy soundtrack. Movement is the defence.' },
  { name: 'Counter-Strike 2', genre: 'Shooter', platform: 'STEAM', region: 'GLOBAL', price: 14.99, developer: 'Valve', publisher: 'Valve', releaseDate: '2023-09-27', keys: 50, description: 'The definitive competitive shooter, rebuilt on Source 2 with volumetric smoke and sub-tick updates.' },
  { name: 'Titanfall 2', genre: 'Shooter', platform: 'EPIC', region: 'NA', price: 29.99, developer: 'Respawn Entertainment', publisher: 'Electronic Arts', releaseDate: '2016-10-28', keys: 13, description: 'Wall-running pilots and towering mechs, plus one of the most inventive campaigns in the genre.' },

  { name: 'Resident Evil 4', genre: 'Horror', platform: 'STEAM', region: 'GLOBAL', price: 59.99, developer: 'CAPCOM', publisher: 'CAPCOM', releaseDate: '2023-03-24', keys: 19, description: 'The 2005 landmark remade with modern controls, sharper tension, and a far darker village.' },
  { name: 'Phasmophobia', genre: 'Horror', platform: 'STEAM', region: 'GLOBAL', price: 19.99, developer: 'Kinetic Games', publisher: 'Kinetic Games', releaseDate: '2020-09-18', keys: 34, description: 'Co-op ghost hunting with voice recognition. The ghost can hear you say its name.' },
  { name: 'Dead Space', genre: 'Horror', platform: 'PLAYSTATION', region: 'EU', price: 59.99, developer: 'Motive Studio', publisher: 'Electronic Arts', releaseDate: '2023-01-27', keys: 0, description: 'Strategic dismemberment aboard the USG Ishimura, rebuilt with seamless audio and no loading screens.' },

  { name: 'Forza Horizon 5', genre: 'Sports & Racing', platform: 'XBOX', region: 'GLOBAL', price: 59.99, developer: 'Playground Games', publisher: 'Xbox Game Studios', releaseDate: '2021-11-09', keys: 20, description: 'An open-world racing festival across Mexico, with hundreds of cars and permanently gorgeous weather.' },
  { name: 'EA SPORTS FC 24', genre: 'Sports & Racing', platform: 'EPIC', region: 'UK', price: 69.99, developer: 'EA Vancouver', publisher: 'EA SPORTS', releaseDate: '2023-09-29', keys: 7, description: 'Football with HyperMotionV animation, over 19,000 licensed players, and Ultimate Team.' }
];

const REVIEW_COMMENTS = [
  'Key activated on Steam instantly, no issues at all.',
  'Cheapest price I found anywhere. Redeemed in under a minute.',
  'Worked perfectly, and the region matched what was listed.',
  'Genuinely one of the best games I have played this year.',
  'Delivery was instant. Would buy from here again.',
  'Great game, though it took a while to get going.',
  'Runs well on modest hardware, which I appreciated.',
  'Key worked first try. Exactly as described.',
  'Solid value at this price, no complaints.',
  'Excellent game, but be ready for a steep difficulty curve.',
  'Redeemed without any trouble on my account.',
  'Fantastic soundtrack and art direction.',
  'A bit rough at launch, much better now.',
  'Bought it on sale and it was well worth it.',
  'Instant delivery, legitimate key, happy customer.',
  'Way more content than I expected for the price.',
  'The multiplayer community is still very active.',
  'Story hooked me completely, finished it in a week.',
  'Beautiful game, though it is demanding on GPU.',
  'No problems with activation, region was as advertised.'
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding KeyVault...');

  try {
    const connection = prisma.$connect();
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 30000)
    );
    await Promise.race([connection, timeout]);
    console.log('Database connection established');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    throw error;
  }

  // --- Users ---------------------------------------------------------------
  console.log('Creating admin user...');
  await prisma.user.upsert({
    where: { email: 'admin@keyvault.com' },
    update: {},
    create: {
      email: 'admin@keyvault.com',
      password: await bcrypt.hash('admin123', 12),
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN'
    }
  });

  console.log('Creating test customers...');
  const customers = [
    { email: 'customer1@test.com', firstName: 'John', lastName: 'Doe' },
    { email: 'customer2@test.com', firstName: 'Jane', lastName: 'Smith' },
    { email: 'customer3@test.com', firstName: 'Mike', lastName: 'Johnson' }
  ];
  for (const c of customers) {
    await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { ...c, password: await bcrypt.hash('password123', 12), role: 'USER' }
    });
  }

  console.log('Creating regular user...');
  await prisma.user.upsert({
    where: { email: 'user@keyvault.com' },
    update: {},
    create: {
      email: 'user@keyvault.com',
      password: await bcrypt.hash('user123', 12),
      firstName: 'Regular',
      lastName: 'User',
      role: 'USER'
    }
  });

  // --- Genres --------------------------------------------------------------
  console.log('Creating genres...');
  const genreByName = {};
  for (const genre of GENRES) {
    genreByName[genre.name] = await prisma.category.upsert({
      where: { name: genre.name },
      update: { icon: genre.icon, tagline: genre.tagline, slug: slugify(genre.name) },
      create: {
        name: genre.name,
        slug: slugify(genre.name),
        description: genre.description,
        icon: genre.icon,
        tagline: genre.tagline
      }
    });
  }

  // --- Games + keys --------------------------------------------------------
  console.log('Creating games...');
  const existingProducts = await prisma.product.count();
  if (existingProducts > 0) {
    console.log('   ' + existingProducts + ' games already exist - skipping game creation to avoid duplicates.');
    console.log('   To reseed from scratch: npm run db:reset');
  } else {
    let totalKeys = 0;
    for (const [index, game] of GAMES.entries()) {
      const product = await prisma.product.create({
        data: {
          name: game.name,
          slug: slugify(game.name),
          description: game.description,
          price: game.price,
          images: img(ART[index % ART.length]),
          categoryId: genreByName[game.genre].id,
          platform: game.platform,
          region: game.region,
          developer: game.developer,
          publisher: game.publisher,
          releaseDate: new Date(game.releaseDate)
        }
      });

      if (game.keys > 0) {
        await prisma.gameKey.createMany({
          data: Array.from({ length: game.keys }, () => ({
            code: generateKey(game.platform),
            productId: product.id
          })),
          skipDuplicates: true
        });
        totalKeys += game.keys;
      }
    }
    console.log('Minted ' + totalKeys + ' game keys');
  }

  // --- Reviews -------------------------------------------------------------
  console.log('Creating reviews...');
  const allProducts = await prisma.product.findMany({ select: { id: true } });
  const allUsers = await prisma.user.findMany({ where: { role: 'USER' }, select: { id: true } });

  for (const product of allProducts) {
    const shuffled = [...allUsers].sort(() => Math.random() - 0.5);
    const reviewers = shuffled.slice(0, Math.floor(Math.random() * allUsers.length) + 1);

    for (const user of reviewers) {
      await prisma.review.upsert({
        where: { userId_productId: { userId: user.id, productId: product.id } },
        update: {},
        create: {
          rating: Math.floor(Math.random() * 3) + 3,
          comment: REVIEW_COMMENTS[Math.floor(Math.random() * REVIEW_COMMENTS.length)],
          productId: product.id,
          userId: user.id
        }
      });
    }
  }

  // --- Denormalised review aggregates --------------------------------------
  console.log('Recomputing review aggregates...');
  const grouped = await prisma.review.groupBy({
    by: ['productId'],
    _avg: { rating: true },
    _count: { rating: true }
  });
  for (const row of grouped) {
    await prisma.product.update({
      where: { id: row.productId },
      data: {
        averageRating: Math.round((row._avg.rating ?? 0) * 10) / 10,
        reviewCount: row._count.rating
      }
    });
  }

  // --- Summary -------------------------------------------------------------
  const [gameCount, keyCount, availableKeys] = await Promise.all([
    prisma.product.count(),
    prisma.gameKey.count(),
    prisma.gameKey.count({ where: { status: 'AVAILABLE' } })
  ]);

  console.log('Seeding completed successfully!');
  console.log('Test Accounts:');
  console.log('   Admin: admin@keyvault.com / admin123');
  console.log('   User:  user@keyvault.com / user123');
  console.log('   Customers: customer1-3@test.com / password123');
  console.log(gameCount + ' games across ' + GENRES.length + ' genres');
  console.log(keyCount + ' keys total, ' + availableKeys + ' available');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    if (e.code) console.error('Error code:', e.code);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
