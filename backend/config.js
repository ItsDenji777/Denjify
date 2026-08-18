export default {
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'denjify',
    waitForConnections: true,
    connectionLimit: 10,
  },
  port: process.env.PORT || 9045,
  musicLibraryRoot: process.env.MUSIC_LIBRARY_ROOT || null,
  discordClientId: '1510625208825020467',
  imgbbApiKey: 'YOUR_IMGBB_API_KEY',
  watcherEnabled: false,
  syncEnabled: false,
};