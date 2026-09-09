import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createGameServer } from './server.js';

const origin='https://game.test';
function message(socket) {
  return Promise.race([once(socket,'message').then(([data])=>JSON.parse(data)), new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error('Message timeout')),3000);t.unref();})]);
}
async function fixture(t) {
  const revoked=new Set();
  const app=createGameServer({authService:{config:{origins:new Set([origin]),secureCookies:true},authenticate:async token=>{
    if(!['alice','bob','eve'].includes(token)||revoked.has(token)) throw new Error('Unauthorized');
    await new Promise(resolve=>setTimeout(resolve,5));
    return {player:{id:token,publicCode:`PUBLIC-${token}`,nickname:'Guest',status:'active'},expiresAt:Date.now()+300000};
  }},env:{PORT:'0'}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(()=>app.close());
  const url=`ws://127.0.0.1:${app.server.address().port}/ws`;
  const connect=async(identity)=>{
    const socket=new WebSocket(url,{origin});await once(socket,'open');
    if(identity){const response=message(socket);socket.send(JSON.stringify({type:'authenticate',accessToken:identity}));assert.equal((await response).type,'authenticated');}
    return socket;
  };
  return {connect,revoked,url};
}
test('required authentication rejects unauthenticated commands, forged tokens and unapproved origins',async t=>{
  const {connect,url}=await fixture(t);
  for(const command of [{type:'list_rooms'},{type:'authenticate',accessToken:'forged'}]){
    const socket=await connect();const closed=once(socket,'close');socket.send(JSON.stringify(command));assert.equal((await closed)[0],4401);
  }
  const denied=new WebSocket(url,{origin:'https://evil.test'});
  await once(denied,'error');
});
test('authentication handshake is serialized and duplicate accounts cannot occupy both seats',async t=>{
  const {connect}=await fixture(t);
  const alice=await connect();const messages=[];
  alice.on('message',raw=>messages.push(JSON.parse(raw)));
  const roomReady=new Promise(resolve=>alice.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='room_created')resolve(m);}));
  alice.send(JSON.stringify({type:'authenticate',accessToken:'alice'}));
  alice.send(JSON.stringify({type:'create_room',protocolVersion:3}));
  await roomReady;
  assert.deepEqual(messages.map(m=>m.type),['authenticated','room_created']);
  assert.equal(messages[0].player.id,undefined);
  const duplicate=await connect();const closed=once(duplicate,'close');
  duplicate.send(JSON.stringify({type:'authenticate',accessToken:'alice'}));assert.equal((await closed)[0],4401);
});
test('revoked sessions cannot act and outsiders cannot take a disconnected player seat',async t=>{
  const {connect,revoked}=await fixture(t);
  const alice=await connect('alice');let next=message(alice);
  alice.send(JSON.stringify({type:'create_room',protocolVersion:3}));const room=await next;
  const bob=await connect('bob');next=message(bob);
  bob.send(JSON.stringify({type:'join_room',roomCode:room.roomCode,protocolVersion:3}));await next;
  let closed=once(bob,'close');bob.close();await closed;
  const eve=await connect('eve');next=message(eve);
  eve.send(JSON.stringify({type:'join_room',roomCode:room.roomCode,protocolVersion:3}));assert.equal((await next).message,'Room is unavailable.');
  revoked.add('alice');closed=once(alice,'close');alice.send(JSON.stringify({type:'list_rooms'}));assert.equal((await closed)[0],4401);
});
