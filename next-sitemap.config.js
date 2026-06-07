/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: 'https://codeautopsy-lyart.vercel.app',
  generateRobotsTxt: true,
  exclude: [
    '/api/*',
    '/auth/*',
    '/dashboard',
    '/dashboard/*',
    '/profile',
    '/history',
    '/analyze',
    '/pr-scan',
    '/view/*',
    '/actions/*',
  ],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      { userAgent: '*', disallow: ['/api/', '/auth/', '/dashboard/', '/profile/', '/history/', '/analyze/', '/pr-scan/', '/view/'] },
    ],
  },
};

export default config;
