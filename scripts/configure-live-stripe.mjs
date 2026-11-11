import {execFileSync,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
if(!process.argv.includes('--tax=final'))throw Error('Confirm final advertised checkout amounts before running with --tax=final.');
const decisions=JSON.parse(readFileSync('config/launch-decisions.production.json','utf8'));
if(decisions.checkoutPricePolicy!=='final-advertised-amounts')throw Error('The final-price launch decision has not been recorded.');
if(decisions.taxCollection!=='none')throw Error('Confirm the approved no-tax launch configuration before running this setup.');
const project='leadership-skill-builder-7aba5';
const require=createRequire(process.cwd()+'/functions/package.json');
const Stripe=require('stripe');
let key;
try{key=execFileSync('gcloud',['secrets','versions','access','latest','--secret=STRIPE_SECRET_KEY','--project='+project],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
catch{throw Error('Add the live Stripe server key to production Secret Manager as STRIPE_SECRET_KEY first.');}
if(!/^(sk|rk)_live_/.test(key))throw Error('Production setup requires a live Stripe key.');
const stripe=new Stripe(key,{maxNetworkRetries:2});
const account=await stripe.accounts.retrieve();
if(account.id!=='acct_19zmtNJyYxDrdnux'||!account.charges_enabled)throw Error('The expected Gardenersnotmechanics Stripe account is not ready to accept charges.');
const config=JSON.parse(readFileSync('config/stripe.production.json','utf8'));
if(config.STRIPE_MODE!=='live'||config.APP_BASE_URL!=='https://leadershipskillbuilder.ai')throw Error('Invalid production Stripe configuration.');
const productList=await stripe.products.list({active:true,limit:100});
const matches=productList.data.filter(p=>p.livemode&&p.name==='Leadership Skill Builder');
if(matches.length>1)throw Error('Review duplicate live Skill Builder products before continuing.');
const product=matches[0]||await stripe.products.create({name:'Leadership Skill Builder',description:'Leadership assessment and micro-skill practice.',url:config.APP_BASE_URL,metadata:{app:'leadership-skill-builder'}},{idempotencyKey:'skill-builder-live-product-v1'});
config.STRIPE_PRODUCT_ID=product.id;
for(const [plan,amount,interval]of [['month_pass',1499,null],['monthly',999,'month'],['annual',9900,'year']]){
 const lookup='skill_builder_'+plan+'_live_v1';
 const existing=await stripe.prices.list({lookup_keys:[lookup],limit:2});
 if(existing.data.length>1)throw Error('Duplicate live plan lookup key.');
 const price=existing.data[0]||await stripe.prices.create({product:product.id,currency:'usd',unit_amount:amount,tax_behavior:'inclusive',lookup_key:lookup,metadata:{app:'leadership-skill-builder',plan},...(interval?{recurring:{interval}}:{})},{idempotencyKey:'skill-builder-live-price-'+plan+'-v1'});
 if(!price.livemode||!price.active||price.product!==product.id||price.currency!=='usd'||price.unit_amount!==amount||(price.recurring?.interval||null)!==interval||price.tax_behavior!=='inclusive')throw Error('Existing live price does not match the agreed offer.');
 config['STRIPE_PRICE_'+plan.toUpperCase()]=price.id;
}
const portals=await stripe.billingPortal.configurations.list({active:true,limit:100});
const existingPortal=portals.data.find(p=>p.livemode&&p.metadata?.app==='leadership-skill-builder');
const portal=existingPortal||await stripe.billingPortal.configurations.create({business_profile:{headline:'Leadership Skill Builder'},default_return_url:config.APP_BASE_URL+'/?billing=account',metadata:{app:'leadership-skill-builder'},features:{customer_update:{enabled:false},invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end'},subscription_update:{enabled:false}}},{idempotencyKey:'skill-builder-live-portal-v1'});
if(!portal.livemode||portal.default_return_url!==config.APP_BASE_URL+'/?billing=account'||!portal.features.subscription_cancel.enabled||portal.features.subscription_cancel.mode!=='at_period_end'||portal.features.subscription_update.enabled)throw Error('The production portal does not match the cancellation policy.');
config.STRIPE_PORTAL_CONFIGURATION=portal.id;
const url='https://europe-west1-'+project+'.cloudfunctions.net/stripeWebhook';
const events=['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','charge.refunded'];
const endpoints=await stripe.webhookEndpoints.list({limit:100});
let endpoint=endpoints.data.find(e=>e.livemode&&e.url===url);
if(endpoint){
 if(endpoint.status!=='enabled'||events.some(e=>!endpoint.enabled_events.includes(e)))throw Error('Review the existing production webhook configuration.');
 const secret=spawnSync('gcloud',['secrets','versions','list','STRIPE_WEBHOOK_SECRET','--project='+project,'--filter=state=ENABLED','--format=value(name)'],{encoding:'utf8'});
 if(secret.status||!secret.stdout.trim())throw Error('The existing production webhook needs its signing secret stored in Secret Manager.');
}else{
 endpoint=await stripe.webhookEndpoints.create({url,enabled_events:events,description:'Leadership Skill Builder production payments',metadata:{app:'leadership-skill-builder'},...(Stripe.API_VERSION?{api_version:Stripe.API_VERSION}:{})},{idempotencyKey:'skill-builder-live-webhook-v1'});
 if(!endpoint.secret)throw Error('Stripe did not return the new signing secret.');
 const metadata=spawnSync('gcloud',['secrets','describe','STRIPE_WEBHOOK_SECRET','--project='+project],{encoding:'utf8'});
 if(metadata.status){const created=spawnSync('gcloud',['secrets','create','STRIPE_WEBHOOK_SECRET','--replication-policy=automatic','--project='+project],{encoding:'utf8'});if(created.status)throw Error('Could not create the production signing-secret container.');}
 const stored=spawnSync('gcloud',['secrets','versions','add','STRIPE_WEBHOOK_SECRET','--data-file=-','--project='+project],{input:endpoint.secret,encoding:'utf8'});
 if(stored.status)throw Error('Could not store the new production signing secret. Recover it in Stripe before retrying; do not create another endpoint.');
}
config.STRIPE_WEBHOOK_ENDPOINT=endpoint.id;
writeFileSync('config/stripe.production.json',JSON.stringify(config,null,2)+'\n');
console.log('Configured and verified the live product, agreed prices, dedicated cancellation portal and signed receiver. Public IDs saved; no secret values printed or written to Git.');
