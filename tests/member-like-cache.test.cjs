const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { ApolloClient, ApolloLink, InMemoryCache, Observable, gql } = require('@apollo/client');
const { print } = require('graphql');
const docs = {};
new Function('require', 'exports', ts.transpileModule(fs.readFileSync('apollo/user/triplink.ts', 'utf8'), { compilerOptions: { module: 1 } }).outputText)(require, docs);

test('member like responses update likes without overwriting cached follow state or counters', async () => {
 const cache = new InMemoryCache({ typePolicies: { Member: { keyFields: ['_id'] } } });
 const profile = gql`query Profile($memberId: String!) { result: getMember(memberId: $memberId) { _id isFollowing memberFollowers memberLikes } }`;
 const memberId = 'a'.repeat(24);
 let likeCount = 4;
 const client = new ApolloClient({ cache, link: new ApolloLink(operation => new Observable(observer => {
  assert.equal(operation.operationName, 'MEMBER_LIKE');
  assert.deepEqual(operation.variables, { memberId });
  const fields = operation.query.definitions[0].selectionSet.selections[0].selectionSet.selections.map(field => field.name.value);
  // The backend has no viewer context in this response: requesting isFollowing yields null.
  const member = { __typename: 'Member', _id: memberId, memberLikes: likeCount };
  if (fields.includes('isFollowing')) member.isFollowing = null;
  observer.next({ data: { result: member } }); observer.complete();
 })) });
 try {
  for (const isFollowing of [true, false]) {
   cache.writeQuery({ query: profile, variables: { memberId }, data: { result: { __typename: 'Member', _id: memberId, isFollowing, memberFollowers: 7, memberLikes: 3 } } });
   for (likeCount of [4, 3]) {
    await client.mutate({ mutation: docs.MEMBER_LIKE, variables: { memberId } });
    const member = cache.readQuery({ query: profile, variables: { memberId } }).result;
    assert.equal(member.memberLikes, likeCount);
    assert.equal(member.isFollowing, isFollowing);
    assert.equal(member.memberFollowers, 7);
   }
  }
  assert.ok(!print(docs.MEMBER_LIKE).includes('isFollowing'));
 } finally { client.stop(); }
});
