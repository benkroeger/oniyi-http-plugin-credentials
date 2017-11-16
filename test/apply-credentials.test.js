// node core modules

// 3rd party modules
import test from 'ava';
import sinon from 'sinon';

// internal modules
import { applyCredentials, applyCredentialsByType } from '../lib/apply-credentials';

test('applyCredentials expects two arguments', t => t.is(applyCredentials.length, 3));

test.cb('applyCredentials fails when "data.type" is not supported', (t) => {
  const reqParams = {};
  const credentialsType = 'foo';
  const data = { type: credentialsType, payload: {} };

  applyCredentials(reqParams, data, (err) => {
    t.is(err.message, `credentials type ${credentialsType} is not supported`);
    t.end();
  });
});

test.cb('applyCredentials uses "data.type" as default authType if not defined otherwise in payload', (t) => {
  const reqParams = {};
  // have to use credentialsType `header` here because all others have their own default value for `authType`
  const credentialsType = 'header';
  const payload = {};
  const data = { type: credentialsType, payload };

  applyCredentials(reqParams, data, (err, reqParamsWithCredentials) => {
    t.ifError(err);
    t.is(reqParamsWithCredentials.authType, credentialsType);

    t.end();
  });
});

test.cb('applyCredentials invokes type-specific implementation with reqParams and payload', (t) => {
  const reqParams = {};
  const credentialsType = 'bearer';
  const payload = {};
  const data = { type: credentialsType, payload };

  const spy = sinon.spy(applyCredentialsByType, credentialsType);
  applyCredentials(reqParams, data, (err) => {
    t.ifError(err);
    t.true(spy.calledOnce);

    const spyCall = spy.firstCall;
    t.true(spyCall.calledWith(reqParams, payload));

    t.end();
  });
});

test.cb('type header default header name is "authorization"', (t) => {
  const reqParams = {};
  const credentialsType = 'header';
  const payload = { authType: 'foo', value: '1234' };
  const data = { type: credentialsType, payload };

  applyCredentials(reqParams, data, (err, reqParamsWithCredentials) => {
    t.ifError(err);
    t.is(reqParamsWithCredentials.headers.authorization, payload.value);

    t.end();
  });
});

test.cb('type header uses header name from payload', (t) => {
  const reqParams = {};
  const credentialsType = 'header';
  const payload = { authType: 'foo', name: 'my-authorization', value: '1234' };
  const data = { type: credentialsType, payload };

  applyCredentials(reqParams, data, (err, reqParamsWithCredentials) => {
    t.ifError(err);
    t.is(reqParamsWithCredentials.headers[payload.name], payload.value);

    t.end();
  });
});
