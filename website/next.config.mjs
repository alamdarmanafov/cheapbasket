/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: the root Vercel project serves website/out at cheapbasket.vercel.app / cheapmarket.app.
  output: 'export',
  trailingSlash: false,
  images: { unoptimized: true },
};
export default nextConfig;
