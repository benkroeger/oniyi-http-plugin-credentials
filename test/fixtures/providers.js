// node core modules

// 3rd party modules

// internal modules

module.exports = {
  falsy: () => false,
  'no-payload': () => ({
    payload: undefined,
  }),
  oauth: () => ({
    type: 'bearer',
    payload: {
      token: '1234',
      sendImmediately: true,
      authType: 'oauth',
    },
  }),
  cookie: () => ({}),
  header: reqParams => ({
    type: 'header',
    payload: { value: reqParams.authHeaderValue },
  }),
};
