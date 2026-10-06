const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const app=express(); const server=http.createServer(app);
const io=new Server(server,{cors:{origin:'*'},maxHttpBufferSize:25*1024*1024});
const users=new Map(), sockets=new Map();
const key=s=>String(s||'').trim().toLowerCase();
const pub=u=>({n:u.name,a:u.av,online:true});
const list=()=>io.emit('users:list',[...users.values()].map(pub));
app.get('/health',(_,r)=>r.json({ok:true,service:'Cat Dressing Realm',users:users.size}));
app.get('/',(_,r)=>r.json({ok:true,service:'Cat Dressing Realm'}));
io.on('connection',socket=>{
 socket.on('user:join',({name,av})=>{name=String(name||'').trim().slice(0,16);av=String(av||'🐱').slice(0,4);if(name.length<2)return socket.emit('user:error','Name must be at least 2 characters.');const k=key(name);if(users.has(k)&&users.get(k).socketId!==socket.id)return socket.emit('user:error','That name is already online.');users.set(k,{name,av,socketId:socket.id});sockets.set(socket.id,k);socket.emit('user:joined',{name,av});list()});
 socket.on('invite:send',({to})=>{const me=users.get(sockets.get(socket.id)),target=users.get(key(to));if(!me||!target)return socket.emit('invite:error','That person is not online.');if(target.socketId===socket.id)return socket.emit('invite:error','Cannot invite yourself.');io.to(target.socketId).emit('invite:received',{from:pub(me)});socket.emit('invite:sent',{to:target.name})});
 socket.on('invite:accept',({from})=>{const me=users.get(sockets.get(socket.id)),other=users.get(key(from));if(!me||!other)return;io.to(me.socketId).emit('friend:added',pub(other));io.to(other.socketId).emit('friend:added',pub(me))});
 socket.on('chat:message',({to,message})=>{const me=users.get(sockets.get(socket.id)),target=users.get(key(to));if(!me||!target)return;const m={author:me.name,av:me.av,text:String(message||'').slice(0,500),time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),own:false};if(!m.text)return;io.to(target.socketId).emit('chat:message',{from:me.name,message:m});socket.emit('chat:sent',{to:target.name,message:{...m,own:true}})});
 socket.on('chat:file',({to,name,type,data})=>{const me=users.get(sockets.get(socket.id)),target=users.get(key(to));if(!me||!target||typeof data!=='string')return;if(data.length>28*1024*1024)return socket.emit('file:error','File is too large. Maximum is 20 MB.');const f={author:me.name,av:me.av,fileName:String(name||'file').slice(0,160),mime:String(type||'application/octet-stream').slice(0,100),data,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),own:false};io.to(target.socketId).emit('chat:file',{from:me.name,file:f});socket.emit('chat:fileSent',{to:target.name,file:{...f,own:true}})});
 ['call:accept','call:reject','call:offer','call:answer','call:ice','call:hangup'].forEach(ev=>socket.on(ev,p=>{const target=users.get(key(p.to)),me=users.get(sockets.get(socket.id));if(!target||!me)return;const q={...p};delete q.to;io.to(target.socketId).emit(ev,{from:me.name,...q})}));
 socket.on('call:invite',({to})=>{const me=users.get(sockets.get(socket.id)),target=users.get(key(to));if(!me||!target)return socket.emit('call:error','That person is not online.');io.to(target.socketId).emit('call:incoming',{from:pub(me)})});
 socket.on('disconnect',()=>{const k=sockets.get(socket.id);sockets.delete(socket.id);if(k&&users.get(k)?.socketId===socket.id){users.delete(k);list()}})
});
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log('Cat Dressing Realm server on '+PORT));
