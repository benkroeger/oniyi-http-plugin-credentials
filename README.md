# oniyi-http-plugin-credentials [![NPM version][npm-image]][npm-url] [![Dependency Status][daviddm-image]][daviddm-url]
> An async plugin for oniyi-http-client to resolve and attach credentials to request params

resolve endpoint specific credentials asynchronusly and inject them into request options before making the actual request to endpoint

## Installation

```sh
$ npm install --save oniyi-http-plugin-credentials
```

## Usage

```js
const OniyiHttpClient = require('oniyi-http-client');
const oniyiHttpPluginCredentials = require('oniyi-http-plugin-credentials');

const httpClientParams = {
  requestPhases: ['initial','credentials', 'final'],
};

const pluginOptions = {
  providerName: 'my-auth-provider', // Name of the provider that credentials should be resolved for
  removeUserProp: true, // should plugin remove `user` prop from `reqParams`
  userPropName: 'user', // name of the `reqParams` property that holds the `user` object
  credentialsMethodName: 'getCredentialsForProvider', // name of the method on `user` object that resolves credentials for `providerName`
};
const plugin = oniyiHttpPluginCredentials(pluginOptions);
const phaseMapOptions = {
  requestPhaseMap: {
    credentials: 'newCredentialsPhase',
  },
  responsePhaseMap: {
    final: 'end',
  },
};

const httpClient = OniyiHttpClient
  .create(httpClientParams)       // create custom http client with defined phase lists
  .use(plugin, phaseMapOptions);  // mount a plugin
```

## Plugin Options
The `oniyi-http-plugin-credentials` module exports a factory function that takes a single options argument.

available options are:
- **providerName**: `undefined` (string, required) - is passed to `getCredentialsForProvider` to indicate which backend we need credentials for
- **removeUserProp**: `true` (boolean, optional) - indicates if the `user` property should be removed from the request options
- **userPropName**: `user` (string, optional) - name of the `reqParams` property that holds the `user` object
- **credentialsMethodName**: `getCredentialsForProvider` (string, optional) - name of the method on `user` object that resolves credentials for `providerName`

## How does it work?

This plugin relies on logic implemented in [oniyi-http-client](https://npmjs.org/package/oniyi-http-client), which has extensive documentation on how phase lists work and what conventions must be followed when implementing a plugin.
 
Basically, we have implemented a phase list hook handler which gets invoked in `request phase list` of http client.
Once `credentials` hook handler gets invoked, it receives a `ctx` and `next` params. Once we pull `options` from the context object, the following flow is applied:

copy `options` into `reqParams`. Depending on `pluginOptions.removeUserProp`, the original prop named `pluginOptions.userPropName` will be omitted or included.
read prop named `pluginOptions.userPropName` from `options` into `user`.
If `user` can not be found, abort flow and invoke `next` function so that next plugin in this phase list can do its operations. 
If `user[pluginOptions.credentialsMethodName]` is not a function, invoke `next` with `Error`.

Invoke `user[pluginOptions.credentialsMethodName]` with `pluginOptions.providerName` and `reqParams` as well as a callback function.
Now `user[pluginOptions.credentialsMethodName]` is supposed to resolve credentials for `user` and the authentication provider. This resolution should happen async and results be passed to our local callback (which takes `err` and `credentials` arguments).
If an error occurs, plugin flow is aborted and `err` passed to callback.
If `credentials` is falsy, plugin flow is also aborted and `next` gets invoked.

At this point, we let `user[pluginOptions.credentialsMethodName]` resolve credentials for the auth provider that this plugin instance is configured for – and no errors occurred.

Now the plugin applies `credentials` to `reqParams`. For that, `credentials.type` is mapped against a list of supported credential types. If `credentials.type` is supported, that type specific implementation is invoked with `reqParams` and `credentials.payload`.
Each credentials type expects a different layout of `credentials.payload`.

Finally, we update the `ctx.options` object with latest `reqParamsWithCredentials` changes, and invoke `next` function.

## Credentials types

### basic
Reads `username`, `password` and optionally `sendImmediately` (default: `true`) and `authType` (default: `basic`) from `payload` and injects them into `reqParams`.

Use this type when you have username and password at hand (plain)

### bearer
Reads `token` and optionally `sendImmediately` (default: `true`) and `authType` (default: `oauth`) from `payload` and injects them into `reqParams`.

Use this type when you have e.g. an OAuth2 / OIDC access token at hand

### cookie
Reads `cookie` and optionally `authType` (default: `cookie`) from `payload` and injects them into `reqParams`. The value of `cookie` is set into `reqParams.headers.cookie`. If `reqParams.headers.cookie` was not empty to begin with, value of `cookie` is appended.

Use this type when you have an authentication cookie (e.g. LtpaToken2 for IBM Websphere ApplicationServer) at hand.

### header
Reads `value` and optionally `name` (default: `authorization`) and `authType` (default: `undefined`) from `payload` and injects them into `reqParams`. The `value` is set into `reqParams.headers[name]`.

Use this type for any other form of credentials that are provided in a http header. E.g. if you only have basic credentials already base64 encoded or you're working with a custom TAI for IBM Websphere ApplicationServer where you simply pass an encrypted username to the remote host.

## License

MIT © [Benjamin Kroeger]()


[npm-image]: https://badge.fury.io/js/oniyi-http-plugin-credentials.svg
[npm-url]: https://npmjs.org/package/oniyi-http-plugin-credentials
[travis-image]: https://travis-ci.org/benkroeger/oniyi-http-plugin-credentials.svg?branch=master
[travis-url]: https://travis-ci.org/benkroeger/oniyi-http-plugin-credentials
[daviddm-image]: https://david-dm.org/benkroeger/oniyi-http-plugin-credentials.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/benkroeger/oniyi-http-plugin-credentials
