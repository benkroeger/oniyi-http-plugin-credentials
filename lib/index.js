'use strict';

// node core modules

// 3rd party modules
const _ = require('lodash');
const debug = require('debug')('oniyi:http-client:plugin:attach-credentials');

// internal modules
const { makeRequestParamsExtractor, getUserId } = require('./utils');
const { applyCredentials } = require('./apply-credentials');

const PLUGIN_NAME = 'attach-credentials';
const REQUEST_PHASE_NAME = 'credentials';

const defaults = {
  removeUserProp: true,
  userPropName: 'user',
  credentialsMethodName: 'getCredentialsForProvider',
};

/**
 * attachCredentialsPluginFactory
 * @param  {Object}   pluginOptions options to define general plugin behaviour
 * @param  {String}   pluginOptions.providerName Name of the provider that credentials should be resolved for
 * @param  {Boolean}  [pluginOptions.removeUserProp=true] should plugin remove `user` prop from `reqParams`
 * @param  {String}   [pluginOptions.userPropName="user"] name of the `reqParams` property that holds the `user` object
 * @param  {String}   [pluginOptions.credentialsMethodName="getCredentialsForProvider"] name of the method on `user` object that resolves credentials for `providerName`
 * @return {Object}   [description]
 */
module.exports = function attachCredentialsPluginFactory(pluginOptions) {
  // compile plugin options; set default values for properties that have not been provided
  const options = _.defaults({}, pluginOptions, defaults);

  // options verification
  if (!_.isString(options.providerName)) {
    const err = new TypeError('providerName must be a "String"');
    debug(err.message, { options });
    throw err;
  }

  const {
    providerName, removeUserProp, userPropName, credentialsMethodName,
  } = options;

  const extractRequestparams = makeRequestParamsExtractor(removeUserProp, userPropName);

  return {
    name: PLUGIN_NAME,
    onRequest: [{
      phaseName: REQUEST_PHASE_NAME,
      handler: (ctx, next) => {
        const { options } = ctx;
        const {
          // credentialsPluginOptions = {},
          phasesToSkip: {
            requestPhases = [],
          } = {},
        } = options;
        // create a copy of provided request parameters (remove user prop if requested in `options`)
        const reqParams = extractRequestparams(options);
        const { [userPropName]: user } = options;

        if (requestPhases.includes(REQUEST_PHASE_NAME)) {
          debug('Skipping plugin operations -> \n%O', options);
          debug(`Reason: Phase [${REQUEST_PHASE_NAME}] marked for skipping`);

          // This would mean we potentially pass back params without
          // the user prop and without credentials
          next();
          return;
        }

        if (!user) {
          debug('Skipping plugin operations -> \n%O', options);
          debug(`Reason: No "${userPropName}" prop found in request params`);

          // This would mean we potentially pass back params without
          // the user prop and without credentials
          next();
          return;
        }

        if (!_.isFunction(user[credentialsMethodName])) {
          const msg = `${userPropName}.${credentialsMethodName} must be a function`;
          debug(msg, { user });
          next(new TypeError(msg));
          return;
        }

        user[credentialsMethodName](providerName, reqParams, (getCredentialsError, credentials) => {
          if (getCredentialsError) {
            debug(
              'Failed to load credentials for %s %s and provider %s',
              userPropName,
              getUserId(user),
              providerName,
              getCredentialsError
            );
            next(getCredentialsError);
            return;
          }

          if (!credentials) {
            // [bk] @TODO: add switch to plugin options to either abort or ignore this error.
            // currently we abort
            const err = new Error(`No credentials found for user "${getUserId(user)}" and provider "${providerName}"`);
            debug(err.message);
            next(err);
            return;
          }

          applyCredentials(reqParams, credentials, (applyCredentialsError, reqParamsWithCredentials) => {
            if (applyCredentialsError) {
              next(applyCredentialsError);
              return;
            }
            // once we acquired request params with credentials, need to update current ctx.options
            // so that next phase hook handler can use them as well
            _.assign(ctx, { options: reqParamsWithCredentials });
            next();
          });
        });
      }
    },
    ],
  };
};
