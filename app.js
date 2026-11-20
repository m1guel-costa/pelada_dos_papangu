/* Pelada dos Papangu: autenticação e dados compartilhados pelo Supabase */
const $ = id => document.getElementById(id);
const show = (id,yes=true) => $(id).classList.toggle('hide',!yes);
const msg = (s,err=false) => { $('message').textContent=s; $('message').className=err?'error':''; };
const authErrorMessage = error => {
 const raw=String(error?.message||'Erro desconhecido');
 if(/email rate limit exceeded|email.*rate.*limit|over_email_send_rate_limit/i.test(raw))return 'O serviço de e-mail do Supabase atingiu o limite temporário de envios. Aguarde a liberação ou configure um servidor SMTP próprio no painel do Supabase. Não é necessário refazer o cadastro várias vezes.';
 return raw;
};
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,session,me,players=[];
let pendingRegistrationPhoto=null;
let recoveryMode=false;
let guests=[];
let activeTab='ranking-section';
function selectTab(id){if(id==='admin'&&me?.role!=='admin')id='ranking-section';activeTab=id;document.querySelectorAll('.tab-panel').forEach(p=>show(p.id,p.id===id));document.querySelectorAll('#app-nav .tab').forEach(b=>{const selected=b.dataset.tab===id;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));});window.scrollTo({top:0,behavior:'instant'});}
document.querySelectorAll('#app-nav .tab').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
function updateDrawSummary(){const checked=document.querySelectorAll('.participant:checked').length;const total=checked+guests.length;const limit=Number($('team-count').value)*Number($('team-size').value);document.querySelectorAll('.participant:not(:checked)').forEach(el=>{el.disabled=total>=limit;});$('guest-form').querySelector('button[type=submit]').disabled=total>=limit;$('selected-count').textContent=checked+' selecionado'+(checked===1?'':'s');$('draw-summary').textContent=checked+' mensalista(s) + '+guests.length+' diarista(s) = '+total+' jogador(es) para o sorteio.';}
function starsHtml(value){const n=Math.max(0,Math.min(5,Number(value)||0));const full=Math.floor(n),half=n-full>=0.5;return '<span aria-label="'+n.toLocaleString('pt-BR')+' de 5 estrelas">'+'★'.repeat(full)+(half?'<span class="half-star">★</span>':'')+'☆'.repeat(5-full-(half?1:0))+' <small class="star-score">'+n.toFixed(1).replace('.',',')+'</small></span>';}

