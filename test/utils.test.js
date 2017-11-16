// node core modules

// 3rd party modules
import test from 'ava';

// internal modules
import { makeRequestParamsExtractor, getUserId } from '../lib/utils';

test('makeRequestParamsExtractor removes user prop from request params', (t) => {
  const removeUserProp = true;
  const userPropName = 'user';
  const extractRequestparams = makeRequestParamsExtractor(removeUserProp, userPropName);

  const user = { name: 'foo ' };
  const origParams = { [userPropName]: user };

  const reqParams = extractRequestparams(origParams);
  t.false(Object.prototype.hasOwnProperty.call(reqParams, userPropName));
});

test('makeRequestParamsExtractor preserves user prop from request params when defined in options', (t) => {
  const removeUserProp = false;
  const userPropName = 'user';
  const extractRequestparams = makeRequestParamsExtractor(removeUserProp, userPropName);

  const user = { name: 'foo ' };
  const origParams = { [userPropName]: user };

  const reqParams = extractRequestparams(origParams);
  t.true(Object.prototype.hasOwnProperty.call(reqParams, userPropName));
  t.is(reqParams[userPropName], user);
});

test('getUserId resolves userid from "user.getId()"', (t) => {
  const userid = '1234';
  const user = { getId: () => userid };

  const extractedUserid = getUserId(user);
  t.is(extractedUserid, userid);
});

test('getUserId resolves userid from "user.id"', (t) => {
  const userid = '1234';
  const user = { id: userid };

  const extractedUserid = getUserId(user);
  t.is(extractedUserid, userid);
});

test('getUserId resolves undefined if ".getId()" and ".id" are falsy', (t) => {
  const user = { };

  const extractedUserid = getUserId(user);
  t.is(extractedUserid, undefined);
});
