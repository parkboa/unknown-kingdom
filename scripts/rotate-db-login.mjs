// Rotate only the dedicated development login using its own credentials.
// Pending files preserve the new credential if a network or filesystem step is interrupted.
import {createHash,createHmac,pbkdf2Sync,randomBytes} from 'node:crypto';
import {readFile,open,rename} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import pg from 'pg';
const local=new URL('../server/.env',import.meta.url);
const render=new URL('../server/.env.render',import.meta.url);
const localPending=new URL('../server/.env.rotation-pending',import.meta.url);
const renderPending=new URL('../server/.env.render.rotation-pending',import.meta.url);
let current,check;
let stage='preflight';
try {
  const localText=await readFile(local,'utf8');
  const renderText=await readFile(render,'utf8');
  const localUrl=new URL(parseEnv(localText).DATABASE_URL);
  const renderUrl=new URL(parseEnv(renderText).DATABASE_URL);
  for(const url of [localUrl,renderUrl]){
    if(url.hostname!=='aws-0-us-west-2.pooler.supabase.com'||url.username!=='daeguk_login.ajmrlhfhrcsstauqgnip'||url.searchParams.get('sslmode')!=='verify-full')throw {code:'UNEXPECTED_TARGET'};
  }
  current=new pg.Client({connectionString:localUrl.toString(),connectionTimeoutMillis:10000});
  await current.connect();
  const identity=await current.query("SELECT current_user='daeguk_login' AS ready");
  if(!identity.rows[0]?.ready)throw {code:'UNEXPECTED_ROLE'};
  const password=randomBytes(32).toString('hex');
  const salt=randomBytes(16);
  const salted=pbkdf2Sync(password,salt,4096,32,'sha256');
  const clientKey=createHmac('sha256',salted).update('Client Key').digest();
  const stored=createHash('sha256').update(clientKey).digest('base64');
  const server=createHmac('sha256',salted).update('Server Key').digest('base64');
  const verifier=`SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
  localUrl.password=password;renderUrl.password=password;
  async function prepare(path,text,url){
    if((text.match(/^DATABASE_URL=/gm)||[]).length!==1)throw {code:'AMBIGUOUS_ENV'};
    const f=await open(path,'wx',0o600);
    try{await f.writeFile(text.replace(/^DATABASE_URL=.*$/m,()=>`DATABASE_URL=${url}`));await f.sync();}finally{await f.close();}
  }
  stage='prepare protected recovery files';
  await prepare(localPending,localText,localUrl);
  await prepare(renderPending,renderText,renderUrl);
  stage='rotate dedicated password';
  await current.query(`ALTER ROLE daeguk_login PASSWORD '${verifier}'`);
  console.log('PASSWORD_ROTATED=true');
  stage='update environment files';
  await rename(localPending,local);await rename(renderPending,render);
  console.log('LOCAL_AND_RENDER_FILES_UPDATED=true');
  await current.end();current=null;
  stage='verify new login';
  for(let attempt=0;attempt<3;attempt++){
    check=new pg.Client({connectionString:localUrl.toString(),connectionTimeoutMillis:10000});
    try{
      await check.connect();
      const result=await check.query("SELECT current_user='daeguk_login' AND has_table_privilege(current_user,'daeguk_private.players','SELECT') AND has_table_privilege(current_user,'daeguk_private.players','INSERT') AND NOT has_table_privilege(current_user,'daeguk_private.players','DELETE') AS ready");
      if(!result.rows[0]?.ready)throw {code:'PRIVILEGE_CHECK_FAILED'};
      console.log('NEW_LOGIN_AND_PERMISSIONS_OK=true');break;
    }catch(error){if(error.code!=='28P01'||attempt===2)throw error;}
    finally{await check.end().catch(()=>{});check=null;}
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
}catch(error){
  console.error('FAILED_STAGE='+stage);
  console.error('ERROR_CODE='+(/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'UNKNOWN'));
  process.exitCode=1;
}finally{await current?.end().catch(()=>{});await check?.end().catch(()=>{});}
