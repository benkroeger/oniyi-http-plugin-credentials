'use strict';

const _ = require('lodash');
const passport = require('passport');
const logger = require('oniyi-logger')('oniyi:http-client:plugin:attach-credentials');


function areCredentialsExpired(credentials, callback) {
  return callback(null, credentials.expiresAt && credentials.expiresAt < Date.now());
}

function refreshCredentials(strategy, currentCredentials, callback) {
  const params = { grant_type: 'refresh_token' };
  // eslint-disable-next-line no-underscore-dangle
  strategy._oauth2.getOAuthAccessToken(currentCredentials.refreshToken, params,
    (err, accessToken, refreshToken, respParams) => {
      if (err) {
        return callback(err);
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

      return callback(null, credentials);
    });
}

function makeAuthParams(credentials, callback) {
  return callback(null, {
    auth: {
      bearer: credentials.accessToken,
    },
    authType: 'oauth',
  });
}

module.exports = function attachCredentialsPluginFactory(pluginOptions) {
  // compile plugin options; set default values for properties that have not been provided
  const options = _.defaults({}, pluginOptions, {
    removeUserProp: true,
    areCredentialsExpired,
    refreshCredentials,
    makeAuthParams,
    // when the providerName ends with "-link", we'll find provider related credentials in the
    // "credentials" relation. Otherwise, provider related credentials will be available in the
    // "identities" relation of the user
    userRelationProp: /-link$/.test(pluginOptions.providerName) ? 'credentials' : 'identities',
    // name of the related document's property actually holding the credentials
    credentialsProp: 'credentials',
  });

  // options verification
  if (!_.isString(options.providerName)) {
    throw new TypeError(`options.providerName must be of type "String";
      provided: ${options.providerName} [${typeof options.providerName}]`);
  }

  if (!_.isFunction(options.areCredentialsExpired)) {
    throw new TypeError(`options.areCredentialsExpired must be of type "Function";
      provided: [${typeof options.areCredentialsExpired}]`);
  }

  if (!_.isFunction(options.refreshCredentials)) {
    throw new TypeError(`options.refreshCredentials must be of type "Function";
      provided: [${typeof options.refreshCredentials}]`);
  }

  if (!_.isFunction(options.makeAuthParams)) {
    throw new TypeError(`options.makeAuthParams must be of type "Function";
      provided: [${typeof options.makeAuthParams}]`);
  }

  return {
    name: 'attach-credentials',
    load: (req, origParams, callback) => {
      // create a copy of provided request parameters
      const reqParams = options.removeUserProp ? _.omit(origParams, ['user']) : _.assign({}, origParams || {});
      const user = origParams.user;

      if (!user) {
        logger.debug('No "user" prop found in request params, skipping plugin operations');
        return callback(null, origParams);
      }

      user[options.userRelationProp]({
        where: {
          provider: options.providerName,
        },
      }, (credentialsErr, results) => {
        if (credentialsErr) {
          logger.error(`Error while loading identities for user "${user.id}"`, credentialsErr);
          return callback(credentialsErr);
        }

        // verify results
        // must be array of length === 1
        if (!Array.isArray(results) || results.length !== 1) {
          if (!options.initCredentials) {
            logger.error(`Failed to load identities for user "${user.id}"`);
            logger.debug(`results is array? ${Array.isArray(results)}`);
            logger.debug(`results length? ${results.length}`);
            return callback(new Error(`Failed to load identities for user "${user.id}"`));
          }

          logger.debug(`Initializing credentials for user "${user.id}" and provider "${options.providerName}"`);
          options.initCredentials(user.id, (initCredsErr, results) => {
            if (initCredsErr) {
              return callback(initCredsErr);
            }

            const { credentials, authScheme } = results;
            user[options.userRelationProp].create({
              provider: options.providerName,
              authScheme,
              credentials,
            }, (createCredsErr, credentialsEntry) => {
              if (createCredsErr) {
                return callback(createCredsErr);
              }
              options.makeAuthParams(credentials, (authParamsErr, authParams) => {
                if (authParamsErr) {
                  return callback(authParamsErr);
                }
                _.merge(reqParams, authParams);

                return callback(null, reqParams);
              });
            });
          });
        }

        const identity = results[0];
        const credentials = identity[options.credentialsProp];

        if (!credentials) {
          logger.warn(`No credentials found for user "${user.id}" and provider "${options.providerName}"`);
          return callback(null, origParams);
        }

        if (!credentials.userId) {
          Object.assign(credentials, { userId: user.id });
        }

        // must handle credentials refresh in pre-flight phase due to possible use of stream API
        // with request. If client wants to send data, we can not ensure that data is still available
        // when retrying.
        options.areCredentialsExpired(credentials, (expiredErr, credentialsExpired) => {
          if (expiredErr) {
            return callback(expiredErr);
          }
          if (credentialsExpired) {
            logger.warn(`credentials for user "${user.id}" and provider "${options.providerName}" are expired`);

            // load the passport-strategy instance from passport
            // eslint-disable-next-line no-underscore-dangle
            const strategy = passport._strategy(options.providerName);
            if (!strategy) {
              throw new Error(`Auth provider with name "${options.providerName}" is not registered`);
            }

            return options.refreshCredentials(strategy, credentials, (refreshCredentialsErr, newCredentials) => {
              if (refreshCredentialsErr) {
                return callback(refreshCredentialsErr);
              }
              // store new credentials in the user's identities / credentials
              identity.updateAttribute(options.credentialsProp, newCredentials,
                (updateIdentityErr, updatedIdentity) => {
                  if (updateIdentityErr) {
                    return callback(updateIdentityErr);
                  }

                  logger.debug('updated user identity', updatedIdentity);

                  // pass newCredentials to makeAuthParams and merge return value with the modified request parameters
                  // explicitly using "merge" here to allow partial updates of nested object literals
                  options.makeAuthParams(newCredentials, (authParamsErr, authParams) => {
                    if (authParamsErr) {
                      return callback(authParamsErr);
                    }
                    _.merge(reqParams, authParams);

                    // finish plugin execution; hand over the modified request parameters
                    return callback(null, reqParams);
                  });
                  return null;
                });
              return null;
            });
          }

          // when original credentials were not expired, attach them to the request parameters and finish
          // plugin execution

          // pass credentials to makeAuthParams and merge return value with the modified request parameters
          // explicitly using "merge" here to allow partial updates of nested object literals
          options.makeAuthParams(credentials, (authParamsErr, authParams) => {
            if (authParamsErr) {
              return callback(authParamsErr);
            }
            _.merge(reqParams, authParams);

            // finish plugin execution; hand over the modified request parameters
            return callback(null, reqParams);
          });
          return null;
        });
        return null;
      });
      return null;
    },
  };
};


// remember reference to the original callback function
// const originalCallback = origParams.callback;

// reqParams.callback = (requestErr, response, body) => {
//   if (requestErr) {
//     return originalCallback(requestErr, response, body);
//   }
//   // this approach lacks support of data-providing requests
//   // stream API
//   if (response && response.statusCode === 401) {
//     return refreshCredentials(strategy, credentials, (refreshCredentialsErr, newCredentials) => {
//       if (refreshCredentialsErr) {
//         return originalCallback(requestErr, response, body);
//       }
//       // store new credentials in the user's identities / credentials
//       identity.updateAttribute(options.credentialsProp, newCredentials,
//         (updateIdentityErr, updatedIdentity) => {
//           if (updateIdentityErr) {
//             return originalCallback(requestErr, response, body);
//           }
//           // update request parameters with new accessToken and original callback function
//           reqParams.auth = {
//             bearer: newCredentials.accessToken,
//           };
//           reqParams.callback = originalCallback;
//           // restart the request
//           return callback(null, reqParams);
//         });
//     });
//   }
//   return originalCallback(requestErr, response, body);
// };
