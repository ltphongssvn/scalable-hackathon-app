// Test how your application loads environment variables
const path = require('path');

console.log('Testing environment variable loading...\n');

// Method 1: Direct dotenv (like our test script)
require('dotenv').config();
console.log('Method 1 - Direct dotenv:');
console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('  DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0);

// Clear the environment
delete require.cache[require.resolve('dotenv')];
delete process.env.DATABASE_URL;

// Method 2: Like your config/index.js does it
const dotenv2 = require('dotenv');
dotenv2.config({ path: path.join(__dirname, '.env') });
console.log('\nMethod 2 - With path specification:');
console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('  DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0);

// Check the actual path being used
console.log('\nPath resolution:');
console.log('  __dirname:', __dirname);
console.log('  Config would look for .env at:', path.join(__dirname, 'src/config', '../../.env'));
console.log('  Resolved path:', path.resolve(path.join(__dirname, 'src/config', '../../.env')));
