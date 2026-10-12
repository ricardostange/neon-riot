const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const scope = 'https://example.com/neon-riot/';
const listeners = {}, calls = [], offline = { body: 'offline snapshot' };
let network = { ok: true, body: 'fresh release' }, failInstall = false, cached = offline;
const cache = {
 async addAll(requests) {
  assert.ok(requests.some(r => r.url === scope + 'game.js'));
  assert.ok(requests.every(r => r.cache === 'no-store'));
  calls.push('precache'); if(failInstall) throw Error('offline');
 },
 async match(request) { calls.push('cache'); return cached; }
};
const sandbox = {
 URL, Request,
 self: { registration: {scope}, location: {origin: 'https://example.com'},
  addEventListener(name, fn) {listeners[name]=fn;},
  async skipWaiting() {calls.push('skipWaiting');},
  clients: {async claim() {calls.push('claim');}}
 },
 caches: {
  async open(){return cache;},
  async keys(){return ['neon-riot-'+scope+'v1.0.2','neon-riot-'+scope+'v1.0.3','another-app'];},
  async delete(key){calls.push('delete:'+key);}
 },
 async fetch(request, options) {calls.push('network');assert.equal(options.cache,'no-store');if(network instanceof Error)throw network;return network;}
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),sandbox);
function lifecycle(name){let promise;listeners[name]({waitUntil(p){promise=p;}});return promise;}
function request(url=scope+'game.js',method='GET',mode='cors'){
 let response;listeners.fetch({request:{url,method,mode},respondWith(p){response=p;}});return response;
}
(async()=>{
 await lifecycle('install');assert.deepEqual(calls,['precache','skipWaiting']);
 calls.length=0;failInstall=true;await assert.rejects(lifecycle('install'));assert.deepEqual(calls,['precache']);
 calls.length=0;await lifecycle('activate');assert.deepEqual(calls,['delete:neon-riot-'+scope+'v1.0.2','claim']);
 calls.length=0;assert.equal(await request(),network);assert.deepEqual(calls,['network']);
 network=Error('offline');assert.equal(await request(),offline);
 network={ok:false,status:503};assert.equal(await request(),offline);
 cached=undefined;assert.equal(await request(),network);
 network=Error('offline');await assert.rejects(request());
 cache.match=async r=>r==='./index.html'?offline:undefined;
 assert.equal(await request(scope+'?source=home','GET','navigate'),offline);
 assert.equal(request('https://fonts.googleapis.com/font'),undefined);
 assert.equal(request('https://example.com/other-app/game.js'),undefined);
 assert.equal(request(scope+'game.js','POST'),undefined);
 let onLoad, registrations=0, updates=0;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pwa.js'),'utf8'),{
  navigator:{serviceWorker:{async register(url,options){assert.equal(url,'./sw.js');assert.equal(options.updateViaCache,'none');registrations++;return {async update(){updates++;}};}}},
  window:{isSecureContext:true,addEventListener(name,fn){assert.equal(name,'load');onLoad=fn;}},console
 });
 onLoad();await new Promise(resolve=>setImmediate(resolve));assert.equal(registrations,1);assert.equal(updates,1);
 console.log('PASS: fresh network responses, offline/error fallback, complete snapshot installation, immediate activation, scoped cleanup and update checks.');
})().catch(error=>{console.error(error);process.exitCode=1;});
