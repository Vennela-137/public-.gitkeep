import asyncio, json, random, string, time, os
from aiohttp import web

BANK = [
('Science & Technology','Which planet is known as the Red Planet?',['Venus','Mars','Jupiter','Mercury'],1),
('General Knowledge','What is the largest ocean on Earth?',['Atlantic Ocean','Indian Ocean','Pacific Ocean','Arctic Ocean'],2),
('Movies & Entertainment','Which fictional school does Harry Potter attend?',['Beauxbatons','Durmstrang','Hogwarts','Ilvermorny'],2),
('Sports','How many players from one team are on the field in a standard football (soccer) match?',['9','10','11','12'],2),
('History & Geography','The ancient city of Petra is located in which present-day country?',['Egypt','Jordan','Greece','Turkey'],1),
('Science & Technology','What does CPU stand for?',['Central Processing Unit','Computer Power Utility','Core Program Upload','Central Program User'],0),
('General Knowledge','Which animal is the largest mammal on Earth?',['African elephant','Blue whale','Giraffe','Whale shark'],1),
('Movies & Entertainment','Which instrument has 88 keys on a standard modern version?',['Violin','Piano','Harp','Accordion'],1),
('Sports','In tennis, what is the score called when both players have 40 points?',['Advantage','Deuce','Love','Tie-break'],1),
('History & Geography','What is the capital city of Japan?',['Kyoto','Osaka','Tokyo','Hiroshima'],2),
('Science & Technology','Which gas do plants absorb from the atmosphere during photosynthesis?',['Oxygen','Nitrogen','Carbon dioxide','Hydrogen'],2),
('General Knowledge','How many sides does a hexagon have?',['Five','Six','Seven','Eight'],1),
('Movies & Entertainment','Which animated character lives in a pineapple under the sea?',['Patrick Star','SpongeBob SquarePants','Squidward','Plankton'],1),
('History & Geography','Which is the longest river in South America?',['Nile','Amazon','Paraná','Orinoco'],1),
('Sports','Which country hosted the 2016 Summer Olympics?',['China','Brazil','United Kingdom','Japan'],1),
('Science & Technology','What is the chemical symbol for gold?',['Ag','Gd','Au','Go'],2),
('General Knowledge','Which language has the most native speakers worldwide?',['English','Spanish','Hindi','Mandarin Chinese'],3),
('History & Geography','The Great Barrier Reef is off the coast of which country?',['Australia','Mexico','Indonesia','South Africa'],0),
('Movies & Entertainment','Who wrote the play Romeo and Juliet?',['Charles Dickens','William Shakespeare','Oscar Wilde','Jane Austen'],1),
('Science & Technology','What is the hardest naturally occurring substance?',['Quartz','Diamond','Granite','Topaz'],1),
('General Knowledge','What is the smallest prime number?',['0','1','2','3'],2),
('Sports','In basketball, how many points is a shot made from beyond the three-point line worth?',['1','2','3','4'],2),
('History & Geography','Which continent contains the Sahara Desert?',['Asia','Africa','Australia','South America'],1),
('Science & Technology','Which device is used to measure temperature?',['Barometer','Thermometer','Hygrometer','Altimeter'],1)]
rooms={}; clients={}; TOTAL=10; ROUND_MS=15000

def send(ws,event,data=None):
    if not ws.closed: asyncio.create_task(ws.send_str(json.dumps({'event':event,'data':data or {}})))
def emit_room(r,event,data=None):
    for pid in list(r['players']):
        ws=clients.get(pid)
        if ws: send(ws,event,data)
def public(r):
    return {'code':r['code'],'hostId':r['hostId'],'status':r['status'],'players':[dict(id=p['id'],name=p['name'],score=p['score'],correct=p['correct'],answered=p['answered']) for p in r['players'].values()],'questionNo':r['questionNo'],'total':TOTAL}
def broadcast(r): emit_room(r,'room:update',public(r))
def error(ws,msg): send(ws,'game:error',msg)
async def reveal_later(r,delay):
    await asyncio.sleep(delay)
    if r['status']=='question': reveal(r)
def reveal(r):
    if r['status']!='question': return
    r['status']='reveal'; q=r['questions'][r['questionNo']]
    scores=sorted(r['players'].values(),key=lambda p:(-p['score'],-p['correct']))
    emit_room(r,'question:result',{'correctIndex':q[3],'correctText':q[2][q[3]],'answers':[{'id':p['id'],'name':p['name'],'answer':r['answers'].get(p['id'],{}).get('choice'),'correct':r['answers'].get(p['id'],{}).get('correct',False),'points':r['answers'].get(p['id'],{}).get('points',0)} for p in r['players'].values()],'scores':[{'id':p['id'],'name':p['name'],'score':p['score'],'correct':p['correct']} for p in scores]})
    broadcast(r)
def finish(r):
    r['status']='finished'; scores=sorted(r['players'].values(),key=lambda p:(-p['score'],-p['correct']))
    emit_room(r,'game:finished',{'winner':{'id':scores[0]['id'],'name':scores[0]['name']} if scores else None,'players':[{'id':p['id'],'name':p['name'],'score':p['score'],'correct':p['correct']} for p in scores]}); broadcast(r)
