'use strict';

// node core modules

// 3rd party modules
const _ = require('lodash');

// internal modules

const makeRequestParamsExtractor = (removeUserProp, userPropName) => {
  if (removeUserProp && userPropName) {
    return params => _.omit(params, [userPropName]);
  }
  return params => _.assign({}, params);
};

// this means that origParams[userPropName] must have `.getId()` method or `.id` prop
const getUserId = user => (user && ((user.getId && user.getId()) || user.id)) || undefined;

module.exports = { makeRequestParamsExtractor, getUserId };
