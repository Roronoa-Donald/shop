require('dotenv').config();
const build = require('./server');

const start = async () => {
  const server = await build();

  try {
    await server.listen({
      port: process.env.PORT || 3000,
      host: '0.0.0.0'
    });
    console.log(`Server running at http://localhost:${process.env.PORT || 3000}`);
  } catch (err) {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
};

start();
