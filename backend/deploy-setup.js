import { execSync } from 'child_process';

async function setupDatabase() {
  try {
    // Generate Prisma client
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Push database schema
    execSync('npx prisma db push', { stdio: 'inherit' });
    
    // Seed database
    execSync('node src/seed.js', { stdio: 'inherit' });
  } catch (error) {
    process.exit(1);
  }
}

setupDatabase(); 