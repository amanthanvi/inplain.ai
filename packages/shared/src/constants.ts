import type { Company } from './schemas'

export const WATCHED_COMPANIES: Company[] = [
  // Technology
  {
    slug: 'google',
    name: 'Google',
    url: 'https://policies.google.com/privacy',
    category: 'technology',
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
    slug: 'meta',
    name: 'Meta',
    url: 'https://www.facebook.com/privacy/policy',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'openai',
    name: 'OpenAI',
    url: 'https://openai.com/policies/privacy-policy',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'anthropic',
    name: 'Anthropic',
    url: 'https://www.anthropic.com/privacy',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'adobe',
    name: 'Adobe',
    url: 'https://www.adobe.com/privacy/policy.html',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'oracle',
    name: 'Oracle',
    url: 'https://www.oracle.com/legal/privacy/privacy-policy.html',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'salesforce',
    name: 'Salesforce',
    url: 'https://www.salesforce.com/company/privacy/',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'github',
    name: 'GitHub',
    url: 'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'nvidia',
    name: 'NVIDIA',
    url: 'https://www.nvidia.com/en-us/about-nvidia/privacy-policy/',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'intel',
    name: 'Intel',
    url: 'https://www.intel.com/content/www/us/en/privacy/intel-privacy-notice.html',
    category: 'technology',
    active: true,
    checkInterval: 86400
  },
  
  // Social Media
  {
    slug: 'facebook',
    name: 'Facebook',
    url: 'https://www.facebook.com/privacy/policy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'instagram',
    name: 'Instagram',
    url: 'https://help.instagram.com/155833707900388',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'twitter',
    name: 'Twitter/X',
    url: 'https://twitter.com/en/privacy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'linkedin',
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/legal/privacy-policy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'tiktok',
    name: 'TikTok',
    url: 'https://www.tiktok.com/legal/privacy-policy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'snapchat',
    name: 'Snapchat',
    url: 'https://www.snap.com/en-US/privacy/privacy-policy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'pinterest',
    name: 'Pinterest',
    url: 'https://policy.pinterest.com/en/privacy-policy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'reddit',
    name: 'Reddit',
    url: 'https://www.reddit.com/policies/privacy-policy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'discord',
    name: 'Discord',
    url: 'https://discord.com/privacy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://www.whatsapp.com/legal/privacy-policy',
    category: 'social-media',
    active: true,
    checkInterval: 86400
  },
  
  // E-commerce
  {
    slug: 'amazon',
    name: 'Amazon',
    url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496',
    category: 'e-commerce',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'ebay',
    name: 'eBay',
    url: 'https://www.ebay.com/help/policies/member-behaviour-policies/user-privacy-notice-privacy-policy?id=4260',
    category: 'e-commerce',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'shopify',
    name: 'Shopify',
    url: 'https://www.shopify.com/legal/privacy',
    category: 'e-commerce',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'alibaba',
    name: 'Alibaba',
    url: 'https://www.alibabagroup.com/en-US/privacy-policy',
    category: 'e-commerce',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'etsy',
    name: 'Etsy',
    url: 'https://www.etsy.com/legal/privacy/',
    category: 'e-commerce',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'walmart',
    name: 'Walmart',
    url: 'https://corporate.walmart.com/privacy-security/walmart-privacy-policy',
    category: 'e-commerce',
    active: true,
    checkInterval: 86400
  },
  
  // Entertainment & Streaming
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
  },
  {
    slug: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/howyoutubeworks/user-settings/privacy/',
    category: 'entertainment',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'disney-plus',
    name: 'Disney+',
    url: 'https://www.disneyplus.com/legal/privacy-policy',
    category: 'entertainment',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'hulu',
    name: 'Hulu',
    url: 'https://www.hulu.com/privacy',
    category: 'entertainment',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'hbo-max',
    name: 'HBO Max',
    url: 'https://www.warnermediaprivacy.com/',
    category: 'entertainment',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'twitch',
    name: 'Twitch',
    url: 'https://www.twitch.tv/p/legal/privacy-notice/',
    category: 'entertainment',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'paramount-plus',
    name: 'Paramount+',
    url: 'https://www.paramountplus.com/privacy-policy/',
    category: 'entertainment',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'peacock',
    name: 'Peacock',
    url: 'https://www.peacocktv.com/privacy',
    category: 'entertainment',
    active: true,
    checkInterval: 86400
  },
  
  // Finance & Banking
  {
    slug: 'paypal',
    name: 'PayPal',
    url: 'https://www.paypal.com/us/legalhub/privacy-full',
    category: 'finance',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'stripe',
    name: 'Stripe',
    url: 'https://stripe.com/privacy',
    category: 'finance',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'square',
    name: 'Square',
    url: 'https://squareup.com/us/en/legal/general/privacy',
    category: 'finance',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'coinbase',
    name: 'Coinbase',
    url: 'https://www.coinbase.com/legal/privacy',
    category: 'finance',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'robinhood',
    name: 'Robinhood',
    url: 'https://robinhood.com/us/en/about/legal/privacy/',
    category: 'finance',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'venmo',
    name: 'Venmo',
    url: 'https://www.venmo.com/legal/us-privacy-policy/',
    category: 'finance',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'cash-app',
    name: 'Cash App',
    url: 'https://cash.app/legal/us/en-us/privacy',
    category: 'finance',
    active: true,
    checkInterval: 86400
  },
  
  // Gaming
  {
    slug: 'steam',
    name: 'Steam',
    url: 'https://store.steampowered.com/privacy_agreement/',
    category: 'gaming',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'epic-games',
    name: 'Epic Games',
    url: 'https://www.epicgames.com/site/en-US/privacypolicy',
    category: 'gaming',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'playstation',
    name: 'PlayStation',
    url: 'https://www.playstation.com/en-us/legal/privacy-policy/',
    category: 'gaming',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'xbox',
    name: 'Xbox',
    url: 'https://privacy.microsoft.com/en-us/privacystatement#mainxboxmodule',
    category: 'gaming',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'nintendo',
    name: 'Nintendo',
    url: 'https://www.nintendo.com/us/privacy-policy/',
    category: 'gaming',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'roblox',
    name: 'Roblox',
    url: 'https://en.help.roblox.com/hc/en-us/articles/115004630823-Roblox-Privacy-and-Cookie-Policy',
    category: 'gaming',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'minecraft',
    name: 'Minecraft',
    url: 'https://www.minecraft.net/en-us/privacy/mojang',
    category: 'gaming',
    active: true,
    checkInterval: 86400
  },
  
  // Travel & Transportation
  {
    slug: 'uber',
    name: 'Uber',
    url: 'https://www.uber.com/legal/en/document/?name=privacy-notice',
    category: 'transportation',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'lyft',
    name: 'Lyft',
    url: 'https://www.lyft.com/privacy',
    category: 'transportation',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'airbnb',
    name: 'Airbnb',
    url: 'https://www.airbnb.com/help/article/2855',
    category: 'travel',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'booking-com',
    name: 'Booking.com',
    url: 'https://www.booking.com/content/privacy.html',
    category: 'travel',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'expedia',
    name: 'Expedia',
    url: 'https://www.expedia.com/lp/lg-privacypolicy',
    category: 'travel',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'tripadvisor',
    name: 'TripAdvisor',
    url: 'https://tripadvisor.mediaroom.com/us-privacy-policy',
    category: 'travel',
    active: true,
    checkInterval: 86400
  },
  
  // Food Delivery
  {
    slug: 'doordash',
    name: 'DoorDash',
    url: 'https://help.doordash.com/legal/document?type=cx-privacy-policy',
    category: 'food-delivery',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'uber-eats',
    name: 'Uber Eats',
    url: 'https://www.uber.com/legal/en/document/?name=privacy-notice',
    category: 'food-delivery',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'grubhub',
    name: 'Grubhub',
    url: 'https://www.grubhub.com/legal/privacy-policy',
    category: 'food-delivery',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'instacart',
    name: 'Instacart',
    url: 'https://www.instacart.com/privacy',
    category: 'food-delivery',
    active: true,
    checkInterval: 86400
  },
  
  // Healthcare
  {
    slug: 'teladoc',
    name: 'Teladoc',
    url: 'https://www.teladoc.com/privacy-policy/',
    category: 'healthcare',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'goodrx',
    name: 'GoodRx',
    url: 'https://www.goodrx.com/privacy-policy',
    category: 'healthcare',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'zocdoc',
    name: 'Zocdoc',
    url: 'https://www.zocdoc.com/about/privacy/',
    category: 'healthcare',
    active: true,
    checkInterval: 86400
  },
  
  // Education
  {
    slug: 'coursera',
    name: 'Coursera',
    url: 'https://www.coursera.org/about/privacy',
    category: 'education',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'udemy',
    name: 'Udemy',
    url: 'https://www.udemy.com/terms/privacy/',
    category: 'education',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'khan-academy',
    name: 'Khan Academy',
    url: 'https://www.khanacademy.org/about/privacy-policy',
    category: 'education',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'duolingo',
    name: 'Duolingo',
    url: 'https://www.duolingo.com/privacy',
    category: 'education',
    active: true,
    checkInterval: 86400
  },
  
  // Communication
  {
    slug: 'zoom',
    name: 'Zoom',
    url: 'https://zoom.us/privacy',
    category: 'communication',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'slack',
    name: 'Slack',
    url: 'https://slack.com/privacy-policy',
    category: 'communication',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'telegram',
    name: 'Telegram',
    url: 'https://telegram.org/privacy',
    category: 'communication',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'signal',
    name: 'Signal',
    url: 'https://signal.org/legal/',
    category: 'communication',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'skype',
    name: 'Skype',
    url: 'https://privacy.microsoft.com/en-us/privacystatement#mainskypemodule',
    category: 'communication',
    active: true,
    checkInterval: 86400
  },
  
  // Productivity
  {
    slug: 'notion',
    name: 'Notion',
    url: 'https://www.notion.so/Privacy-Policy',
    category: 'productivity',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'dropbox',
    name: 'Dropbox',
    url: 'https://www.dropbox.com/privacy',
    category: 'productivity',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'evernote',
    name: 'Evernote',
    url: 'https://evernote.com/privacy',
    category: 'productivity',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'trello',
    name: 'Trello',
    url: 'https://www.atlassian.com/legal/privacy-policy',
    category: 'productivity',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'asana',
    name: 'Asana',
    url: 'https://asana.com/terms#privacy',
    category: 'productivity',
    active: true,
    checkInterval: 86400
  },
  
  // News & Media
  {
    slug: 'cnn',
    name: 'CNN',
    url: 'https://www.cnn.com/privacy',
    category: 'news',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'bbc',
    name: 'BBC',
    url: 'https://www.bbc.com/usingthebbc/privacy/',
    category: 'news',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'nytimes',
    name: 'The New York Times',
    url: 'https://www.nytimes.com/privacy/privacy-policy',
    category: 'news',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'wsj',
    name: 'Wall Street Journal',
    url: 'https://www.dowjones.com/privacy-notice/',
    category: 'news',
    active: true,
    checkInterval: 86400
  },
  
  // Dating
  {
    slug: 'tinder',
    name: 'Tinder',
    url: 'https://policies.tinder.com/privacy',
    category: 'dating',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'bumble',
    name: 'Bumble',
    url: 'https://bumble.com/en/privacy',
    category: 'dating',
    active: true,
    checkInterval: 86400
  },
  {
    slug: 'hinge',
    name: 'Hinge',
    url: 'https://hinge.co/privacy',
    category: 'dating',
    active: true,
    checkInterval: 86400
  }
]