# Test Data Setup Scripts

This directory contains scripts to help set up test data for development and testing.

## Available Scripts

### setup-test-data.js
Creates test user accounts and comprehensive test data including:
- Test users with different subscription tiers (free, premium, enterprise)
- Policy snapshots and diffs for multiple companies
- Watchlists and alerts
- AI analysis data

### seed-data.js
Original seed script that creates basic policy data without user accounts.

## Usage

### Prerequisites
1. Ensure you have Vercel KV configured:
   ```bash
   vercel env pull
   ```

2. Make sure your `.env.local` file contains:
   ```
   KV_REST_API_URL=your_kv_rest_api_url
   KV_REST_API_TOKEN=your_kv_rest_api_token
   KV_REST_API_READ_ONLY_TOKEN=your_kv_read_only_token
   ```

### Running the Setup Script

```bash
# Run the test data setup
npm run setup:test-data

# Or run directly
node scripts/setup-test-data.js
```

## Test User Accounts

The script creates the following test accounts:

| Email | Password | Tier | Features |
|-------|----------|------|----------|
| free@test.com | testpass123 | Free | Basic access, limited API calls |
| premium@test.com | testpass123 | Premium | API key, webhooks, instant alerts |
| enterprise@test.com | testpass123 | Enterprise | Unlimited access, all features |

## Test Data Created

1. **Users**: 3 test accounts with different subscription tiers
2. **Companies**: 7 companies with privacy policies
3. **Snapshots**: 5 snapshots per company (weekly intervals)
4. **Diffs**: 4 diffs per company showing changes over time
5. **Watchlists**: 2 public watchlists
6. **Alerts**: Sample alerts for premium users
7. **AI Analysis**: Generated analysis for recent changes

## API Keys

Premium and Enterprise users will have API keys generated. The actual API key will be displayed in the console output when running the setup script. Save these keys as they cannot be retrieved later.

## Features You Can Test

After running the setup script, you can:

1. **Authentication**
   - Login with any test account
   - Test different tier limitations

2. **Policy Monitoring**
   - View policy changes and diffs
   - See timeline of changes
   - Test AI-powered analysis

3. **Premium Features**
   - Create and manage watchlists
   - Set up alerts and webhooks
   - Use API with generated keys
   - Export data

4. **Analytics**
   - View trend analysis
   - Risk scoring
   - Change frequency metrics

## Troubleshooting

If you encounter issues:

1. **KV_REST_API_URL not set**: Run `vercel env pull` or set environment variables manually
2. **Authentication errors**: Make sure the auth system is using the same password hashing method
3. **Data not appearing**: Check that your application is connected to the same KV store

## Development Tips

- Use the free account to test limitations and upgrade prompts
- Use premium/enterprise accounts to test full features
- API keys are shown only once during setup - save them!
- Modify the script to add more test data as needed