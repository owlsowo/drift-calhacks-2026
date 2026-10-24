import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('../',import.meta.url).pathname);process.chdir(root);
if(existsSync('.env'))process.loadEnvFile('.env');
const candidates=[process.env.SPACETIME_BIN,'spacetime',path.resolve(root,'../work/spacetime-cli/spacetimedb-cli')].filter(Boolean);
const executable=candidates.find(p=>spawnSync(p,['--version'],{stdio:'ignore'}).status===0);
if(!executable)throw Error('Install SpacetimeDB 2.13 or set SPACETIME_BIN to its executable.');
const [action,...extra]=process.argv.slice(2);mkdirSync('.spacetime',{recursive:true});
let args=[];const env={...process.env};
if(action==='publish-local'){
  env.DRIFT_DEV_MODE=env.ANTHROPIC_API_KEY?'false':'true';
  args=['publish','drift-local','--server','http://127.0.0.1:3000','--module-path','spacetimedb','--yes=skip-login'];
}else if(action==='generate')args=['generate','--lang','typescript','--module-path','spacetimedb','--out-dir','apps/web/src/module_bindings','--yes'];
else if(action==='publish'){
  env.DRIFT_DEV_MODE='false';
  if(!env.ANTHROPIC_API_KEY)throw Error('Add ANTHROPIC_API_KEY to the local .env before production publishing.');
  args=['publish',...extra,'--module-path','spacetimedb'];
}else args=[action,...extra];
// Keep the account's default CLI login for authenticated hosted publishing.
// Local identity/config stays in the task workspace when using the bundled CLI.
const config=action==='publish-local'?['--config-path',path.resolve(root,'../work/spacetime-cli/cli.toml')]:[];
const child=spawnSync(executable,[...config,...args],{stdio:'inherit',env});process.exit(child.status??1);
