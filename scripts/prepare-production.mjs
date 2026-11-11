import {readFileSync,writeFileSync} from 'node:fs';
const phase=process.argv[2];
if(!['prepare','live'].includes(phase))throw Error('Choose the prepare or live release phase.');
const project='leadership-skill-builder-7aba5';
const launch=JSON.parse(readFileSync('config/launch.production.json','utf8'));
if(!['complimentary','trial30','free'].includes(launch.betaPolicy)||!Number.isFinite(launch.accessPreparedAt)||!/^[a-f0-9]{64}$/.test(launch.uidDigest))throw Error('The reviewed beta-user access migration must be completed before release.');
const web=Object.fromEntries(readFileSync('.env.production','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)]}));
if(web.VITE_APP_ENV!=='production'||web.VITE_FIREBASE_PROJECT_ID!==project||!web.VITE_APP_CHECK_SITE_KEY)throw Error('Production Firebase and App Check configuration is incomplete.');
const billing=JSON.parse(readFileSync('config/stripe.production.json','utf8'));
if(billing.STRIPE_MODE!=='live'||billing.APP_BASE_URL!=='https://leadershipskillbuilder.ai')throw Error('Production requires live Stripe mode and the production return URL.');
for(const [field,prefix]of Object.entries({STRIPE_PRODUCT_ID:'prod_',STRIPE_PRICE_MONTH_PASS:'price_',STRIPE_PRICE_MONTHLY:'price_',STRIPE_PRICE_ANNUAL:'price_',STRIPE_PORTAL_CONFIGURATION:'bpc_',STRIPE_WEBHOOK_ENDPOINT:'we_'})){
 if(typeof billing[field]!=='string'||!billing[field].startsWith(prefix)||billing[field].length<=prefix.length)throw Error('Missing production setting: '+field);
}
const live=phase==='live';
writeFileSync('functions/.env.'+project,Object.entries({...billing,FREEMIUM_ENABLED:String(live),BILLING_ENABLED:String(live),APP_CHECK_ENFORCED:String(live)}).map(([k,v])=>k+'='+v).join('\n')+'\n');
console.log('Prepared production '+phase+' configuration. No secret values are stored in this file.');
