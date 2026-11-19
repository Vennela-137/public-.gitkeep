const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true, game: 'Trivia Battle' }));

const BANK = [
 {c:'Science & Technology',q:'Which planet is known as the Red Planet?',o:['Venus','Mars','Jupiter','Mercury'],a:1},
 {c:'General Knowledge',q:'What is the largest ocean on Earth?',o:['Atlantic Ocean','Indian Ocean','Pacific Ocean','Arctic Ocean'],a:2},
 {c:'Movies & Entertainment',q:'Which fictional school does Harry Potter attend?',o:['Beauxbatons','Durmstrang','Hogwarts','Ilvermorny'],a:2},
 {c:'Sports',q:'How many players from one team are on the field in a standard football (soccer) match?',o:['9','10','11','12'],a:2},
 {c:'History & Geography',q:'The ancient city of Petra is located in which present-day country?',o:['Egypt','Jordan','Greece','Turkey'],a:1},
 {c:'Science & Technology',q:'What does CPU stand for?',o:['Central Processing Unit','Computer Power Utility','Core Program Upload','Central Program User'],a:0},
 {c:'General Knowledge',q:'Which animal is the largest mammal on Earth?',o:['African elephant','Blue whale','Giraffe','Whale shark'],a:1},
 {c:'Movies & Entertainment',q:'Which instrument has 88 keys on a standard modern version?',o:['Violin','Piano','Harp','Accordion'],a:1},
 {c:'Sports',q:'In tennis, what is the score called when both players have 40 points?',o:['Advantage','Deuce','Love','Tie-break'],a:1},
 {c:'History & Geography',q:'What is the capital city of Japan?',o:['Kyoto','Osaka','Tokyo','Hiroshima'],a:2},
 {c:'Science & Technology',q:'Which gas do plants absorb from the atmosphere during photosynthesis?',o:['Oxygen','Nitrogen','Carbon dioxide','Hydrogen'],a:2},
 {c:'General Knowledge',q:'How many sides does a hexagon have?',o:['Five','Six','Seven','Eight'],a:1},
 {c:'Movies & Entertainment',q:'Which animated character lives in a pineapple under the sea?',o:['Patrick Star','SpongeBob SquarePants','Squidward','Plankton'],a:1},
 {c:'History & Geography',q:'Which is the longest river in South America?',o:['Nile','Amazon','Paraná','Orinoco'],a:1},
 {c:'Sports',q:'Which country hosted the 2016 Summer Olympics?',o:['China','Brazil','United Kingdom','Japan'],a:1},
 {c:'Science & Technology',q:'What is the chemical symbol for gold?',o:['Ag','Gd','Au','Go'],a:2},
 {c:'General Knowledge',q:'Which language has the most native speakers worldwide?',o:['English','Spanish','Hindi','Mandarin Chinese'],a:3},
 {c:'History & Geography',q:'The Great Barrier Reef is off the coast of which country?',o:['Australia','Mexico','Indonesia','South Africa'],a:0},
 {c:'Movies & Entertainment',q:'Who wrote the play Romeo and Juliet?',o:['Charles Dickens','William Shakespeare','Oscar Wilde','Jane Austen'],a:1},
 {c:'Science & Technology',q:'What is the hardest naturally occurring substance?',o:['Quartz','Diamond','Granite','Topaz'],a:1},
 {c:'General Knowledge',q:'What is the smallest prime number?',o:['0','1','2','3'],a:2},
 {c:'Sports',q:'In basketball, how many points is a shot made from beyond the three-point line worth?',o:['1','2','3','4'],a:2},
 {c:'History & Geography',q:'Which continent contains the Sahara Desert?',o:['Asia','Africa','Australia','South America'],a:1},
 {c:'Science & Technology',q:'Which device is used to measure temperature?',o:['Barometer','Thermometer','Hygrometer','Altimeter'],a:1}
];
const rooms = new Map();
const TOTAL=10, ROUND_MS=15000;
const code=()=>Math.random().toString(36).slice(2,8).toUpperCase();
function publicRoom(r){return {code:r.code,hostId:r.hostId,status:r.status,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,correct:p.correct,answered:p.answered})),questionNo:r.questionNo,total:TOTAL};}
function broadcast(r){io.to(r.code).emit('room:update',publicRoom(r));}
function sendError(s,msg){s.emit('game:error',msg);}
function pickQuestions(){return [...BANK].sort(()=>Math.random()-.5).slice(0,TOTAL).map(q=>({...q}));}
function questionPayload(r){const q=r.questions[r.questionNo];return {number:r.questionNo+1,total:TOTAL,category:q.c,text:q.q,options:q.o,endsAt:r.endsAt,duration:ROUND_MS};}
function startQuestion(r){if(r.timer)clearTimeout(r.timer);if(r.questionNo>=TOTAL){finish(r);return;}r.status='question';r.answers=new Map();for(const p of r.players.values())p.answered=false;r.endsAt=Date.now()+ROUND_MS;io.to(r.code).emit('question:show',questionPayload(r));broadcast(r);r.timer=setTimeout(()=>reveal(r),ROUND_MS);}
function reveal(r){if(!r||r.status!=='question')return;if(r.timer)clearTimeout(r.timer);r.status='reveal';const q=r.questions[r.questionNo];io.to(r.code).emit('question:result',{correctIndex:q.a,correctText:q.o[q.a],answers:[...r.players.values()].map(p=>({id:p.id,name:p.name,answer:r.answers.get(p.id)?.choice??null,correct:r.answers.get(p.id)?.correct??false,points:r.answers.get(p.id)?.points??0})),scores:[...r.players.values()].sort((a,b)=>b.score-a.score).map(p=>({id:p.id,name:p.name,score:p.score,correct:p.correct}))});broadcast(r);}
function finish(r){if(r.timer)clearTimeout(r.timer);r.status='finished';const sorted=[...r.players.values()].sort((a,b)=>b.score-a.score||b.correct-a.correct);io.to(r.code).emit('game:finished',{winner:sorted[0]?{id:sorted[0].id,name:sorted[0].name}:null,players:sorted.map(p=>({id:p.id,name:p.name,score:p.score,correct:p.correct}))});broadcast(r);}
io.on('connection',socket=>{
 socket.on('room:create',({name})=>{name=String(name||'').trim().slice(0,18);if(!name)return sendError(socket,'Enter a nickname first.');let c;do{c=code();}while(rooms.has(c));const r={code:c,hostId:socket.id,players:new Map(),status:'lobby',questionNo:0,questions:[],answers:new Map(),timer:null,endsAt:0};r.players.set(socket.id,{id:socket.id,name,score:0,correct:0,answered:false});rooms.set(c,r);socket.join(c);socket.data.room=c;socket.emit('room:joined',{room:publicRoom(r),isHost:true});broadcast(r);});
 socket.on('room:join',({code:c,name})=>{c=String(c||'').trim().toUpperCase();name=String(name||'').trim().slice(0,18);const r=rooms.get(c);if(!name)return sendError(socket,'Enter a nickname first.');if(!r)return sendError(socket,'Room not found. Check the code.');if(r.status!=='lobby')return sendError(socket,'This game has already started.');if(r.players.size>=8)return sendError(socket,'This room is full (8 players maximum).');if([...r.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()))return sendError(socket,'That nickname is already taken in this room.');r.players.set(socket.id,{id:socket.id,name,score:0,correct:0,answered:false});socket.join(c);socket.data.room=c;socket.emit('room:joined',{room:publicRoom(r),isHost:false});broadcast(r);});
 socket.on('game:start',()=>{const r=rooms.get(socket.data.room);if(!r||r.hostId!==socket.id)return;if(r.status!=='lobby')return;if(r.players.size<2)return sendError(socket,'At least 2 players are needed to start.');r.questions=pickQuestions();r.questionNo=0;for(const p of r.players.values()){p.score=0;p.correct=0;}startQuestion(r);});
 socket.on('answer:submit',({choice})=>{const r=rooms.get(socket.data.room);if(!r||r.status!=='question'||r.answers.has(socket.id))return;const p=r.players.get(socket.id);if(!p)return;const q=r.questions[r.questionNo];const now=Date.now();if(now>r.endsAt)return;choice=Number(choice);if(!Number.isInteger(choice)||choice<0||choice>3)return;const correct=choice===q.a;const remaining=Math.max(0,r.endsAt-now);const points=correct?500+Math.round(500*remaining/ROUND_MS):0;p.score+=points;if(correct)p.correct++;p.answered=true;r.answers.set(socket.id,{choice,correct,points});socket.emit('answer:locked',{points});broadcast(r);if(r.answers.size===r.players.size)reveal(r);});
 socket.on('host:next',()=>{const r=rooms.get(socket.data.room);if(!r||r.hostId!==socket.id||r.status!=='reveal')return;r.questionNo++;startQuestion(r);});
 socket.on('game:replay',()=>{const r=rooms.get(socket.data.room);if(!r||r.hostId!==socket.id||r.status!=='finished')return;r.status='lobby';r.questionNo=0;r.questions=[];for(const p of r.players.values()){p.score=0;p.correct=0;p.answered=false;}broadcast(r);});
 socket.on('disconnect',()=>{const c=socket.data.room;const r=rooms.get(c);if(!r)return;r.players.delete(socket.id);if(r.players.size===0){if(r.timer)clearTimeout(r.timer);rooms.delete(c);return;}if(r.hostId===socket.id){r.hostId=r.players.keys().next().value;io.to(c).emit('host:changed',r.hostId);}if(r.status==='question'&&r.answers.size===r.players.size)reveal(r);broadcast(r);});
});
const PORT=process.env.PORT||3000;server.listen(PORT,'0.0.0.0',()=>console.log(`Trivia Battle running at http://localhost:${PORT}`));
