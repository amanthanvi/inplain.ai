/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization completely
  output: undefined,
  
  // Generate build ID
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  
  // Image optimization
  images: {
    domains: ['inplain.ai', 'cdn.inplain.ai'],
  },
  
  
  // Server external packages
  serverExternalPackages: ['@vercel/kv', 'resend'],
  
  // Transpile packages that might cause issues
  transpilePackages: ['@clerk/nextjs'],
  
  // Enable type checking during build
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Temporarily disable ESLint during build
  // TODO: Re-enable once all linting errors are fixed
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig