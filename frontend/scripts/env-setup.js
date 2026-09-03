#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLocalPath = path.join(__dirname, '..', '.env.local');

function createLocalEnv() {
  const localEnvContent = `# Local Development Environment
VITE_API_URL=http://localhost:5000/api
VITE_ENV=development
`;

  fs.writeFileSync(envLocalPath, localEnvContent);
  console.log('✅ Created .env.local for local development');
  console.log('📝 VITE_API_URL set to: http://localhost:5000/api');
}

function checkEnvironment() {
  const hasLocalEnv = fs.existsSync(envLocalPath);
  
  console.log('\n🔍 Environment Check:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`VITE_ENV: ${process.env.VITE_ENV || 'not set'}`);
  console.log(`Local .env.local exists: ${hasLocalEnv ? '✅ Yes' : '❌ No'}`);
  
  if (hasLocalEnv) {
    const localEnv = fs.readFileSync(envLocalPath, 'utf8');
    const apiUrlMatch = localEnv.match(/VITE_API_URL=(.+)/);
    if (apiUrlMatch) {
      console.log(`API URL: ${apiUrlMatch[1]}`);
    }
  }
}

const command = process.argv[2];

switch (command) {
  case 'setup':
    createLocalEnv();
    break;
  case 'check':
    checkEnvironment();
    break;
  default:
    console.log('🔧 Environment Setup Script');
    console.log('\nUsage:');
    console.log('  node scripts/env-setup.js setup  - Create .env.local for local development');
    console.log('  node scripts/env-setup.js check  - Check current environment configuration');
    console.log('\nFor Vercel deployment:');
    console.log('  Set VITE_API_URL in Vercel dashboard to your production backend URL');
} 