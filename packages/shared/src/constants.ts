import type { Company } from './schemas'

export const WATCHED_COMPANIES: Company[] = [
  {
    slug: 'google',
    name: 'Google',
    url: 'https://policies.google.com/privacy',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'facebook',
    name: 'Facebook',
    url: 'https://www.facebook.com/privacy/policy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'amazon',
    name: 'Amazon',
    url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496',
    category: 'e-commerce',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'microsoft',
    name: 'Microsoft',
    url: 'https://privacy.microsoft.com/en-us/privacystatement',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'apple',
    name: 'Apple',
    url: 'https://www.apple.com/legal/privacy/',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'twitter',
    name: 'Twitter',
    url: 'https://twitter.com/en/privacy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'netflix',
    name: 'Netflix',
    url: 'https://help.netflix.com/legal/privacy',
    category: 'entertainment',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'spotify',
    name: 'Spotify',
    url: 'https://www.spotify.com/us/legal/privacy-policy/',
    category: 'entertainment',
    active: true,
    checkInterval: 86400
  }
]