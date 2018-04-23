// node core modules

// 3rd party modules
import test from 'ava';
import _ from 'lodash';

// internal modules
import factory from '../lib';

test('main export is a function (plugin factory)', (t) => {
  t.true(_.isFunction(factory));
});

test('expects one argument', (t) => {
  t.is(factory.length, 1);
});

test('throws when options.providerName is not a string', (t) => {
  const options = {};
  t.throws(() => factory(options), 'providerName must be a "String"');
});

test('returns object with `name` and `onRequest` prop', (t) => {
  const options = { providerName: 'test-provider' };
  const plugin = factory(options);

  t.true(Object.prototype.hasOwnProperty.call(plugin, 'name'));
  t.true(Object.prototype.hasOwnProperty.call(plugin, 'onRequest'));
  t.is(plugin.name, 'attach-credentials');
  t.true(_.isArray(plugin.onRequest));

  const requestPhaseHookHandler = plugin.onRequest[0];

  t.true(Object.prototype.hasOwnProperty.call(requestPhaseHookHandler, 'phaseName'));
  t.true(Object.prototype.hasOwnProperty.call(requestPhaseHookHandler, 'handler'));
  t.is(requestPhaseHookHandler.phaseName, 'credentials');
  t.true(_.isFunction(requestPhaseHookHandler.handler));
  t.is(requestPhaseHookHandler.handler.length, 2);
});

test('onRequest returns `phaseName` and `handler` prop', (t) => {
  const options = { providerName: 'test-provider' };
  const plugin = factory(options);

  const requestPhaseHookHandler = plugin.onRequest[0];

  t.true(Object.prototype.hasOwnProperty.call(requestPhaseHookHandler, 'phaseName'));
  t.true(Object.prototype.hasOwnProperty.call(requestPhaseHookHandler, 'handler'));
  t.is(requestPhaseHookHandler.phaseName, 'credentials');
  t.true(_.isFunction(requestPhaseHookHandler.handler));
  t.is(requestPhaseHookHandler.handler.length, 2);
});
