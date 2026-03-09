require('dotenv').config();
const build = require('../backend/src/server');

let app;

module.exports = async (req, res) => {
  if (!app) {
    app = await build();
    await app.ready();
  }
  app.server.emit('request', req, res);
};
