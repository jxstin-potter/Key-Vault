import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

const DRY_RUN = process.env.DRY_RUN !== 'false';

async function main() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, createdAt: true }
  });

  const byName = new Map();
  for (const p of products) {
    if (!byName.has(p.name)) byName.set(p.name, []);
    byName.get(p.name).push(p);
  }

  let totalToDelete = 0;
  const idsToDelete = [];

  for (const [name, rows] of byName) {
    if (rows.length <= 1) continue;
    const [keep, ...rest] = rows; // rows sorted by createdAt asc — keep the oldest
    console.log(`"${name}": ${rows.length} copies -> keeping ${keep.id} (created ${keep.createdAt.toISOString()}), deleting ${rest.length}`);
    totalToDelete += rest.length;
    idsToDelete.push(...rest.map(r => r.id));
  }

  console.log(`\nTotal products: ${products.length}`);
  console.log(`Distinct names: ${byName.size}`);
  console.log(`Would delete: ${totalToDelete}`);

  if (!DRY_RUN) {
    console.log('\nDeleting for real...');
    const result = await prisma.product.deleteMany({ where: { id: { in: idsToDelete } } });
    console.log(`Deleted ${result.count} products.`);
  } else {
    console.log('\n(dry run — nothing deleted; rerun with DRY_RUN=false to apply)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
