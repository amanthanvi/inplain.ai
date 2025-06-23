# PolicyDiff Web Application

Track and understand privacy policy changes with AI-powered analysis.

## Quick Start

```bash
# Install dependencies
npm install

# Run interactive setup
npm run setup

# Start development server
npm run dev
```

Visit http://localhost:3000

## Features

- 🔍 **Policy Monitoring** - Automated daily checks for privacy policy changes
- 🤖 **AI Analysis** - Smart summaries of what changed and why it matters
- 📊 **Analytics Dashboard** - Risk scores, trends, and insights
- 🔔 **Alerts** - Get notified when policies change (Premium)
- 📦 **Data Export** - Export changes and analytics (Premium)

## Environment Setup

### Option 1: Interactive Setup (Recommended)

```bash
npm run setup
```

Choose between:
- **Demo Mode** - No API keys required, uses mock data
- **Full Mode** - Requires OpenRouter API key for AI features

### Option 2: Manual Setup

1. Copy `.env.example` to `.env.local`
2. Add your API keys:
   - `OPENROUTER_API_KEY` - Get from [OpenRouter](https://openrouter.ai/keys)
   - `KV_REST_API_URL` & `KV_REST_API_TOKEN` - From Vercel KV (optional)
   - `RESEND_API_KEY` - For email alerts (optional)

## Common Issues

### "KV not configured" Warning
- **In Development**: This is normal, data is stored in memory
- **In Production**: Configure Vercel KV in your dashboard

### AI Analysis Not Working
- **Check API Key**: Ensure `OPENROUTER_API_KEY` is set correctly
- **Check Credits**: Verify you have credits at [OpenRouter](https://openrouter.ai/dashboard)
- **Try Demo Mode**: Run without API key to test with mock data

### 404 Errors on Company Pages
- New companies need their first snapshot (captured daily at 9 AM UTC)
- Or manually trigger: `npm run cron:local`

### Rate Limit Errors
- Wait 60 seconds between requests
- Check your OpenRouter plan limits
- Use cheaper/faster models in settings

## Development Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run test         # Run tests

# Setup & Testing
npm run setup        # Interactive environment setup
npm run seed         # Add test data
npm run test:api     # Test API endpoints
npm run test:auth    # Test authentication

# Utilities
npm run cron:local   # Run monitoring job locally
npm run dev:auth:on  # Enable dev authentication
```

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed solutions.

### Quick Fixes

1. **Clear all caches**: `rm -rf .next && npm run dev`
2. **Reset environment**: `npm run setup`
3. **Check status**: Visit `/api/health`
4. **View logs**: Check browser console and terminal

## Architecture

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Next.js API Routes (Edge Runtime)
- **Database**: Vercel KV (Redis)
- **AI**: OpenRouter (Multiple LLM providers)
- **Storage**: Vercel Blob (Policy snapshots)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Run tests: `npm test`
4. Submit a pull request

## License

MIT - See LICENSE file for details