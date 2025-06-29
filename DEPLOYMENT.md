# Deployment Guide for Inplain.ai

## Environments

- **Production**: https://inplain.ai
- **Staging**: https://staging.inplain.ai
- **Preview**: Automatically created for PRs

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (`npm run test:all`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No linting errors (`npm run lint`)
- [ ] Bundle size within limits
- [ ] No console.logs in production code

### Security
- [ ] No secrets in code
- [ ] Environment variables documented
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Rate limiting enabled

### Database
- [ ] Migrations tested on staging
- [ ] Backup created before deployment
- [ ] Redis cache will be cleared if needed
- [ ] KV data structure changes documented

### Features
- [ ] Feature flags set correctly
- [ ] A/B tests configured
- [ ] New features documented
- [ ] Breaking changes communicated

## Deployment Process

### Staging Deployment

1. **Automatic Deployment**
   - Push to `staging` or `develop` branch
   - GitHub Actions runs tests
   - Deploys to staging environment

2. **Manual Deployment**
   ```bash
   vercel --prod --env-file=.env.staging
   ```

### Production Deployment

1. **Standard Flow**
   - Merge PR to `main` branch
   - GitHub Actions runs full test suite
   - Automatic deployment to production
   - Post-deployment checks run

2. **Emergency Deployment**
   - Use workflow dispatch with `skip_tests: true`
   - Only for critical fixes
   - Must be followed by proper testing

### Rollback Process

1. **Automatic Rollback**
   - Triggered if post-deployment checks fail
   - Reverts to previous deployment

2. **Manual Rollback**
   ```bash
   vercel rollback --token=$VERCEL_TOKEN
   ```

## Environment Variables

### Required for All Environments
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `OPENROUTER_API_KEY`

### Production Only
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `HEALTH_CHECK_TOKEN`
- `CRON_SECRET`

### Staging Only
- `DEBUG_MODE=true`
- `LOG_LEVEL=debug`

## Monitoring

### Health Checks
- Basic: `/api/health`
- Detailed: `/api/health/detailed` (requires auth token)
- Run locally: `npm run health:check`

### Alerts
- Sentry for errors
- Vercel Analytics for performance
- Custom alerts for:
  - API errors > 5% in 5 minutes
  - Response time > 3s
  - Cache hit rate < 50%

### Dashboards
- Vercel Dashboard: Performance metrics
- Sentry Dashboard: Error tracking
- Custom Dashboard: Business metrics

## Post-Deployment

### Verification Steps
1. Check health endpoints
2. Test critical user flows
3. Verify feature flags
4. Check error rates in Sentry
5. Monitor performance metrics

### Communication
1. Update #deployments Slack channel
2. Note any configuration changes
3. Document any issues encountered

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node version (requires 20.x)
   - Clear cache: `vercel --force`
   - Check environment variables

2. **Runtime Errors**
   - Check Sentry for detailed errors
   - Review Vercel Function logs
   - Verify environment variables

3. **Performance Issues**
   - Check Redis connection
   - Review API response times
   - Check for N+1 queries

### Debug Commands

```bash
# Check deployment status
vercel ls

# View logs
vercel logs

# Check environment
vercel env ls

# Run health check
npm run health:check production
```

## Deployment Schedule

- **Production**: Tuesday and Thursday mornings
- **Staging**: Continuous deployment
- **Hotfixes**: As needed with approval

## Contacts

- **DevOps Lead**: [Email]
- **On-Call Engineer**: Check PagerDuty
- **Escalation**: Engineering Manager

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Security Guidelines](./SECURITY.md)