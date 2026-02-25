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
  },
};

export default config;
