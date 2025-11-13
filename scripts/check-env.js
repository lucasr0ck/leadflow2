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
}

console.log('check-env: OK');
