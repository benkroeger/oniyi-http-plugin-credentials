// node core modules

// 3rd party modules
import test from 'ava';

// internal modules
import factory from '../lib';
import user from './fixtures/user';

test.cb('removes user prop from request params', (t) => {
  const options = { providerName: 'oauth' };
  const plugin = factory(options);
  const origParams = { user };


  plugin.load({}, origParams, (err, reqParams) => {
    t.ifError(err);
    t.log(err);
    t.false(Object.prototype.hasOwnProperty.call(reqParams, 'user'));
    t.end();
  });
});
