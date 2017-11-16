'use strict';

// node core modules

// 3rd party modules
const _ = require('lodash');
const debug = require('debug')('oniyi:http-client:plugin:attach-credentials');

// internal modules
const { makeRequestParamsExtractor, getUserId } = require('./utils');
const { applyCredentials } = require('./apply-credentials');

const PLUGIN_NAME = 'attach-credentials';

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
    load: (req, origParams, callback) => {
      // create a copy of provided request parameters (remove user prop if requested in `options`)
      const reqParams = extractRequestparams(origParams);
      const { [userPropName]: user } = origParams;

      if (!user) {
        debug('No "%s" prop found in request params, skipping plugin operations', userPropName, origParams);
        // [bk] @TODO: should we use `reqParams` here instead?
        // That would mean we potentially pass back params without
        // the user prop and without credentials
        callback(null, origParams);
        return;
      }

      if (!_.isFunction(user[credentialsMethodName])) {
        const msg = `${userPropName}.${credentialsMethodName} must be a function`;
        debug(msg, { user });
        callback(new TypeError(msg));
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
          callback(getCredentialsError);
          return;
        }

        if (!credentials) {
          // [bk] @TODO: add switch to plugin options to either abort or ignore this error.
          // currently we abort
          const err = new Error(`No credentials found for user "${getUserId(user)}" and provider "${providerName}"`);
          debug(err.message);
          callback(err);
          return;
        }

        applyCredentials(reqParams, credentials, (applyCredentialsError, reqParamsWithCredentials) => {
          if (applyCredentialsError) {
            callback(applyCredentialsError);
            return;
          }
          callback(null, reqParamsWithCredentials);
        });
      });
    },
  };
};
