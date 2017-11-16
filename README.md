# oniyi-http-plugin-credentials [![NPM version][npm-image]][npm-url] [![Dependency Status][daviddm-image]][daviddm-url]
> An async plugin for oniyi-http-client to resolve and attach credentials to request params

This plugin is designed to work with the [third-party login component](https://docs.strongloop.com/pages/releaseview.action?pageId=3836277) of [loopback](https://docs.strongloop.com/display/public/LB/LoopBack).
The [third-party login component](https://docs.strongloop.com/pages/releaseview.action?pageId=3836277) is heavily based on [passportjs](http://passportjs.org/).
To make things work more broadly, I also wrote a [loopback](https://docs.strongloop.com/display/public/LB/LoopBack) extension to allow the usage of custom auth schemes [oniyi-loopback-passport-custom-schemes](https://github.com/benkroeger/oniyi-loopback-passport-custom-schemes).

## Installation

```sh
$ npm install --save oniyi-http-plugin-credentials
```

## Usage

```js
const OniyiHttpClient = require('oniyi-http-client');
const oniyiHttpPluginCredentials = require('oniyi-http-plugin-credentials');

const clientOptions = {};
const httpClient = new OniyiHttpClient(clientOptions);

const pluginOptions = {
  providerName: 'my-auth-provider', // Name of the provider that credentials should be resolved for
  removeUserProp: true, // should plugin remove `user` prop from `reqParams`
  userPropName: 'user', // name of the `reqParams` property that holds the `user` object
  credentialsMethodName: 'getCredentialsForProvider', // name of the method on `user` object that resolves credentials for `providerName`
};
const plugin = oniyiHttpPluginCredentials(pluginOptions);

httpClient.use(plugin);
```

## Plugin Options
The `oniyi-http-plugin-credentials` module exports a factory function that takes a single options argument.

available options are:
- **providerName**: `undefined` (string, required) - is passed to `getCredentialsForProvider` to indicate which backend we need credentials for
- **removeUserProp**: `true` (boolean, optional) - indicates if the `user` property should be removed from the request options
- **userPropName**: `user` (string, optional) - name of the `reqParams` property that holds the `user` object
- **credentialsMethodName**: `getCredentialsForProvider` (string, optional) - name of the method on `user` object that resolves credentials for `providerName`

## How does it work?

`plugin.load()` retrieves an object with parameters (origParams) that will later be used to make an http(s) request. From there, the following flow is applied:

copy `origParams` into `reqParams`. Depending on `options.removeUserProp`, the original prop named `options.userPropName` will be omitted or included.
read prop named `options.userPropName` from `origParams` into `user`.
If `user` can not be found, abort flow and invoke callback with `origParams`.
If `user[options.credentialsMethodName]` is not a function, invoke callback with `Error`.

Invoke `user[options.credentialsMethodName]` with `options.providerName` and `reqParams` as well as a callback function.
Now `user[options.credentialsMethodName]` is supposed to resolve credentials for `user` and the authentication provider. This resolution should happen async and results be passed to our local callback (which takes `err` and `credentials` arguments).
If an error occurs, plugin flow is aborted and `err` passed to callback.
If `credentials` is falsy, plugin flow is also aborted and callback invoked with an according error.

At this point, we let `user[options.credentialsMethodName]` resolve credentials for the auth provider that this plugin instance is configured for – and no errors occurred.

Now the plugin applies `credentials` to `reqParams`. For that, `credentials.type` is mapped against a list of supported credential types. If `credentials.type` is supported, that type specific implementation is invoked with `reqParams` and `credentials.payload`.
Each credentials type expects a different layout of `credentials.payload`.


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