// Cartinhas Papangu: estatísticas independentes das estrelas do ranking.
const CARD_FIELDS=[['vel','VEL'],['chu','CHU'],['pas','PAS'],['dri','DRI'],['def','DEF'],['fis','FIS']];
let cardStats={};
const OFFICIAL_CARDS={"nilso":{"overall":85,"vel":65,"chu":83,"pas":85,"dri":60,"def":80,"fis":99},"sidney":{"overall":82,"vel":50,"chu":78,"pas":84,"dri":70,"def":67,"fis":90},"cadoca":{"overall":84,"vel":52,"chu":80,"pas":99,"dri":83,"def":87,"fis":78},"lucas b":{"overall":85,"vel":65,"chu":91,"pas":76,"dri":69,"def":46,"fis":87},"leo":{"overall":83,"vel":41,"chu":82,"pas":90,"dri":88,"def":88,"fis":80},"heberth":{"overall":79,"vel":82,"chu":43,"pas":64,"dri":68,"def":82,"fis":89},"meiota":{"overall":94,"vel":90,"chu":85,"pas":85,"dri":70,"def":89,"fis":90},"raphael":{"overall":92,"vel":0,"chu":99,"pas":90,"dri":85,"def":0,"fis":30},"garel":{"overall":74,"vel":75,"chu":30,"pas":50,"dri":21,"def":65,"fis":70},"joão h":{"overall":93,"vel":24,"chu":91,"pas":97,"dri":87,"def":82,"fis":52},"miguel":{"overall":94,"vel":99,"chu":85,"pas":47,"dri":89,"def":50,"fis":85},"luna":{"overall":92,"vel":84,"chu":80,"pas":87,"dri":86,"def":80,"fis":79},"igor":{"overall":79,"vel":85,"chu":53,"pas":43,"dri":42,"def":77,"fis":89},"mv":{"overall":72,"vel":-20,"chu":88,"pas":86,"dri":20,"def":-1,"fis":-1},"guete":{"overall":74,"vel":45,"chu":36,"pas":50,"dri":0,"def":80,"fis":82},"lukinha":{"overall":88,"vel":88,"chu":38,"pas":70,"dri":62,"def":99,"fis":84},"filipe":{"overall":83,"vel":82,"chu":79,"pas":81,"dri":67,"def":74,"fis":76},"moa":{"overall":95,"vel":85,"chu":82,"pas":93,"dri":99,"def":89,"fis":99},"math":{"overall":79,"vel":77,"chu":83,"pas":80,"dri":88,"def":10,"fis":-99}};
const CARD_ALIASES={'leo 22':'leo','leonardo':'leo','rapha':'raphael','joao henrique':'joão h','lucas b':'lucas b','lucas branco':'lucas b','luca branco':'lucas b','lucas b.':'lucas b','lucas almeida':'lukinha','lucas':'lukinha','lukinhas':'lukinha','math':'math','matheus':'math','cadoca':'cadoca','carlos almeida':'cadoca','miguel costa':'miguel','croa':'miguel','mocir roberto':'moa','moacir':'moa','moacir roberto':'moa','mocir':'moa','nilson':'nilso','caua luna':'luna','cauã luna':'luna','kauan':'luna','kauan luna':'luna','luna':'luna','hebert da silva vieira':'heberth','hebert':'heberth','gareldo mel':'garel','gareldo':'garel','bruno rodrigues':'garel','brunao':'garel','bebeto':'heberth'};
function cardKey(s){return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
const OFFICIAL_BY_KEY=Object.fromEntries(Object.entries(OFFICIAL_CARDS).map(([k,v])=>[cardKey(k),v]));
function officialCardFor(p){const names=[p.apelido,p.nome].map(cardKey).filter(Boolean);if(names.some(n=>['caua luna','kauan','kauan luna','luna'].includes(n)))return OFFICIAL_BY_KEY['luna'];if(names.some(n=>n==='viana'||n.startsWith('viana ')||n.endsWith(' viana')))return OFFICIAL_BY_KEY['mv'];for(const key of names){const lookup=CARD_ALIASES[key]||key;const found=OFFICIAL_BY_KEY[cardKey(lookup)];if(found)return found;}return null;}

function cardOverall(st){return st?.overall??null;}
function positionAbbr(value){
 const x=cardKey(value);
 if(/atac|ponta|centroavante|centro avante|^ata$/.test(x))return 'ATA';
 if(/meio|volante|armador|^mai$|^mei$/.test(x))return 'MAI';
 if(/defens|zague|lateral|^zag$|^def$/.test(x))return 'DEF';
 if(/goleiro|^gol$/.test(x))return 'GOL';
 return (String(value||'JOG').trim().slice(0,3)).toUpperCase();
}
function cardTier(p){const stars=Number(p.estrelas)||0;return stars<2?'bronze':stars<3?'silver':'gold';}
function cardHtml(p){
 const st=officialCardFor(p)||cardStats[p.id]||null,overall=cardOverall(st),url=p.foto_path?photoUrl(p.foto_path):'';
 const name=esc(p.apelido||p.nome),pos=esc(positionAbbr(p.posicao)),tier=cardTier(p),special=tier==='gold'&&Number(overall)>=90;
 return '<article class="papangu-card papangu-card-'+tier+(special?' papangu-card-special':'')+'" aria-label="Cartinha de '+esc(p.nome)+'">'+(special?'<div class="toty-crystals" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>':'')+'<div class="card-top"><div class="card-overall">'+(overall??'—')+'<small>GER</small><span>'+pos+'</span></div><div class="card-portrait">'+(url?'<img loading="lazy" src="'+esc(url)+'" alt="Foto de '+esc(p.nome)+'">':'<span aria-hidden="true">⚽</span>')+'</div></div><div class="card-name">'+name+'</div><div class="card-divider"></div><div class="card-stats">'+CARD_FIELDS.map(([k,label])=>'<div><b>'+(st?.[k]??'—')+'</b><span>'+label+'</span></div>').join('')+'</div><div class="card-footer">⚽ PELADA DOS PAPANGU</div></article>';
}
function rankingMiniCard(p){
 const st=officialCardFor(p)||cardStats[p.id]||null,overall=cardOverall(st),elite=Number(overall)>=90;
 const photo=p.foto_path?'<img loading="lazy" src="'+esc(photoUrl(p.foto_path))+'" alt="">':'<span>⚽</span>';
 return '<span class="rank-mini-card'+(elite?' rank-mini-toty':'')+'"><strong>'+(overall??'—')+'</strong><span class="rank-mini-photo">'+photo+'</span><small>'+esc(positionAbbr(p.posicao))+'</small></span>';
}
function compactDrawCard(p){
 const st=officialCardFor(p)||cardStats[p.id]||null,overall=cardOverall(st),tier=cardTier(p),elite=tier==='gold'&&Number(overall)>=90;
 const photo=p.foto_path?'<img src="'+esc(photoUrl(p.foto_path))+'" alt="" loading="lazy">':'<span>⚽</span>';
 const stats=CARD_FIELDS.map(([key,label])=>'<span><b>'+(st?.[key]??'—')+'</b> '+label+'</span>').join('');
 return '<article class="draw-mini-fifa draw-mini-'+tier+(elite?' draw-mini-elite':'')+'" aria-label="Cartinha de '+esc(p.nome)+'">'+(elite?'<div class="toty-crystals" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>':'')+'<div class="mini-head"><strong>'+(overall??'—')+'<small>'+esc(positionAbbr(p.posicao))+'</small></strong><div class="mini-photo">'+photo+'</div></div><div class="mini-name">'+esc(p.apelido||p.nome)+'</div><div class="mini-stats">'+stats+'</div><div class="mini-stars">'+starsHtml(p.estrelas)+'</div></article>';
}
function compactGuestCard(p){return '<article class="draw-mini-fifa draw-mini-guest"><div class="mini-head"><strong>—<small>DIA</small></strong><div class="mini-photo">⚽</div></div><div class="mini-name">'+esc(p.nome)+'</div><div class="mini-stars">'+starsHtml(p.estrelas)+'</div></article>';}
function openPlayerCard(id){
 const p=players.find(x=>x.id===id);if(!p)return;
 $('card-modal-title').textContent=p.nome;
 $('card-modal-content').innerHTML=cardHtml(p);
 $('card-modal').classList.remove('hide');
}
$('card-modal-close').onclick=()=>show('card-modal',false);
$('card-modal').addEventListener('click',e=>{if(e.target===$('card-modal'))show('card-modal',false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')show('card-modal',false);});
$('ranking').addEventListener('click',e=>{const b=e.target.closest('[data-card-id]');if(b)openPlayerCard(b.dataset.cardId);});
$('my-card-button').onclick=()=>{if(me)openPlayerCard(me.id);};
async function loadCardStats(){
 const {data,error}=await db.from('player_cards').select('player_id,vel,chu,pas,dri,def,fis');
 if(error){cardStats={};return;}
 cardStats=Object.fromEntries((data||[]).map(x=>[x.player_id,x]));
}
function renderGuests(){$('guest-list').innerHTML=guests.map((g,i)=>'<div class="guest-item"><span class="guest-details">⚽ '+esc(g.nome)+' <small>· Diarista</small><br><span class="stars">'+starsHtml(g.estrelas)+'</span></span><button type="button" data-guest="'+i+'" aria-label="Remover '+esc(g.nome)+'">Remover</button></div>').join('');document.querySelectorAll('[data-guest]').forEach(b=>b.onclick=()=>{guests.splice(Number(b.dataset.guest),1);renderGuests();});updateDrawSummary();}
$('guest-form').onsubmit=e=>{e.preventDefault();const name=$('guest-name').value.trim();if(!name)return;if(document.querySelectorAll('.participant:checked').length+guests.length>=Number($('team-count').value)*Number($('team-size').value))return msg('Limite de jogadores atingido. Desmarque alguém antes de adicionar.',true);if(guests.length>=60)return msg('Limite de 60 diaristas por sorteio.',true);guests.push({nome:name,estrelas:Number($('guest-stars').value)});$('guest-name').value='';$('guest-stars').value='3';renderGuests();};
$('participants').addEventListener('change',updateDrawSummary);
const PHOTO_BUCKET='player-photos';
const PHOTO_TYPES=['image/jpeg','image/png','image/webp','image/heic','image/heif'];
function validatePhoto(file){if(!file)return null;if(!PHOTO_TYPES.includes(file.type)&&!/^image\//.test(file.type))throw Error('Escolha uma foto da galeria.');return file;}
async function optimizePhoto(file){
 validatePhoto(file);if(!file)return null;
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;
  await image.decode();
  let scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
  for(let attempt=0;attempt<8;attempt++){
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
   const quality=Math.max(.55,.88-attempt*.06);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
   if(!blob)throw Error('Não foi possível preparar esta imagem.');
   if(blob.size<=2*1024*1024)return new File([blob],'foto.jpg',{type:'image/jpeg'});
   scale*=.8;
  }
  throw Error('Não foi possível reduzir a foto. Tente outra imagem.');
 }catch(e){throw Error('Não foi possível processar a foto neste navegador. Tente JPG ou PNG.');}
 finally{URL.revokeObjectURL(url);}
}
function photoUrl(path){if(!path)return '';const {data}=db.storage.from(PHOTO_BUCKET).getPublicUrl(path);return data.publicUrl+'?v='+Date.now();}
function avatarHtml(p){const url=p.foto_path?photoUrl(p.foto_path):'';return url?'<img class="avatar" loading="lazy" src="'+esc(url)+'" alt="Foto de '+esc(p.nome)+'">':'<span class="avatar" aria-hidden="true" style="display:grid;place-items:center">⚽</span>';}
async function uploadPhoto(file,targetId=session?.user?.id){if(!file||!session?.user||!targetId)return false;if(targetId!==session.user.id&&me?.role!=='admin')throw Error('Apenas o administrador pode editar fotos de outros jogadores.');file=await optimizePhoto(file);const path=targetId+'/avatar.jpg';const {error}=await db.storage.from(PHOTO_BUCKET).upload(path,file,{upsert:true,contentType:file.type});if(error)throw error;const {error:e}=await db.from('players').update({foto_path:path}).eq('id',targetId);if(e)throw e;return true;}
function previewFile(input,img){const file=input.files?.[0];if(!file){show(img,false);return;}try{validatePhoto(file);$(img).src=URL.createObjectURL(file);show(img);}catch(e){input.value='';show(img,false);msg(e.message,true);}}
$('reg-photo').onchange=()=>previewFile($('reg-photo'),'reg-photo-preview');
$('profile-photo').onchange=()=>previewFile($('profile-photo'),'profile-photo-preview');
const configured = window.PAPANGU_SUPABASE_URL?.startsWith('https://') && window.PAPANGU_SUPABASE_ANON_KEY && !window.PAPANGU_SUPABASE_ANON_KEY.startsWith('COLE_');
if (!configured || !window.supabase) show('setup');
else {
 db=window.supabase.createClient(window.PAPANGU_SUPABASE_URL,window.PAPANGU_SUPABASE_ANON_KEY);
 db.auth.onAuthStateChange((event,s)=>{session=s;if(event==='PASSWORD_RECOVERY'){recoveryMode=true;show('auth');show('app',false);showAuthForm('reset-form');msg('Crie uma nova senha para recuperar sua conta.');return;}setTimeout(()=>boot(),0);});
 boot();
}
async function boot(){
 try {
  const {data:{session:s},error}=await db.auth.getSession(); if(error) throw error;
  session=s;if(recoveryMode){show('auth');show('app',false);showAuthForm('reset-form');return;}show('auth',!s);show('app',!!s);if(!s){me=null;guests=[];renderGuests();activeTab='ranking-section';return;}
  const {data,error:e}=await db.from('players').select('*').eq('id',s.user.id).single();if(e)throw e;
  me=data;show('admin-tab',me.role==='admin');selectTab(activeTab);
  if(pendingRegistrationPhoto){try{await uploadPhoto(pendingRegistrationPhoto);pendingRegistrationPhoto=null;const {data:updated}=await db.from('players').select('*').eq('id',s.user.id).single();if(updated)me=updated;}catch(e){msg('Conta criada, mas não foi possível enviar a foto: '+e.message,true);pendingRegistrationPhoto=null;}}
  if(me.foto_path){$('profile-photo-preview').src=photoUrl(me.foto_path);show('profile-photo-preview');}else show('profile-photo-preview',false);
  $('profile-name').value=me.nome;$('profile-nick').value=me.apelido||'';$('profile-position').value=me.posicao;
  $('profile-stars').textContent='Avaliação: '+ String(me.estrelas).replace('.',',')+' de 5 estrelas'+' (somente administrador)';
  await refresh();
 }catch(e){msg('Erro ao carregar: '+e.message,true);}
}
function showAuthForm(id){for(const form of ['login-form','register-form','forgot-form','reset-form'])show(form,form===id);}
$('show-login').onclick=()=>{if(recoveryMode)return msg('Defina sua nova senha antes de entrar.',true);showAuthForm('login-form');};
$('show-register').onclick=()=>{if(recoveryMode)return msg('Defina sua nova senha antes de criar outra conta.',true);showAuthForm('register-form');};
$('show-forgot').onclick=()=>{if(recoveryMode)return msg('Defina sua nova senha no formulário abaixo.',true);$('forgot-email').value=$('login-email').value;showAuthForm('forgot-form');};
$('forgot-form').onsubmit=async e=>{
 e.preventDefault();
 const email=$('forgot-email').value.trim();
 const redirectTo=window.location.origin+window.location.pathname;
 const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});
 msg(error?'Não foi possível enviar o link: '+authErrorMessage(error):'Se esse e-mail estiver cadastrado, você receberá um link para criar outra senha. Verifique também o spam.',!!error);
};
$('reset-form').onsubmit=async e=>{
 e.preventDefault();
 const password=$('reset-password').value;
 if(password!==$('reset-confirm').value)return msg('As duas senhas precisam ser iguais.',true);
 if(password.length<8)return msg('A senha deve ter pelo menos 8 caracteres.',true);
 const {error}=await db.auth.updateUser({password});
 if(error)return msg('Não foi possível alterar a senha: '+error.message,true);
 recoveryMode=false;$('reset-form').reset();showAuthForm('login-form');
 msg('Senha alterada com sucesso! Você já pode entrar com a nova senha.');
 await db.auth.signOut();
};
$('login-form').onsubmit=async e=>{e.preventDefault();const {error}=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});msg(error?authErrorMessage(error):'Login realizado.',!!error)};
$('register-form').onsubmit=async e=>{
 e.preventDefault();
 try{pendingRegistrationPhoto=validatePhoto($('reg-photo').files?.[0]);}catch(err){msg(err.message,true);return;}
 const {data,error}=await db.auth.signUp({email:$('reg-email').value.trim(),password:$('reg-password').value,options:{data:{nome:$('reg-name').value.trim(),apelido:$('reg-nick').value.trim(),posicao:$('reg-position').value}}});
 if(error){pendingRegistrationPhoto=null;msg(authErrorMessage(error),true);return;}
 msg(data.session?'Conta criada!':'Cadastro recebido! Confira seu e-mail para confirmar a conta. A foto será enviada ao entrar neste navegador; caso contrário, adicione-a no perfil.');
};
$('logout').onclick=async()=>{await db.auth.signOut();msg('Você saiu da conta.')};
$('profile-form').onsubmit=async e=>{
 e.preventDefault();const changes={nome:$('profile-name').value.trim(),apelido:$('profile-nick').value.trim(),posicao:$('profile-position').value};
 try{const {error}=await db.from('players').update(changes).eq('id',me.id);if(error)throw error;const file=$('profile-photo').files?.[0];if(file)await uploadPhoto(file);$('profile-photo').value='';msg('Perfil atualizado!');await boot();}catch(error){msg('Não foi possível salvar: '+error.message,true);}
};
$('refresh').onclick=refresh;
async function refresh(){
 const {data,error}=await db.from('players').select('id,nome,apelido,posicao,estrelas,role,foto_path').order('estrelas',{ascending:false});
 if(error){msg(error.message,true);return;}players=data||[];await loadCardStats();
 $('ranking').innerHTML=players.length?players.map((p,i)=>'<div class="item ranking-row"><button type="button" class="card-open" data-card-id="'+esc(p.id)+'" aria-label="Ver cartinha de '+esc(p.nome)+'"><span class="player-info">'+rankingMiniCard(p)+'<span>'+(i+1)+'. <b>'+esc(p.nome)+'</b> '+(p.apelido?'('+esc(p.apelido)+')':'')+'<br><small>'+esc(p.posicao)+'</small></span></span></button><span class="stars">'+starsHtml(p.estrelas)+'</span></div>').join(''):'Nenhum jogador cadastrado ainda.';
 const checkedIds=new Set([...document.querySelectorAll('.participant:checked')].map(el=>el.value));
 $('participants').innerHTML=players.map(p=>'<label class="item"><span class="participant-name">'+esc(p.nome)+'<small>'+esc(p.posicao)+'</small></span><span class="participant-stars" aria-label="'+p.estrelas+' de 5 estrelas">'+starsHtml(p.estrelas)+'</span><input type="checkbox" class="participant" value="'+esc(p.id)+'" '+(checkedIds.has(p.id)?'checked':'')+' style="width:auto"></label>').join('');
 updateDrawSummary();
 if(me?.role==='admin') $('admin-list').innerHTML=players.map(p=>'<div class="item"><span class="player-info">'+avatarHtml(p)+'<span>'+esc(p.nome)+' — '+esc(p.posicao)+'</span></span><label>Estrelas <select class="rating" data-id="'+esc(p.id)+'">'+[1,1.5,2,2.5,3,3.5,4,4.5,5].map(n=>'<option value="'+n+'" '+(p.estrelas===n?'selected':'')+' >'+String(n).replace('.',',')+' ★</option>').join('')+'</select></label><label>📷 Foto do mensalista <input type="file" class="admin-player-photo" data-id="'+esc(p.id)+'" accept="image/*" aria-label="Alterar foto de '+esc(p.nome)+'"></label><button type="button" class="admin-save-photo" data-id="'+esc(p.id)+'">Salvar foto</button></div>').join('');
 document.querySelectorAll('.admin-save-photo').forEach(button=>button.onclick=async()=>{const id=button.dataset.id;const input=[...document.querySelectorAll('.admin-player-photo')].find(el=>el.dataset.id===id);const file=input?.files?.[0];if(!file){msg('Selecione uma foto primeiro.',true);return;}button.disabled=true;try{await uploadPhoto(file,id);msg('Foto do mensalista atualizada!');await refresh();}catch(error){msg('Não foi possível salvar a foto: '+error.message,true);}finally{button.disabled=false;}});
 document.querySelectorAll('.rating').forEach(el=>el.onchange=async()=>{
  const {error}=await db.from('players').update({estrelas:Number(el.value)}).eq('id',el.dataset.id);
  msg(error?error.message:'Estrelas atualizadas!',!!error);await refresh();
 });
}
document.querySelectorAll('#team-count,#team-size').forEach(el=>el.addEventListener('input',updateDrawSummary));
$('participants').addEventListener('change',e=>{if(!e.target.matches('.participant'))return;const limit=Number($('team-count').value)*Number($('team-size').value);if(document.querySelectorAll('.participant:checked').length+guests.length>limit){e.target.checked=false;msg('Limite de '+limit+' jogadores atingido.',true);}updateDrawSummary();});
const DRAW_SAVED_KEY='papangu-sorteio-resultado-v1';
function openDrawScreen(){
 const screen=$('draw-screen'),result=$('draw-result');
 screen.classList.remove('hide');document.body.classList.add('draw-screen-open');
 screen.scrollTop=0;
}
function currentDrawSignature(){
 const ids=[...document.querySelectorAll('.participant:checked')].map(x=>x.value).sort();
 const visitors=guests.map(g=>({name:String(g.nome||'').trim().toLowerCase(),stars:Number(g.estrelas)})).sort((a,b)=>a.name.localeCompare(b.name));
 return JSON.stringify({ids,visitors,n:Number($('team-count').value),size:Number($('team-size').value)});
}
function updateDrawLock(){
 let saved=null;try{saved=JSON.parse(localStorage.getItem(DRAW_SAVED_KEY)||'null');}catch(e){}
 const same=!!saved?.html&&saved.signature===currentDrawSignature();
 $('draw').textContent=same?'Ver resultado do sorteio':'Sortear times equilibrados';
 $('draw').dataset.locked=String(same);
}
function restoreDrawResult(){
 try{const saved=JSON.parse(localStorage.getItem(DRAW_SAVED_KEY)||'null');if(!saved?.html)return false;
 $('draw-result').innerHTML=saved.html.replace(/(<article class="(?:draw-mini-fifa draw-mini-elite|papangu-card papangu-card-special)"[^>]*>)(?!<div class="toty-crystals")/g,'$1<div class="toty-crystals" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>');
 // Recalcular a raridade das cartas antigas já salvas, sem refazer o sorteio.
 $('draw-result').querySelectorAll('.draw-mini-fifa').forEach(card=>{const score=card.querySelector('.mini-stars .star-score');const value=score?Number(score.textContent.replace(',','.')):NaN;if(!Number.isFinite(value))return;const tier=value<2?'bronze':value<3?'silver':'gold';card.classList.remove('draw-mini-bronze','draw-mini-silver','draw-mini-gold');card.classList.add('draw-mini-'+tier);if(tier!=='gold'){card.classList.remove('draw-mini-elite');card.querySelector('.toty-crystals')?.remove();}});
 $('draw').textContent='Ver resultado do sorteio';
 $('draw').dataset.locked='true';
 return true;}catch(e){return false;}
}
$('draw').onclick=()=>{
 const saved=(()=>{try{return JSON.parse(localStorage.getItem(DRAW_SAVED_KEY)||'null')}catch(e){return null}})();
 if(saved?.signature===currentDrawSignature()&&restoreDrawResult()){openDrawScreen();return;}
 const monthly=[...document.querySelectorAll('.participant:checked')].map(x=>players.find(p=>p.id===x.value)).filter(Boolean);
 const visitors=guests.map((g,i)=>({id:'guest-'+i,nome:g.nome,posicao:'Diarista',estrelas:g.estrelas,guest:true}));
 const selected=[...monthly,...visitors];
 const n=Number($('team-count').value),size=Number($('team-size').value);
 if(!Number.isInteger(n)||n<2||n>6||!Number.isInteger(size)||size<2||size>15){msg('Confira o número de times e jogadores.',true);return;}
 const needed=n*size;
 if(selected.length!==needed){msg('Para '+n+' times com '+size+' jogadores, selecione exatamente '+needed+' participantes. Você selecionou '+selected.length+'.',true);return;}
 // Sorteia dentro de cada faixa de estrelas, evitando viés do sort aleatório.
 const shuffled=[...selected].map(p=>({p,r:Math.random()})).sort((a,b)=>b.p.estrelas-a.p.estrelas||a.r-b.r).map(x=>x.p);
 const teams=Array.from({length:n},()=>[]);
 shuffled.forEach((p,i)=>{const round=Math.floor(i/n),idx=i%n,team=round%2===0?idx:n-1-idx;teams[team].push(p);});
 $('draw-result').innerHTML=teams.map((t,i)=>'<div class="panel draw-team-panel"><h3>⚽ Time '+(i+1)+'</h3><div class="team-cards">'+t.map(p=>p.guest?'<div class="team-player-entry"><div class="draw-full-card guest-card">⚽<b>'+esc(p.nome)+'</b><small>Diarista · '+String(p.estrelas).replace('.',',')+' ★</small></div><div class="team-player-stars">'+starsHtml(p.estrelas)+'</div>'+compactGuestCard(p)+'</div>':'<div class="team-player-entry"><div class="draw-full-card">'+cardHtml(p)+'</div><div class="team-player-stars">'+starsHtml(p.estrelas)+'</div>'+compactDrawCard(p)+'</div>').join('')+'</div></div>').join('');
 try{localStorage.setItem(DRAW_SAVED_KEY,JSON.stringify({html:$('draw-result').innerHTML,signature:currentDrawSignature(),createdAt:new Date().toISOString()}));}catch(e){}
 $('draw').textContent='Ver resultado do sorteio';
 $('draw').dataset.locked='true';
 msg('Sorteio concluído! O resultado foi fixado neste navegador.');
 openDrawScreen();
};

// Tela exclusiva de resultado: voltar não realiza outro sorteio.
$('draw-screen-back').onclick=()=>{ $('draw-screen').classList.add('hide');document.body.classList.remove('draw-screen-open'); };
restoreDrawResult();
updateDrawLock();

// Alterar participantes ou diaristas libera uma NOVA escalação; não refaz a anterior.
$('participants').addEventListener('change',updateDrawLock);
$('team-count').addEventListener('change',updateDrawLock);
$('team-size').addEventListener('change',updateDrawLock);
const drawGuestObserver=new MutationObserver(updateDrawLock);
const guestList=document.getElementById('guest-list');
if(guestList)drawGuestObserver.observe(guestList,{childList:true,subtree:true});
