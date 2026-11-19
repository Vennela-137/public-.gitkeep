
let ws,me=null,room=null,isHost=false,tick=null,seconds=15,selected=false,locked=false;
const $=id=>document.getElementById(id);
const screens=['home','lobby','game','reveal','finished'];

function show(id){
  screens.forEach(s=>$(s).classList.toggle('hidden',s!==id));
}

function toast(msg){
  const t=$('toast');
  t.textContent=msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2600);
}

function esc(s){
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function emit(event,data={}){
  if(ws&&ws.readyState===1)ws.send(JSON.stringify({event,data}));
}

function connect(){
  ws=new WebSocket('wss://public-gitkeep-hyqj.onrender.com/ws');

  ws.onmessage=e=>{
    const {event,data}=JSON.parse(e.data);

    if(event==='game:error')toast(data);

    if(event==='room:joined'){
      room=data.room;
      me=data.selfId;
      isHost=data.isHost;
      show('lobby');
      $('lobbyCode').textContent=room.code;
      renderRoom(room);
    }

    if(event==='room:update'){
      room=data;
      const mine=room.players.find(p=>p.id===me);

      if(mine){
        $('myScore').textContent=mine.score;
        $('answeredCount').textContent=`${room.players.filter(p=>p.answered).length} ANSWERED`;
      }

      if(!$('lobby').classList.contains('hidden'))renderRoom(room);

      if(room.status==='lobby'&&!$('finished').classList.contains('hidden')){
        show('lobby');
        renderRoom(room);
      }

      if(room.hostId===me)isHost=true;
      renderMini();
    }

    if(event==='host:changed'){
      isHost=data===me;
      toast(isHost?'You are now the host.':'Host changed.');
      renderRoom(room);
    }

    if(event==='question:show')question(data);
    if(event==='answer:locked')locked=true;
    if(event==='question:result')result(data);
    if(event==='game:finished')finished(data);
  };

  ws.onclose=()=>toast('Connection lost. Refresh to reconnect.');
}

function renderRoom(r){
  if(!r)return;

  $('playerCount').textContent=`${r.players.length} / 8`;

  $('playersList').innerHTML=r.players.map(p=>`
    <div class="player-chip">
      <span class="avatar">${esc(p.name.slice(0,1).toUpperCase())}</span>
      <span>${esc(p.name)}</span>
      ${p.id===r.hostId?'<span class="host-tag">HOST</span>':''}
    </div>
  `).join('');

  $('startBtn').classList.toggle('hidden',!isHost);

  $('hostHint').textContent=isHost?
    (r.players.length<2?'At least 2 players are needed to start.':'Everyone is in. Start when ready!'):
    'Only the host can start the battle.';

  renderMini();
}

function renderMini(){
  if(!room)return;

  $('miniPlayers').innerHTML=room.players.map(p=>
    `<span class="mini-player">${esc(p.name)} · ${p.score}</span>`
  ).join('');

  const mine=room.players.find(p=>p.id===me);
  if(mine)$('myScore').textContent=mine.score;
}

function question(q){
  show('game');
  selected=false;
  locked=false;

  seconds=Math.max(0,Math.ceil((q.endsAt-Date.now())/1000));

  $('category').textContent=q.category.toUpperCase();
  $('questionCount').textContent=`QUESTION ${q.number} / ${q.total}`;
  $('progressBar').style.width=`${q.number/q.total*100}%`;
  $('questionText').textContent=q.text;
  $('answeredCount').textContent='0 ANSWERED';
  $('answerStatus').textContent='Choose your answer before time runs out.';

  $('options').innerHTML=q.options.map((o,i)=>`
    <button class="option" data-choice="${i}">
      <span class="letter">${'ABCD'[i]}</span>
      <span>${esc(o)}</span>
    </button>
  `).join('');

  document.querySelectorAll('.option').forEach(b=>
    b.onclick=()=>submit(Number(b.dataset.choice))
  );

  if(tick)clearInterval(tick);

  updateTimer();

  tick=setInterval(()=>{
    seconds=Math.max(0,Math.ceil((q.endsAt-Date.now())/1000));
    updateTimer();
    if(seconds<=0)clearInterval(tick);
  },150);

  renderMini();
}

function updateTimer(){
  $('timer').textContent=seconds;
  $('timer').classList.toggle('urgent',seconds<=5);
}

function submit(choice){
  if(selected||locked)return;

  selected=true;

  document.querySelectorAll('.option').forEach(b=>{
    b.disabled=true;
    if(Number(b.dataset.choice)===choice)b.classList.add('selected');
  });

  $('answerStatus').textContent='Answer locked in! Waiting for the other players…';

  emit('answer:submit',{choice});
}

function result(data){
  if(tick)clearInterval(tick);

  show('reveal');

  $('correctAnswer').textContent=data.correctText;

  $('roundStandings').innerHTML=data.scores.map((p,i)=>`
    <div class="score-row">
      <span class="rank">${i<3?['🥇','🥈','🥉'][i]:String(i+1).padStart(2,'0')}</span>
      <span class="score-name">${esc(p.name)} <span class="score-detail">${p.correct} correct</span></span>
      <span class="score-points">${p.score.toLocaleString()} pts</span>
    </div>
  `).join('');

  $('nextBtn').classList.toggle('hidden',!isHost);

  $('nextHint').textContent=isHost?
    'Ready? Start the next question.':
    'Waiting for the host to continue…';
}

function finished(data){
  show('finished');

  if(tick)clearInterval(tick);

  $('winnerName').textContent=data.winner?data.winner.name:'No winner';

  $('finalStandings').innerHTML=data.players.map((p,i)=>`
    <div class="score-row">
      <span class="rank">${i<3?['🥇','🥈','🥉'][i]:String(i+1).padStart(2,'0')}</span>
      <span class="score-name">${esc(p.name)} <span class="score-detail">${p.correct}/10 correct</span></span>
      <span class="score-points">${p.score.toLocaleString()} pts</span>
    </div>
  `).join('');

  $('replayBtn').classList.toggle('hidden',!isHost);

  $('replayHint').textContent=isHost?
    'Play another match with the same squad.':
    'Waiting for the host to start another match.';
}

$('createBtn').onclick=()=>emit('room:create',{name:$('hostName').value});

$('joinBtn').onclick=()=>emit('room:join',{
  name:$('joinName').value,
  code:$('roomCode').value
});

$('roomCode').addEventListener('input',e=>
  e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')
);

$('startBtn').onclick=()=>emit('game:start');

$('copyCode').onclick=async()=>{
  try{
    await navigator.clipboard.writeText(room.code);
    toast('Room code copied!');
  }catch{
    toast('Room code: '+room.code);
  }
};

$('nextBtn').onclick=()=>emit('host:next');
$('replayBtn').onclick=()=>emit('game:replay');

connect();
