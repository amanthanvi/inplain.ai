/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization to avoid export errors
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
  
  // Disable type checking during build (we'll run it separately)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig