# Inplain.ai Browser Extension

A browser extension that allows users to quickly check privacy policies and monitor privacy changes across the web.

## Features

- **Quick Privacy Check**: Instantly view privacy scores and ratings for the current website
- **AI-Powered Summaries**: Get concise, easy-to-understand summaries of privacy policies
- **Change Monitoring**: See recent policy changes with severity indicators
- **Watchlist Integration**: Add companies to your watchlist directly from the browser
- **Privacy Score Breakdown**: Detailed analysis of data collection, sharing, user rights, security, and retention
- **Offline Caching**: Fast access to previously viewed privacy information
- **Dark Mode Support**: Comfortable viewing in any lighting condition

## Installation

### Development

1. Install dependencies:

    ```bash
    npm install
    ```

2. Build the extension:

    ```bash
    npm run build
    ```

3. Load in Chrome/Edge:
    - Open `chrome://extensions/` or `edge://extensions/`
    - Enable "Developer mode"
    - Click "Load unpacked"
    - Select the `dist` folder

### Production

1. Build and package:

    ```bash
    npm run package
    ```

2. The packaged extension will be available as `inplain-extension.zip`

## Configuration

1. Click the extension icon and follow the setup instructions
2. Get your API key from [Inplain.ai Settings](https://inplain.ai/settings)
3. Enter your API key in the extension settings

## Development

### Project Structure

```
src/
├── background/       # Service worker for background tasks
├── content/         # Content scripts for page interaction
├── popup/           # Extension popup UI
├── options/         # Settings page
├── components/      # React components
├── lib/            # Utilities and API client
└── styles/         # CSS styles
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run clean` - Clean build artifacts
- `npm run package` - Build and create distribution zip

### API Integration

The extension uses the Inplain.ai API v1 endpoints:

- `GET /api/v1/companies/{slug}` - Get company information
- `GET /api/v1/companies/{slug}/score` - Get privacy score
- `GET /api/v1/companies/{slug}/changes` - Get recent policy changes
- `GET /api/v1/summary/{slug}` - Get AI-generated summary
- `POST /api/v1/user/watchlist` - Add to watchlist
- `DELETE /api/v1/user/watchlist` - Remove from watchlist

### Technologies

- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Storage**: Chrome Storage API
- **Manifest**: V3 (latest Chrome extension standard)

## Privacy & Security

- API keys are stored securely in Chrome's sync storage
- All API requests use HTTPS
- Cached data is stored locally and expires automatically
- No tracking or analytics are included
- Minimal permissions requested (only what's necessary)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

Apache-2.0 License - see the main repository for details.
