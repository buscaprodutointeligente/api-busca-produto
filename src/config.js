const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  ml: {
    baseUrl: 'https://api.mercadolibre.com',
    siteId: 'MLB',
    searchLimit: 50,
    concurrency: 5,
    searchCacheTTLHours: 2,
    itemCacheTTLHours: 24,
    appId: process.env.ML_APP_ID,
    clientSecret: process.env.ML_CLIENT_SECRET,
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY,
    cseId: process.env.GOOGLE_CSE_ID,
  },
  serpapi: {
    apiKey: process.env.SERPAPI_KEY,
  },
};

export default config;
