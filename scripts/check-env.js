#!/usr/bin/env node
// Simple pre-build check to prevent embedding SERVICE_ROLE key into frontend builds.
const forbidden = 'VITE_SUPABASE_SERVICE_ROLE_KEY';
const anonKey = 'VITE_SUPABASE_ANON_KEY';

if (process.env[forbidden]) {
  console.error(`ERROR: Detected ${forbidden} in build environment. This key MUST NOT be present for frontend builds.`);
  console.error('Remove it from your CI / hosting build env and use the service role only on the server side.');
  process.exit(1);
}

if (!process.env[anonKey]) {
  console.warn(`WARNING: ${anonKey} is not defined in the build environment. The frontend will fail to connect to Supabase.`);
} else {
  // Extra safety: ensure the ANON key does not actually contain a service_role token
  try {
    const token = process.env[anonKey];
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      const role = payload && (payload.role || (payload['https://hasura.io/jwt/claims'] && payload['https://hasura.io/jwt/claims'].role));
      if (role === 'service_role') {
        console.error('ERROR: The value of VITE_SUPABASE_ANON_KEY appears to contain a service_role token.');
        console.error('This will leak privileged credentials to the browser. Remove/rotate keys and set the correct ANON key.');
        process.exit(1);
      }
    }
  } catch (e) {
    console.warn('WARNING: Could not parse VITE_SUPABASE_ANON_KEY JWT payload (non-fatal).');
  }
}

console.log('check-env: OK');
