/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  // No .eslintrc exists in this project — without this, `next build` can
  // prompt interactively to set one up on first run, which would hang a
  // non-interactive buyer/CI build. Explicit and deterministic instead.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
