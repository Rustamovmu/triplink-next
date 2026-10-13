const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const load = (file, mocks) => {
 const exported={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,jsx:2,esModuleInterop:true}}).outputText)(name=>{if(name === '../../triplink/BrowsingMemoryProvider')return require('./helpers/browsing-memory.cjs')(mocks);if(!(name in mocks))throw new Error(`Missing mock ${name}`);return mocks[name];},exported);return exported;
};
const articleFormat = load('libs/components/triplink/articleFormat.ts', { 'sanitize-html': require('sanitize-html') });
const articleContent = load('libs/components/triplink/ArticleContent.tsx', { react: React, './articleFormat': articleFormat });
const editorMocks = { 'next/dynamic': { __esModule: true, default: () => () => null }, './articleFormat': articleFormat, './ArticleContent': articleContent };

test('community cards retain article/author links, safe covers, filter variables and independent likes', async()=>{
 const saved=Object.fromEntries(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(global,k)]));
 const dom=new JSDOM('<div id="root"></div>');global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 let current={_id:'viewer',memberType:'USER'},request,resolve,reject,callCount=0,input;
 let article={_id:'article',articleTitle:'A journey',articleContent:'An honest travel story',articleImage:'uploads/article/photo.jpg',articleCategory:'FREE',articleStatus:'ACTIVE',articleLikes:1,articleComments:0,meLiked:false,createdAt:'2026-10-10T12:00:00Z',memberData:{_id:'guide',memberNick:'Guide',memberType:'AGENT',memberImage:''}};
 const t=(key,values={})=>key.replace(/{{(\w+)}}/g,(_,name)=>values[name]??'');
 const box=({children})=>React.createElement('div',null,children);
 const mui={Avatar:box,Alert:({children})=>React.createElement('div',{role:'alert'},children),Box:box,Button:box,Card:box,CardContent:box,MenuItem:box,Stack:box,TextField:box,Typography:box,Container:box,CircularProgress:box,Pagination:()=>null};
 const shared={react:React,'next-i18next':{useTranslation:()=>({t})},'@mui/material':mui,'../../../apollo/store':{memberVar:'member',sessionVar:'session'},
 '@apollo/client':{useReactiveVar:v=>v==='member'?current:'authenticated',useQuery:(doc,options)=>{if(doc==='articles')input=options.variables.input;return {loading:false,data:{result:{list:[article],metaCounter:[{total:1}]}},refetch:async()=>{}};},useMutation:()=>[options=>{callCount++;request=options.variables;return new Promise((yes,no)=>{resolve=yes;reject=no;});}]}};
 const common=load('libs/components/triplink/Common.tsx',{...shared,'../../triplink/errors':{errorMessage:e=>e.message}});
 const {ArticlesList}=load('libs/components/triplink/Community.tsx',{...shared,...editorMocks,'next/link':{__esModule:true,default:({children,href,...props})=>React.createElement('a',{href,className:props.className,'aria-label':props['aria-label']},children)},'next/router':{useRouter:()=>({locale:'en'})},'../../../apollo/user/triplink':{ARTICLES:'articles'},'../../../apollo/admin/triplink':{},'../../types/triplink':{totalOf:r=>r?.metaCounter[0]?.total??0},'./Common':common,'../../uploads':{}});
 const root=createRoot(document.getElementById('root'));
 const render=()=>act(async()=>root.render(React.createElement(ArticlesList,{community:true})));
 const like=()=>document.querySelector('button[aria-label="Like A journey"],button[aria-label="Unlike A journey"]');
 try{
  await render();assert.ok(document.querySelector('a[href="/community/detail?id=article"]'));assert.ok(document.querySelector('a[href="/agent/detail?agentId=guide"]'));assert.match(document.body.textContent,/An honest travel story/);
  await act(async()=>document.querySelector('img').dispatchEvent(new window.Event('error')));assert.equal(document.querySelector('img'),null);assert.ok(document.querySelector('.triplink-story-card__cover-text'));
  await act(async()=>{like().click();like().click();});assert.equal(callCount,1);assert.deepEqual(request,{articleId:'article'});assert.equal(like().disabled,true);
  await act(async()=>{article={...article,meLiked:true,articleLikes:2};resolve({data:{result:article}});});await render();assert.equal(like().getAttribute('aria-pressed'),'true');assert.equal(document.querySelector('[role="alert"]'),null);
  await act(async()=>like().click());await act(async()=>reject(new Error('Like rejected')));assert.match(document.querySelector('[role="alert"]').textContent,/Like rejected/);assert.equal(like().disabled,false);
  const filter=[...document.querySelectorAll('.triplink-community__filters button')].find(b=>b.textContent==='Travel news');await act(async()=>filter.click());assert.deepEqual(input.search,{articleCategory:'NEWS'});assert.equal(input.page,1);assert.equal(filter.getAttribute('aria-pressed'),'true');
  article={...article,memberData:{_id:'writer',memberNick:'Writer',memberType:'USER'}};await render();assert.ok(document.querySelector('a[href="/member?memberId=writer"]'));
  article={...article,memberData:null};current=null;await render();assert.ok(document.querySelector('a[href="/account/join"]'));assert.match(document.body.textContent,/Unavailable member/);assert.equal(like(),null);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of Object.entries(saved)){if(d)Object.defineProperty(global,k,d);else delete global[k];}}
});
