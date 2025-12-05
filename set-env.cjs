const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, 'src', 'environments', 'environment.prod.ts');

const apiKey = process.env.GEMINI_API_KEY || 'MISSING_API_KEY';
const googleClientId = process.env.GOOGLE_CLIENT_ID || '245341181112-s4jg0c57jpdbahv8hqr286qdhl4sen4e.apps.googleusercontent.com';

console.log('=== SET-ENV SCRIPT ===');
console.log('GEMINI_API_KEY from env:', process.env.GEMINI_API_KEY ? 'FOUND' : 'NOT FOUND');
console.log('Using key starting with:', apiKey.substring(0, 8) + '...');
console.log('Key length:', apiKey.length);
console.log('GOOGLE_CLIENT_ID:', googleClientId ? 'FOUND' : 'NOT FOUND');

const content = `export const environment = {
  production: true,
  geminiApiKey: '${apiKey}',
  googleClientId: '${googleClientId}'
};
`;

fs.writeFileSync(envFile, content);
console.log('Environment file written to:', envFile);
console.log('======================');
