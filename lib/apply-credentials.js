'use strict';

// node core modules

// 3rd party modules
const _ = require('lodash');

// internal modules

const basic = (reqParams, payload) => {
  const {
    username, password, sendImmediately = true, authType = 'basic',
  } = payload;

  return _.merge({}, reqParams, { authType, auth: { username, password, sendImmediately } });
};

const bearer = (reqParams, payload) => {
  const { token, sendImmediately = true, authType = 'oauth' } = payload;

  return _.merge({}, reqParams, { authType, auth: { bearer: token, sendImmediately } });
};

const cookie = (reqParams, payload) => {
  const { cookie: cookiePayload, authType = 'cookie' } = payload;
  const originalCookieHeader = _.get(reqParams, 'headers.cookie');
  const newCookieHeader = originalCookieHeader ? `${originalCookieHeader};${cookiePayload}` : cookiePayload;

  return _.merge({}, reqParams, { authType, headers: { cookie: newCookieHeader } });
};

// const cookieJar = () => {};
const header = (reqParams, payload) => {
  const { authType, name = 'authorization', value } = payload;
  return _.merge({}, reqParams, { authType, headers: { [name]: value } });
};

const applyCredentialsByType = {
  basic,
  bearer,
  cookie,
  // cookieJar,
  header,
};

const applyCredentials = (reqParams, { type, payload = {} }, callback) => {
  const { [type]: applyCredentialsImpl } = applyCredentialsByType;

  if (!_.isFunction(applyCredentialsImpl)) {
    callback(new Error(`credentials type ${type} is not supported`));
    return;
  }

  const reqParamsWithCredentials = applyCredentialsImpl(reqParams, payload);
  callback(null, _.defaults(reqParamsWithCredentials, { authType: type }));
};

module.exports = { applyCredentials, applyCredentialsByType };
