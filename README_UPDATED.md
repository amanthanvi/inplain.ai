# PolicyDiff

> Production-ready privacy policy monitoring with AI-powered insights

PolicyDiff automatically tracks changes to privacy policies and terms of service, providing clear summaries of what changed and why it matters to users.

## 🌟 Features

### Core Functionality
- **🔍 Automated Monitoring**: Daily tracking of privacy policies from major companies
- **📊 Visual Diffs**: Clear highlighting of additions, deletions, and modifications
- **🤖 AI Analysis**: Intelligent summaries explaining impact and risk levels
- **📈 Change History**: Complete timeline of all policy updates
- **🎯 Risk Assessment**: Automatic categorization of change severity

### User Experience
- **📱 Responsive Design**: Works seamlessly on all devices
- **🚀 Real-time Updates**: Streaming AI analysis with progress indicators
- **💡 Smart Insights**: Tailored for both consumers and privacy professionals
- **🔔 Status Monitoring**: Built-in health checks and configuration status

### Technical Excellence
- **🏗️ Production-Ready**: Comprehensive error handling and fallbacks
- **📦 Demo Mode**: Fully functional without API keys for evaluation
- **🔐 Privacy-First**: No user tracking, transparent operations
- **⚡ Edge Optimized**: Fast global performance with caching

## 🚀 Quick Start

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Famanthanvi%2Fpolicydiff&env=OPENROUTER_API_KEY,CRON_SECRET&envDescription=Required%20environment%20variables&envLink=https%3A%2F%2Fgithub.com%2Famanthanvi%2Fpolicydiff%2Fblob%2Fmain%2FDEPLOYMENT_GUIDE.md)

### Local Development

```bash
# Clone repository
git clone https://github.com/amanthanvi/policydiff.git
cd policydiff

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run development server
npm run dev

# Open browser
open http://localhost:3000
```

## 📋 Configuration

### Required Environment Variables

```env
# AI Service (get from https://openrouter.ai/)
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Cron Security
CRON_SECRET=your-secure-random-string
```

### Optional Configuration

```env
# AI Model Selection
DEFAULT_AI_MODEL=google/gemini-2.0-flash-exp:free

# Storage (auto-configured by Vercel)
KV_REST_API_URL=xxxxx
KV_REST_API_TOKEN=xxxxx
```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, React 19, Tailwind CSS v4
- **Backend**: Next.js App Router, Edge Functions
- **AI**: OpenRouter API (Multiple models supported)
- **Storage**: Vercel KV (metadata), Vercel Blob (content)
- **Monitoring**: Cron jobs, real-time health checks

### Key Components
- **Snapshot System**: Captures and stores policy versions
- **Diff Engine**: Generates visual and semantic differences
- **AI Pipeline**: Streaming analysis with fallback support
- **Status Monitor**: Real-time configuration and health checks

## 📊 Usage Examples

### For Consumers
- Track how your favorite apps handle your data
- Get notified when privacy terms change
- Understand complex legal language in plain English

### For Professionals
- Monitor compliance across multiple platforms
- Generate reports on policy evolution
- API access for integration with existing tools

### For Researchers
- Access historical policy data
- Analyze trends in privacy practices
- Export data for academic research

## 🔧 Advanced Features

### API Endpoints
- `GET /api/diff/[company]` - Latest policy changes
- `POST /api/summary/[company]` - AI-powered analysis
- `GET /api/snapshot/[company]` - Current policy version
- `GET /api/models` - Available AI models

### Monitoring Tools
- `/api/debug` - Environment configuration check
- `/api/debug/ai-test` - AI service validation
- Built-in status widget for real-time monitoring

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📈 Roadmap

### Near Term
- [ ] Browser extension for real-time notifications
- [ ] Email alerts for policy changes
- [ ] API rate limiting and authentication
- [ ] Webhook support for integrations

### Long Term
- [ ] Multi-language support
- [ ] Custom policy monitoring
- [ ] Mobile applications
- [ ] Enterprise features

## 🙏 Acknowledgments

- OpenRouter for AI infrastructure
- Vercel for hosting and storage
- Open source community for inspiration

## 📄 License

This project is licensed under the Apache 2.0 License - see [LICENSE](./LICENSE) for details.

## 🔗 Links

- [Live Demo](https://policydiff.vercel.app)
- [Documentation](./docs)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Architecture Overview](./ARCHITECTURE.md)

---

Built with ❤️ to make privacy policies accessible to everyone