import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

// Real portrait box art from Steam's public CDN, keyed by product name.
// Every id below was verified against store.steampowered.com/api/appdetails
// to confirm it resolves to the expected title (not just that the id exists -
// a wrong-but-valid id would silently show the wrong game's art).
const STEAM_APP_IDS = {
  'Elden Ring': 1245620,
  'God of War': 1593500,
  'Sekiro: Shadows Die Twice': 814380,
  Hades: 1145360,
  'Baldurs Gate 3': 1086940,
  'The Witcher 3: Wild Hunt': 292030,
  'Cyberpunk 2077': 1091500,
  'Divinity: Original Sin 2': 435150,
  'Persona 5 Royal': 1687950,
  'Civilization VI': 289070,
  'Total War: WARHAMMER III': 1142710,
  'Age of Empires IV': 1466860,
  Frostpunk: 323190,
  'Microsoft Flight Simulator': 1250410,
  'Cities: Skylines II': 949230,
  'Stardew Valley': 413150,
  'The Sims 4': 1222670,
  'Hollow Knight': 367520,
  Celeste: 504230,
  'Disco Elysium': 632470,
  'Outer Wilds': 753640,
  'DOOM Eternal': 782330,
  'Counter-Strike 2': 730,
  'Titanfall 2': 1237970,
  'Resident Evil 4': 2050650,
  Phasmophobia: 739630,
  'Dead Space': 1693980,
  'Forza Horizon 5': 1551360,
  'EA SPORTS FC 24': 2195250,
  'Hollow Knight: Silksong': 1030300
};

const DRY_RUN = process.env.DRY_RUN !== 'false';

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, images: true }
  });

  let matched = 0;
  let unmatched = [];

  for (const product of products) {
    const appId = STEAM_APP_IDS[product.name];
    if (!appId) {
      unmatched.push(product.name);
      continue;
    }

    const url = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
    const alreadyCorrect = product.images.length === 1 && product.images[0] === url;

    console.log(
      `${alreadyCorrect ? '=' : '~'} ${product.name.padEnd(30)} -> ${url}${
        alreadyCorrect ? '  (already set)' : ''
      }`
    );

    if (!alreadyCorrect) {
      matched++;
      if (!DRY_RUN) {
        await prisma.product.update({ where: { id: product.id }, data: { images: [url] } });
      }
    }
  }

  console.log(`\n${matched} product(s) ${DRY_RUN ? 'would be' : 'were'} updated.`);
  if (unmatched.length > 0) {
    console.log(`No Steam id on file for: ${unmatched.join(', ')}`);
  }
  if (DRY_RUN) {
    console.log('\n(dry run - nothing written; rerun with DRY_RUN=false to apply)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
