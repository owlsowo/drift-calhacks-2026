import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url).pathname;
const out=root+'docs/evidence/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
const a=await browser.newContext({viewport:{width:360,height:800},reducedMotion:'reduce',acceptDownloads:true});
const b=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
const A=await a.newPage(),B=await b.newPage();
for(const p of [A,B])p.on('pageerror',e=>errors.push(e.message));
const checks=[];const pass=(name)=>{checks.push(name);console.log('PASS',name);};
const origin=process.env.DRIFT_WEB_URL||'http://localhost:5173';
async function ready(p){await p.goto(origin);await p.getByRole('button',{name:'Write my six words',exact:true}).waitFor();await p.waitForFunction(()=>!document.querySelector('.home-copy button').disabled);await p.evaluate(()=>document.fonts.ready);}
async function screen(p,name){await p.screenshot({path:out+name,fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');}
async function start(p,line){await p.getByRole('button',{name:'Write my six words',exact:true}).click();await p.getByRole('textbox').fill(line);await p.getByRole('button',{name:'Toss my bottle',exact:true}).click();await p.getByRole('button',{name:'Catch a bottle',exact:true}).waitFor();}
try{
  await ready(A);await ready(B);await screen(A,'home-360.png');await screen(B,'home-1440.png');pass('Real database connection and responsive home at 360 / 1440 pixels');
  await A.getByRole('button',{name:'My postcards',exact:true}).click();await A.getByRole('heading',{name:'A little empty. For now.'}).waitFor();await screen(A,'empty-360.png');await A.getByRole('button',{name:'Today’s bottle',exact:true}).click();pass('Empty collection offers a working next action');
  await start(A,'I taught the octopus insider trading.');await start(B,'I challenged their shark to poker.');pass('Two isolated identities submit their own six-word setups');
  await A.getByRole('button',{name:'Catch a bottle',exact:true}).click();await A.getByText('I challenged their shark to poker.',{exact:true}).waitFor();
  await B.getByRole('button',{name:'Catch a bottle',exact:true}).click();await B.getByText('I taught the octopus insider trading.',{exact:true}).waitFor();pass('Each identity catches the other writer, never itself');
  await A.getByRole('textbox').fill('Our lawyers would like another hand.');await screen(A,'reply-360.png');await screen(B,'reply-1440.png');
  await A.reload();await A.getByRole('button',{name:'Pick up where you left off',exact:true}).click();assert.equal(await A.getByRole('textbox').inputValue(),'Our lawyers would like another hand.');pass('Draft and exclusive assignment resume after a full reload');
  await A.getByRole('button',{name:'Seal our postcard',exact:true}).click();await A.getByRole('heading',{name:'Well, look what we made.'}).waitFor();await screen(A,'reveal-360.png');
  await B.getByRole('button',{name:'My postcards 1',exact:true}).waitFor();pass('Original author receives the returned postcard without refreshing');
  await B.getByRole('textbox').fill('Your account has been permanently frozen.');await B.getByRole('button',{name:'Seal our postcard',exact:true}).click();await B.getByRole('heading',{name:'Well, look what we made.'}).waitFor();await screen(B,'reveal-1440.png');pass('Both authors complete a canonical two-human postcard');
  const dl=A.waitForEvent('download');await A.getByRole('button',{name:'Save image',exact:true}).click();const download=await dl;await download.saveAs(out+'postcard-export.png');pass('PNG export creates a downloadable local image');
  await A.getByRole('button',{name:'My postcards 2',exact:true}).click();await A.getByRole('heading',{name:'Your stretch of shore.'}).waitFor();assert.equal(await A.locator('.collection-card').count(),2);await screen(A,'collection-360.png');pass('Both completed and returned postcards appear in the collection');
  await A.locator('.collection-card').first().click();await A.getByRole('button',{name:'Hide this postcard',exact:true}).click();await A.getByRole('button',{name:'Hide postcard',exact:true}).click();await A.getByRole('heading',{name:'Your stretch of shore.'}).waitFor();await A.waitForFunction(()=>document.querySelectorAll('.collection-card').length===1);pass('Author hiding removes the public card and collection projection');
  assert.deepEqual(errors,[]);pass('No uncaught browser errors');
  await fs.writeFile(out+'ui-smoke.json',JSON.stringify({checkedAt:new Date().toISOString(),mode:'local SpacetimeDB with explicitly disabled AI checks; synthetic test inputs, no attendee pilot',checks,errors},null,2));
}finally{await browser.close();}
