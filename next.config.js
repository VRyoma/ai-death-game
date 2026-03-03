/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  reactStrictMode: false,
  // GitHub Pages 用に静的 export し、プロジェクトページのパスに対応
  output: 'export',
  basePath: isProd ? '/ai-death-game' : '',
  assetPrefix: isProd ? '/ai-death-game/' : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? '/ai-death-game' : '',
  },
  // 静的エクスポートではImage Optimization APIが動作しない
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
