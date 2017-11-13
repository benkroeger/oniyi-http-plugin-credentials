'use strict';

// node core modules

// 3rd party modules

// internal modules

const areCredentialsExpired = (credentials, callback) =>
  callback(null, credentials.expiresAt && credentials.expiresAt < Date.now());

const refreshCredentials = (strategy, currentCredentials, callback) => {
  const params = { grant_type: 'refresh_token' };
  // eslint-disable-next-line no-underscore-dangle
  strategy._oauth2.getOAuthAccessToken(
    currentCredentials.refreshToken,
    params,
    (err, accessToken, refreshToken, respParams) => {
      if (err) {
        callback(err);
        return;
      }

      // @TODO: add max expiresIn and default issuedOn
      const expiresIn = respParams && respParams.expires_in ? parseInt(respParams.expires_in, 10) : undefined;
      const issuedOn = respParams && respParams.issued_on ? parseInt(respParams.issued_on, 10) : undefined;
      const expiresAt = issuedOn + expiresIn;

      // make credentials object
      const credentials = {
        accessToken,
        refreshToken,
        expiresAt,
        expiresIn,
        issuedOn,
        tokenType: respParams.token_type || 'Bearer',
      };

      callback(null, credentials);
    }
  );
};

const makeAuthParams = (credentials, callback) =>
  callback(null, { auth: { bearer: credentials.accessToken }, authType: 'oauth' });

module.exports = {
  areCredentialsExpired,
  refreshCredentials,
  makeAuthParams,
};
