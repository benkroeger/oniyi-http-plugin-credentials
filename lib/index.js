'use strict';

// node core modules

// 3rd party modules
const _ = require('lodash');
const async = require('async');
const passport = require('passport');
const debug = require('debug')('oniyi:http-client:plugin:attach-credentials');

// internal modules
const { areCredentialsExpired, refreshCredentials, makeAuthParams } = require('./default-methods');

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
    const err = new TypeError('options.providerName must be a "String"');
    debug(err.message, { options });
    throw err;
  }

  if (!_.isFunction(options.areCredentialsExpired)) {
    const err = new TypeError('options.areCredentialsExpired must be a "Function"');
    debug(err.message, { options });
    throw err;
  }

  if (!_.isFunction(options.refreshCredentials)) {
    const err = new TypeError('options.refreshCredentials must be a "Function"');
    debug(err.message, { options });
    throw err;
  }

  if (!_.isFunction(options.makeAuthParams)) {
    const err = new TypeError('options.makeAuthParams must be a "Function"');
    debug(err.message, { options });
    throw err;
  }

  return {
    name: 'attach-credentials',
    load: (req, origParams, callback) => {
      // create a copy of provided request parameters
      const reqParams = options.removeUserProp ? _.omit(origParams, ['user']) : _.assign({}, origParams || {});
      const { user } = origParams;

      if (!user) {
        debug('No "user" prop found in request params, skipping plugin operations', origParams);
        callback(null, origParams);
        return;
      }

      user[options.userRelationProp]({ where: { provider: options.providerName } }, (credentialsErr, results) => {
        if (credentialsErr) {
          debug('Error while loading identities for user "%s"', user.id, credentialsErr);
          callback(credentialsErr);
          return;
        }

        // verify results
        // must be array of length === 1
        if (!Array.isArray(results) || results.length !== 1) {
          if (!options.initCredentials) {
            debug('Failed to load identities for user "%s"', user.id, {
              resultsIsArray: Array.isArray(results),
              resultsLength: results.length,
              results,
            });

            callback(new Error(`Failed to load identities for user "${user.id}"`));
            return;
          }

          debug('Initializing credentials for user "%s" and provider "%s"', user.id, options.providerName);

          // Create a placeholder identity with empty credentials
          // and then update it with the initialized credentials once
          // they come back. Done this way to avoid race conditions
          // and multiple identity entries for the same provider when
          // multiple simultaneous calls are made to initCredentials.
          async.waterfall(
            [
              next => user[options.userRelationProp].create({ provider: options.providerName, credentials: {} }, next),
              (identity, next) =>
                options.initCredentials(user.id, (err, credentials) => next(err, { identity, credentials })),
              ({ identity, credentials }, next) =>
                identity.updateAttribute(options.credentialsProp, credentials, err => next(err, credentials)),
              (credentials, next) => options.makeAuthParams(credentials, next),
              (authParams, next) => next(null, _.merge(reqParams, authParams)),
            ],
            callback
          );
          return;
        }

        const identity = results[0];
        const credentials = identity[options.credentialsProp];

        if (!credentials) {
          debug('No credentials found for user "%s" and provider "%s"', user.id, options.providerName);
          callback(null, origParams);
          return;
        }

        if (!credentials.userId) {
          Object.assign(credentials, { userId: user.id });
        }

        // must handle credentials refresh in pre-flight phase due to possible use of stream API
        // with request. If client wants to send data, we can not ensure that data is still available
        // when retrying.
        options.areCredentialsExpired(credentials, (expiredErr, credentialsExpired) => {
          if (expiredErr) {
            callback(expiredErr);
            return;
          }
          if (credentialsExpired) {
            debug('credentials for user "%s" and provider "%s" are expired', user.id, options.providerName);

            // load the passport-strategy instance from passport
            // eslint-disable-next-line no-underscore-dangle
            const strategy = passport._strategy(options.providerName);
            if (!strategy) {
              throw new Error(`Auth provider with name "${options.providerName}" is not registered`);
            }

            options.refreshCredentials(strategy, credentials, (refreshCredentialsErr, newCredentials) => {
              if (refreshCredentialsErr) {
                callback(refreshCredentialsErr);
                return;
              }
              // store new credentials in the user's identities / credentials
              identity.updateAttribute(
                options.credentialsProp,
                newCredentials,
                (updateIdentityErr, updatedIdentity) => {
                  if (updateIdentityErr) {
                    callback(updateIdentityErr);
                    return;
                  }

                  debug('updated user identity', updatedIdentity);

                  // pass newCredentials to makeAuthParams and merge return value with the modified request parameters
                  // explicitly using "merge" here to allow partial updates of nested object literals
                  options.makeAuthParams(newCredentials, (authParamsErr, authParams) => {
                    if (authParamsErr) {
                      callback(authParamsErr);
                      return;
                    }
                    _.merge(reqParams, authParams);

                    // finish plugin execution; hand over the modified request parameters
                    callback(null, reqParams);
                  });
                }
              );
            });
          }

          // when original credentials were not expired, attach them to the request parameters and finish
          // plugin execution

          // pass credentials to makeAuthParams and merge return value with the modified request parameters
          // explicitly using "merge" here to allow partial updates of nested object literals
          options.makeAuthParams(credentials, (authParamsErr, authParams) => {
            if (authParamsErr) {
              callback(authParamsErr);
              return;
            }
            _.merge(reqParams, authParams);

            // finish plugin execution; hand over the modified request parameters
            callback(null, reqParams);
          });
        });
      });
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
