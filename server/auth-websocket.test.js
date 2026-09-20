import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createGameServer } from './server.js';

const origin='https://game.test';
function message(socket) {
  return Promise.race([once(socket,'message').then(([data])=>JSON.parse(data)), new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error('Message timeout')),3000);t.unref();})]);
}
async function fixture(t,{serverInstanceId}={}) {
  const revoked=new Set();
  const app=createGameServer({authService:{config:{origins:new Set([origin]),secureCookies:true},authenticate:async token=>{
    if(!['alice','bob','eve'].includes(token)||revoked.has(token)) throw new Error('Unauthorized');
    await new Promise(resolve=>setTimeout(resolve,5));
    return {player:{id:token,publicCode:`PUBLIC-${token}`,nickname:'Guest',status:'active'},expiresAt:Date.now()+300000};
  }},env:{PORT:'0'},serverInstanceId});
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

test('a resume ticket from a previous server instance is voided without a loss',async t=>{
  const {connect}=await fixture(t,{serverInstanceId:'server-after-restart'});
  const alice=await connect('alice');const next=message(alice);
  alice.send(JSON.stringify({
    type:'resume_room',roomCode:'ABC123',protocolVersion:3,serverInstanceId:'server-before-restart'
  }));
  assert.deepEqual(await next,{
    type:'match_voided',reason:'server_restart',roomCode:'ABC123',serverInstanceId:'server-after-restart'
  });
});

test('authenticated players reclaim the same seat, board and turn after disconnecting',async t=>{
  const {connect}=await fixture(t);
  const alice=await connect('alice');let next=message(alice);
  alice.send(JSON.stringify({type:'create_room',protocolVersion:3}));const room=await next;
  assert.equal(room.player,'black');

  const bob=await connect('bob');
  const aliceRps=message(alice);const bobRps=message(bob);
  bob.send(JSON.stringify({type:'join_room',roomCode:room.roomCode,protocolVersion:3}));
  assert.equal((await aliceRps).player,'black');assert.equal((await bobRps).player,'white');

  let aliceMessage=message(alice);let bobMessage=message(bob);
  alice.send(JSON.stringify({type:'rps_choice',roomCode:room.roomCode,choice:'rock'}));
  bob.send(JSON.stringify({type:'rps_choice',roomCode:room.roomCode,choice:'scissors'}));
  await Promise.all([aliceMessage,bobMessage]);
  aliceMessage=message(alice);bobMessage=message(bob);
  await Promise.all([aliceMessage,bobMessage]);

  aliceMessage=message(alice);bobMessage=message(bob);
  alice.send(JSON.stringify({type:'action',roomCode:room.roomCode,action:{type:'deploy',unitType:'king',row:1,col:4}}));
  const [before]=await Promise.all([aliceMessage,bobMessage]);
  const remainingBeforeDisconnect=before.turnDeadline-Date.now();
  assert.equal(before.state.board[1][4].owner,'black');
  assert.equal(before.state.turn,'white');

  const disconnected=message(alice);const bobClosed=once(bob,'close');bob.close();await bobClosed;
  assert.equal((await disconnected).message,'Opponent disconnected.');

  const resumedBob=await connect('bob');
  aliceMessage=message(alice);bobMessage=message(resumedBob);
  resumedBob.send(JSON.stringify({type:'resume_room',roomCode:room.roomCode,protocolVersion:3}));
  const [aliceAfter,bobAfter]=await Promise.all([aliceMessage,bobMessage]);
  assert.equal(bobAfter.player,'white');
  assert.equal(bobAfter.state.board[1][4].owner,'black');
  assert.equal(bobAfter.state.turn,'white');
  assert.equal(aliceAfter.opponentConnected,true);
  assert.ok(bobAfter.turnDeadline-Date.now()<=remainingBeforeDisconnect+100);

  const aliceClosed=once(alice,'close');const resumedBobClosed=once(resumedBob,'close');
  alice.close();resumedBob.close();await Promise.all([aliceClosed,resumedBobClosed]);
  const resumedAlice=await connect('alice');aliceMessage=message(resumedAlice);
  resumedAlice.send(JSON.stringify({type:'resume_room',roomCode:room.roomCode,protocolVersion:3}));
  const waitingState=await aliceMessage;
  assert.equal(waitingState.player,'black');
  assert.equal(waitingState.opponentConnected,false);
  assert.equal(waitingState.state.board[1][4].owner,'black');

  const resumedBobAgain=await connect('bob');
  aliceMessage=message(resumedAlice);bobMessage=message(resumedBobAgain);
  resumedBobAgain.send(JSON.stringify({type:'resume_room',roomCode:room.roomCode,protocolVersion:3}));
  const [bothBackAlice,bothBackBob]=await Promise.all([aliceMessage,bobMessage]);
  assert.equal(bothBackAlice.opponentConnected,true);
  assert.equal(bothBackBob.opponentConnected,true);
  assert.equal(bothBackBob.state.turn,'white');
});
