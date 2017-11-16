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

test('returns object with `name` and `load` prop', (t) => {
  const options = { providerName: 'test-provider' };
  const plugin = factory(options);

  t.true(Object.prototype.hasOwnProperty.call(plugin, 'name'));
  t.true(Object.prototype.hasOwnProperty.call(plugin, 'load'));
  t.is(plugin.name, 'attach-credentials');
  t.true(_.isFunction(plugin.load));
  t.is(plugin.load.length, 3);
});
