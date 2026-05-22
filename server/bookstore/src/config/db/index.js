const mongoose = require('mongoose');
const { getMongoUri } = require('../appConfig');

async function connect() {
  const uri = getMongoUri();
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
  console.log('Connect successfully');
}

module.exports = { connect };
