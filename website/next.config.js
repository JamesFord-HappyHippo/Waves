/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? '/waves-website' : '',
  basePath: process.env.NODE_ENV === 'production' ? '/waves-website' : '',
}

module.exports = nextConfig