def start_question(r):
    if r['questionNo']>=TOTAL: finish(r); return
    r['status']='question'; r['answers']={}; r['endsAt']=int(time.time()*1000)+ROUND_MS
    for p in r['players'].values(): p['answered']=False
    q=r['questions'][r['questionNo']]
    emit_room(r,'question:show',{'number':r['questionNo']+1,'total':TOTAL,'category':q[0],'text':q[1],'options':q[2],'endsAt':r['endsAt'],'duration':ROUND_MS}); broadcast(r)
    asyncio.create_task(reveal_later(r,ROUND_MS/1000))
async def handler(request):
    ws=web.WebSocketResponse(); await ws.prepare(request); pid=''.join(random.choices(string.ascii_letters+string.digits,k=16)); clients[pid]=ws
    async for msg in ws:
        try: packet=json.loads(msg.data); event=packet.get('event'); data=packet.get('data') or {}
        except: continue
        if event=='room:create':
            name=str(data.get('name','')).strip()[:18]
            if not name: error(ws,'Enter a nickname first.'); continue
            c=''.join(random.choices(string.ascii_uppercase+string.digits,k=6))
            while c in rooms: c=''.join(random.choices(string.ascii_uppercase+string.digits,k=6))
            r={'code':c,'hostId':pid,'players':{},'status':'lobby','questionNo':0,'questions':[],'answers':{},'endsAt':0}; r['players'][pid]={'id':pid,'name':name,'score':0,'correct':0,'answered':False}; rooms[c]=r; ws._room=c; send(ws,'room:joined',{'room':public(r),'isHost':True,'selfId':pid}); broadcast(r)
        elif event=='room:join':
            c=str(data.get('code','')).strip().upper(); name=str(data.get('name','')).strip()[:18]; r=rooms.get(c)
            if not name: error(ws,'Enter a nickname first.')
            elif not r: error(ws,'Room not found. Check the code.')
            elif r['status']!='lobby': error(ws,'This game has already started.')
            elif len(r['players'])>=8: error(ws,'This room is full (8 players maximum).')
            elif any(p['name'].lower()==name.lower() for p in r['players'].values()): error(ws,'That nickname is already taken in this room.')
            else:
                r['players'][pid]={'id':pid,'name':name,'score':0,'correct':0,'answered':False}; ws._room=c; send(ws,'room:joined',{'room':public(r),'isHost':False,'selfId':pid}); broadcast(r)
        elif event=='game:start':
            r=rooms.get(getattr(ws,'_room',None))
            if not r or r['hostId']!=pid or r['status']!='lobby': continue
            if len(r['players'])<2: error(ws,'At least 2 players are needed to start.'); continue
            r['questions']=random.sample(BANK,TOTAL); r['questionNo']=0
            for p in r['players'].values(): p['score']=0; p['correct']=0
            start_question(r)
        elif event=='answer:submit':
            r=rooms.get(getattr(ws,'_room',None)); choice=data.get('choice')
            if not r or r['status']!='question' or pid in r['answers']: continue
            try: choice=int(choice)
            except: continue
            if choice not in range(4) or int(time.time()*1000)>r['endsAt']: continue
            p=r['players'].get(pid)
            if not p: continue
            q=r['questions'][r['questionNo']]; correct=choice==q[3]; remaining=max(0,r['endsAt']-int(time.time()*1000)); points=500+round(500*remaining/ROUND_MS) if correct else 0
            p['score']+=points; p['correct']+=int(correct); p['answered']=True; r['answers'][pid]={'choice':choice,'correct':correct,'points':points}; send(ws,'answer:locked',{'points':points}); broadcast(r)
            if len(r['answers'])==len(r['players']): reveal(r)
        elif event=='host:next':
            r=rooms.get(getattr(ws,'_room',None))
            if r and r['hostId']==pid and r['status']=='reveal': r['questionNo']+=1; start_question(r)
        elif event=='game:replay':
            r=rooms.get(getattr(ws,'_room',None))
            if r and r['hostId']==pid and r['status']=='finished':
                r['status']='lobby'; r['questionNo']=0; r['questions']=[]
                for p in r['players'].values(): p['score']=0; p['correct']=0; p['answered']=False
                broadcast(r)
    clients.pop(pid,None); c=getattr(ws,'_room',None); r=rooms.get(c)
    if r and pid in r['players']:
        del r['players'][pid]
        if not r['players']: rooms.pop(c,None)
        else:
            if r['hostId']==pid:
                r['hostId']=next(iter(r['players'])); emit_room(r,'host:changed',r['hostId'])
            if r['status']=='question' and len(r['answers'])==len(r['players']): reveal(r)
            broadcast(r)
    return ws

async def index(_): return web.FileResponse('public/index.html')
app=web.Application(); app.router.add_get('/ws',handler); app.router.add_get('/health',lambda _:web.json_response({'ok':True,'game':'Trivia Battle'})); app.router.add_get('/',index); app.router.add_static('/', 'public')
web.run_app(app, host='0.0.0.0', port=int(os.environ.get('PORT', 3000)))
