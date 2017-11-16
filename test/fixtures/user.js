// node core modules

// 3rd party modules

// internal modules
const providers = require('./providers');

module.exports = {
  getCredentialsForProvider: (providerName, reqParams, cb) => cb(null, providers[providerName](reqParams)),
  getCredentialsWithError: (providerName, reqParams, cb) => cb(new Error('credentials error')),
};
