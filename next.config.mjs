/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint belum dikonfigurasi di project ini; aktifkan setelah ada .eslintrc
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
