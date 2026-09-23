import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Hay un package-lock.json en la carpeta de usuario: fijamos la raíz del proyecto.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
