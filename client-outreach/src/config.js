require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  port: parseInt(process.env.PORT || '3456'),
  jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
  adminPassword: process.env.ADMIN_PASSWORD || 'farhan555',

  brevoApiKey: process.env.BREVO_API_KEY || '',
  senderEmail: process.env.SENDER_EMAIL || 'tanjiro.kamado9u@gmail.com',

  notificationEmail: process.env.NOTIFICATION_EMAIL || '',

  instagram: {
    username: process.env.INSTAGRAM_USERNAME || '',
    password: process.env.INSTAGRAM_PASSWORD || ''
  },

  demoLink: process.env.DEMO_LINK || 'https://cleaning-service-one-lyart.vercel.app/',
  dentalDemoLink: process.env.DENTAL_DEMO_LINK || 'https://bright-smile-tan.vercel.app/',
  dentalDemoLink2: process.env.DENTAL_DEMO_LINK_2 || 'https://dental-clinic-usa.vercel.app/',

  searchQueries: {
    cleaning: 'cleaning service',
    dental: 'dentist'
  },

  nicheLabels: {
    cleaning: 'cleaning business',
    dental: 'dental practice'
  },

  schedule: {
    followup1Day: parseInt(process.env.FOLLOWUP_1_DAY || '3'),
    followup2Day: parseInt(process.env.FOLLOWUP_2_DAY || '5'),
    closingDay: parseInt(process.env.CLOSING_DAY || '7')
  },

  imap: {
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT || '993'),
    user: process.env.IMAP_USER || '',
    pass: process.env.IMAP_PASS || ''
  },

  scraper: {
    delayMs: parseInt(process.env.SCRAPER_DELAY_MS || '3000'),
    cities: (process.env.SCRAPER_CITIES || 'New York,Los Angeles,Chicago').split(',').map(c => c.trim())
  }
};
