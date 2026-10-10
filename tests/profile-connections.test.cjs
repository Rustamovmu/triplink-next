const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const load = (file, mocks) => {
 const exported = {};
 new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,jsx:2,esModuleInterop:true}}).outputText)((name) => {
  if (!(name in mocks)) throw new Error(`Missing mock: ${name}`);
  return mocks[name];
 },exported);
 return exported;
};
test('public connections navigate by role and toggle the visitor relationship with synchronized lists', async () => {
 const saved = Object.fromEntries(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(global,k)]));
 const dom = new JSDOM('<div id="root"></div>'); global.window=dom.window; global.document=dom.window.document; global.IS_REACT_ACT_ENVIRONMENT=true;
 let current={_id:'visitor',memberType:'USER'}, ready=true, requests=[], refreshes=0, includes=[], resolve, reject, followed=false, lastInput;
 const people=[{_id:'guide',memberType:'AGENT',memberNick:'Guide',memberFollowers:9,memberTours:4},{_id:'writer',memberType:'USER',memberNick:'Writer',memberFollowers:2},{_id:'visitor',memberType:'USER',memberNick:'Me',memberFollowers:0}];
 const t=(key,values={})=>key.replace(/{{(\w+)}}/g,(_,name)=>values[name]??'');
 const box=({children,className})=>React.createElement('div',{className},children);
 const mui={Stack:box,Card:box,CardContent:box,Typography:box,Avatar:box,Container:box,TextField:box,
  Button:({children,onClick,disabled,...props})=>React.createElement('button',{onClick,disabled,'aria-label':props['aria-label'],'aria-pressed':props['aria-pressed']},children),
  Alert:({children})=>React.createElement('div',{role:'alert'},children),CircularProgress:()=>React.createElement('span',null,'Loading'),Pagination:()=>null};
 const shared={react:React,'next-i18next':{useTranslation:()=>({t})},'@mui/material':mui,
  '@apollo/client':{useReactiveVar:v=>v==='member'?current:ready?'authenticated':'loading',useApolloClient:()=>({refetchQueries:async options=>{includes=options.include;}}),
  useQuery:(doc,options)=>{lastInput={doc,...options.variables.input};return {loading:false,data:{result:{list:people.map(person=>({_id:person._id,memberData:person,isFollowing:person._id==='guide'?followed:false})).concat([{_id:'missing',memberData:null}]),metaCounter:[{total:4}]}},refetch:async()=>{}};},
  useMutation:()=>[options=>{requests.push(options.variables);return new Promise((yes,no)=>{resolve=yes;reject=no;});}]},
  '../../../apollo/store':{memberVar:'member',sessionVar:'session'}};
 const common=load('libs/components/triplink/Common.tsx',{...shared,'../../triplink/errors':{errorMessage:e=>e.message}});
 const mocks={...shared,'next/link':{__esModule:true,default:({href,children,className})=>React.createElement('a',{href,className},children)},
 '../../../apollo/user/triplink':{FOLLOWERS:'followers',FOLLOWINGS:'followings',MEMBER:'memberQuery',FOLLOW_TOGGLE:'toggle'},
 '../../auth':{refreshCurrentMember:async()=>{refreshes++;}},'../../types/triplink':{totalOf:r=>r?.metaCounter[0]?.total??0},'./Common':common,'./Tours':{},'../../uploads':{}};
 const {Follows}=load('libs/components/triplink/Members.tsx',mocks);
 const root=createRoot(document.getElementById('root'));
 const render=(following=false)=>act(async()=>root.render(React.createElement(Follows,{memberId:'profile-owner',following})));
 const button=()=>document.querySelector('button[aria-label="Follow Guide"],button[aria-label="Unfollow Guide"]');
 try {
  await render(); assert.equal(lastInput.doc,'followers'); assert.deepEqual(lastInput.search,{memberId:'profile-owner'});
  assert.ok(document.querySelector('a[href="/agent/detail?agentId=guide"]'));assert.ok(document.querySelector('a[href="/member?memberId=writer"]'));
  assert.equal(document.querySelector('button[aria-label="Follow Me"]'),null); assert.match(document.body.textContent,/Unavailable member/);
  await act(async()=>{button().click();button().click();});assert.equal(requests.length,1);assert.deepEqual(requests[0],{memberId:'guide'});assert.equal(button().disabled,true);
  await act(async()=>{followed=true;resolve({data:{result:{followed:true,member:people[0]}}});});await render();
  assert.equal(button().textContent,'Unfollow');assert.equal(refreshes,1);assert.deepEqual(includes,['followers','followings','memberQuery']);
  await act(async()=>button().click());await act(async()=>reject(new Error('Denied')));assert.equal(button().textContent,'Unfollow');assert.equal(button().disabled,false);assert.match(document.body.textContent,/Denied/);
  await act(async()=>button().click());await act(async()=>{followed=false;resolve({data:{result:{followed:false,member:people[0]}}});});await render();assert.equal(button().textContent,'Follow');
  await render(true); assert.equal(lastInput.doc,'followings');assert.equal(lastInput.page,1);
  current={_id:'admin',memberType:'ADMIN'};await render();assert.equal(button(),null);
  current={_id:'guide',memberType:'AGENT'};await render();assert.equal(button(),null);assert.ok(document.querySelector('button[aria-label="Follow Writer"]'));
  current=null;await render();assert.equal(button(),null);assert.ok(document.querySelector('a[href="/account/join"]'));
  ready=false;await render();assert.equal(document.querySelector('a[href="/member?memberId=writer"]'),null);
 } finally {await act(async()=>root.unmount());dom.window.close();for(const[k,d]of Object.entries(saved)){if(d)Object.defineProperty(global,k,d);else delete global[k];}}
});

test('profile article list filters public reads by the visited author, without owner controls', () => {
 let input;
 const box=()=>null;
 const mocks={react:{...React,useState:initial=>[initial,()=>{}]},'next-i18next':{useTranslation:()=>({t:k=>k})},'next/link':{__esModule:true,default:box},'next/router':{},
 '@apollo/client':{useReactiveVar:()=>({_id:'visitor',memberType:'AGENT'}),useMutation:()=>[()=>{}],useQuery:(doc,options)=>{if(doc==='articles')input=options.variables.input;return {data:{result:{list:[{_id:'article',memberId:'visitor',articleStatus:'ACTIVE',articleTitle:'Story',articleCategory:'FREE',articleLikes:0,articleComments:0}]}}};}},
 '@mui/material':Object.fromEntries(['Alert','Box','Button','Card','CardContent','MenuItem','Stack','TextField','Typography'].map(k=>[k,box])),
 '../../../apollo/user/triplink':{ARTICLES:'articles'},'../../../apollo/admin/triplink':{},'../../../apollo/store':{},'../../types/triplink':{totalOf:()=>0},'./Common':{usePublicReady:()=>true,useAction:()=>({}), QueryState:box, Pager:box},'../../uploads':{}};
 const {ArticlesList}=load('libs/components/triplink/Community.tsx',mocks);
 const publicTree=ArticlesList({memberId:'visited-writer'});assert.deepEqual(input.search,{memberId:'visited-writer'});assert.equal(input.page,1);assert.ok(!JSON.stringify(publicTree).includes('Edit'));
 const ownerTree=ArticlesList({mine:true});assert.deepEqual(input.search,{memberId:'visitor'});assert.ok(JSON.stringify(ownerTree).includes('Edit'));
});
