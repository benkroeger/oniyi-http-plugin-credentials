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
    const err = new TypeError('providerName must be a "String"');
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

  const { userRelationProp: relationProp, credentialsProp, providerName } = options;

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

      async.waterfall(
        [
          // attempt to load previously persisted user identity from `relationProp`
          next =>
            user[relationProp]({ where: { provider: providerName } }, (err, [identity] = []) => {
              if (err) {
                debug('Error while loading identities for user "%s"', user.id, err);
              }

              // debug('Failed to load identities for user "%s"', user.id, {
              //   resultsIsArray: Array.isArray(results),
              //   resultsLength: results.length,
              //   results,
              // });

              next(err, identity);
            }),

          // if exists, proceed with identity.
          // otherwise check if provider supports initializing it. init if supported, abort if not
          (identity, next) => {
            if (identity) {
              const { credentialsProp: credentials } = identity;
              if (!credentials) {
                const err = new Error(`No credentials found for user "${user.id}" and provider "${providerName}"`);
                debug(err.message);
                next(err);
                return;
              }
              next(null, { identity, credentials });
              return;
            }

            if (!options.initCredentials) {
              next(new Error(`Failed to load identities for user "${user.id}"`));
              return;
            }

            debug('Initializing credentials for user "%s" and provider "%s"', user.id, providerName);

            // Create a placeholder identity with empty credentials
            // and then update it with the initialized credentials once
            // they come back. Done this way to avoid race conditions
            // and multiple identity entries for the same provider when
            // multiple simultaneous calls are made to initCredentials.

            user[relationProp].create(
              { provider: providerName, credentials: {} },
              (createIdentityError, createdIdentity) => {
                if (createIdentityError) {
                  next(createIdentityError);
                  return;
                }
                options.initCredentials(user.id, (initCredentialsError, credentials) => {
                  if (initCredentialsError) {
                    next(initCredentialsError);
                    return;
                  }
                  createdIdentity.updateAttribute(credentialsProp, credentials, updateAttributeError =>
                    next(updateAttributeError, { identity: createdIdentity, credentials }));
                });
              }
            );
          },
          ({ identity, credentials }, next) => {
            if (!credentials) {
              const err = new Error(`No credentials found for user "${user.id}" and provider "${providerName}"`);
              debug(err.message);
              next(err);
              return;
            }

            if (!credentials.userId) {
              Object.assign(credentials, { userId: user.id });
            }

            // must handle credentials refresh in pre-flight phase due to possible use of stream API
            // with request. If client wants to send data, we can not ensure that data is still available
            // when retrying.
            options.areCredentialsExpired(credentials, (err, expired) => next(err, { identity, credentials, expired }));
          },
          ({ identity, credentials, expired }, next) => {
            // when original credentials were not expired, attach them to the request parameters and finish
            // plugin execution
            if (!expired) {
              next(null, credentials);
              return;
            }

            debug('credentials for user "%s" and provider "%s" are expired', user.id, providerName);

            // load the passport-strategy instance from passport
            // eslint-disable-next-line no-underscore-dangle
            const strategy = passport._strategy(providerName);
            if (!strategy) {
              next(new Error(`Auth provider with name "${providerName}" is not registered`));
              return;
            }

            options.refreshCredentials(strategy, credentials, (refreshCredentialsErr, newCredentials) => {
              if (refreshCredentialsErr) {
                next(refreshCredentialsErr);
                return;
              }

              // store new credentials in the user's identities / credentials
              identity.updateAttribute(credentialsProp, newCredentials, err => next(err, newCredentials));
            });
          },
          // pass credentials to makeAuthParams and merge return value with the modified request parameters
          (credentials, next) => options.makeAuthParams(credentials, next),
          // explicitly using "merge" here to allow partial updates of nested object literals
          (authParams, next) => next(null, _.merge(reqParams, authParams)),
        ],
        // finish plugin execution; hand over the modified request parameters
        callback
      );
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
//       identity.updateAttribute(credentialsProp, newCredentials,
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
