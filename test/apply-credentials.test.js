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

test.cb('applyCredentials fails when "data.payload" is undefined', (t) => {
  const reqParams = {};
  const credentialsType = 'foo';
  const data = { type: credentialsType };

  applyCredentials(reqParams, data, (err) => {
    t.is(err.message, 'payload must not be undefined');
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

test('type basic defines username / password in request params', (t) => {
  const reqParams = {};
  const credentialsType = 'basic';
  const username = 'foo';
  const password = 'bar';
  const sendImmediately = false;
  const authType = 'foo-type';
  const payload = {
    authType, username, password, sendImmediately,
  };

  const { [credentialsType]: credentialsMethod } = applyCredentialsByType;

  const reqParamsWithCredentials = credentialsMethod(reqParams, payload);
  t.deepEqual(reqParamsWithCredentials.auth, {
    username,
    password,
    sendImmediately,
  });
  t.is(reqParamsWithCredentials.authType, authType);
});

test('type basic sets default authType "basic" and sendImmediately "true"', (t) => {
  const reqParams = {};
  const credentialsType = 'basic';
  const username = 'foo';
  const password = 'bar';
  const payload = { username, password };

  const { [credentialsType]: credentialsMethod } = applyCredentialsByType;

  const reqParamsWithCredentials = credentialsMethod(reqParams, payload);
  t.deepEqual(reqParamsWithCredentials.auth, {
    username,
    password,
    sendImmediately: true,
  });
  t.is(reqParamsWithCredentials.authType, 'basic');
});

test('type bearer defines auth.bearer in request params', (t) => {
  const reqParams = {};
  const credentialsType = 'bearer';
  const token = 'bar';
  const sendImmediately = false;
  const authType = 'foo-type';
  const payload = {
    authType, token, sendImmediately,
  };

  const { [credentialsType]: credentialsMethod } = applyCredentialsByType;

  const reqParamsWithCredentials = credentialsMethod(reqParams, payload);
  t.deepEqual(reqParamsWithCredentials.auth, {
    bearer: token,
    sendImmediately,
  });
  t.is(reqParamsWithCredentials.authType, authType);
});

test('type bearer sets default authType "oauth" and sendImmediately "true"', (t) => {
  const reqParams = {};
  const credentialsType = 'bearer';
  const token = 'bar';
  const payload = { token };

  const { [credentialsType]: credentialsMethod } = applyCredentialsByType;

  const reqParamsWithCredentials = credentialsMethod(reqParams, payload);
  t.deepEqual(reqParamsWithCredentials.auth, {
    bearer: token,
    sendImmediately: true,
  });
  t.is(reqParamsWithCredentials.authType, 'oauth');
});

test('type cookie defines "cookie" header in request params', (t) => {
  const reqParams = {};
  const credentialsType = 'cookie';
  const cookie = 'foo=bar';
  const authType = 'foo-type';
  const payload = { authType, cookie };

  const { [credentialsType]: credentialsMethod } = applyCredentialsByType;

  const reqParamsWithCredentials = credentialsMethod(reqParams, payload);
  t.is(reqParamsWithCredentials.headers.cookie, cookie);
  t.is(reqParamsWithCredentials.authType, authType);
});

test('type cookie appends payload to existing "cookie" header in request params', (t) => {
  const reqParams = { headers: { cookie: 'bar=baz' } };
  const credentialsType = 'cookie';
  const cookie = 'foo=bar';
  const payload = { cookie };

  const { [credentialsType]: credentialsMethod } = applyCredentialsByType;

  const reqParamsWithCredentials = credentialsMethod(reqParams, payload);
  t.is(reqParamsWithCredentials.headers.cookie, `${reqParams.headers.cookie};${cookie}`);
});

test('type cookie sets default authType "cookie"', (t) => {
  const reqParams = {};
  const credentialsType = 'cookie';
  const cookie = 'foo=bar';
  const payload = { cookie };

  const { [credentialsType]: credentialsMethod } = applyCredentialsByType;

  const reqParamsWithCredentials = credentialsMethod(reqParams, payload);
  t.is(reqParamsWithCredentials.authType, 'cookie');
});
