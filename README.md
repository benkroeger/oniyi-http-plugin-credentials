# oniyi-http-plugin-credentials [![NPM version][npm-image]][npm-url] [![Dependency Status][daviddm-image]][daviddm-url] [![Coverage percentage][coveralls-image]][coveralls-url]
> A plugin for oniyi-http-client for automatic attachment of user credentials

This plugin is designed to work with the [third-party login component](https://docs.strongloop.com/pages/releaseview.action?pageId=3836277) [loopback](https://docs.strongloop.com/display/public/LB/LoopBack) framework.
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

const pluginOptions = {};
const plugin = oniyiHttpPluginCredentials(pluginOptions);

httpClient.use(plugin);
```

## Plugin Options
The `oniyi-http-plugin-credentials` module exports a factory function that takes a single options argument.

available options are: 
- providerName: undefined (string, required) - name of the passport-strategy to be used. *Note:* passport-strategy **must** be registered first
- removeUserProp: true (boolean, optional) - indicates if the `user` property should be removed from the request options
- areCredentialsExpired: (function, optional) - async function that checks if credentials are expired. Must take two arguments (`credentials`, `callback(err, isExpired)`)
- refreshCredentials: (function, optional) - async function that provides refreshed credentials. Must take three arguments (`strategy`, `currentCredentials`, `callback(err, freshCredentials)`)
- makeAuthParams: (function, optional) - async function that provides an object literal to be merged with request parameters. Must take two arguments (`credentials`, `callback(err, authParams)`)
- userRelationProp: /-link$/.test(pluginOptions.providerName) ? 'credentials' : 'identities', (string, optional) - name of the relation on `req.user` that we should search for user credentials
- credentialsProp: 'credentials' (string, optional) - name of the property in the relation's document to be used for credentials


All options of type `function` have default values that can with OAuth2 strategies.

## License

MIT © [Benjamin Kroeger]()


[npm-image]: https://badge.fury.io/js/oniyi-http-plugin-credentials.svg
[npm-url]: https://npmjs.org/package/oniyi-http-plugin-credentials
[travis-image]: https://travis-ci.org/benkroeger/oniyi-http-plugin-credentials.svg?branch=master
[travis-url]: https://travis-ci.org/benkroeger/oniyi-http-plugin-credentials
[daviddm-image]: https://david-dm.org/benkroeger/oniyi-http-plugin-credentials.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/benkroeger/oniyi-http-plugin-credentials
[coveralls-image]: https://coveralls.io/repos/benkroeger/oniyi-http-plugin-credentials/badge.svg
[coveralls-url]: https://coveralls.io/r/benkroeger/oniyi-http-plugin-credentials
