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
function updateDrawSummary(){const checked=document.querySelectorAll('.participant:checked').length;const total=checked+guests.length;$('selected-count').textContent=checked+' selecionado'+(checked===1?'':'s');$('draw-summary').textContent=checked+' mensalista(s) + '+guests.length+' diarista(s) = '+total+' jogador(es) para o sorteio.';}
function renderGuests(){$('guest-list').innerHTML=guests.map((g,i)=>'<div class="guest-item"><span class="guest-details">⚽ '+esc(g.nome)+' <small>· Diarista</small><br><span class="stars">'+'★'.repeat(g.estrelas)+'☆'.repeat(5-g.estrelas)+'</span></span><button type="button" data-guest="'+i+'" aria-label="Remover '+esc(g.nome)+'">Remover</button></div>').join('');document.querySelectorAll('[data-guest]').forEach(b=>b.onclick=()=>{guests.splice(Number(b.dataset.guest),1);renderGuests();});updateDrawSummary();}
$('guest-form').onsubmit=e=>{e.preventDefault();const name=$('guest-name').value.trim();if(!name)return;if(guests.length>=60)return msg('Limite de 60 diaristas por sorteio.',true);guests.push({nome:name,estrelas:Number($('guest-stars').value)});$('guest-name').value='';$('guest-stars').value='3';renderGuests();};
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
  $('profile-stars').textContent='Avaliação: '+ '★'.repeat(me.estrelas)+'☆'.repeat(5-me.estrelas)+' (somente administrador)';
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
 if(error){msg(error.message,true);return;}players=data||[];
 $('ranking').innerHTML=players.length?players.map((p,i)=>'<div class="item"><span class="player-info">'+avatarHtml(p)+'<span>'+(i+1)+'. <b>'+esc(p.nome)+'</b> '+(p.apelido?'('+esc(p.apelido)+')':'')+'<br><small>'+esc(p.posicao)+'</small></span></span><span class="stars">'+ '★'.repeat(p.estrelas)+'☆'.repeat(5-p.estrelas)+'</span></div>').join(''):'Nenhum jogador cadastrado ainda.';
 const checkedIds=new Set([...document.querySelectorAll('.participant:checked')].map(el=>el.value));
 $('participants').innerHTML=players.map(p=>'<label class="item"><span class="participant-name">'+esc(p.nome)+'<small>'+esc(p.posicao)+'</small></span><span class="participant-stars" aria-label="'+p.estrelas+' de 5 estrelas">'+'★'.repeat(p.estrelas)+'☆'.repeat(5-p.estrelas)+'</span><input type="checkbox" class="participant" value="'+esc(p.id)+'" '+(checkedIds.has(p.id)?'checked':'')+' style="width:auto"></label>').join('');
 updateDrawSummary();
 if(me?.role==='admin') $('admin-list').innerHTML=players.map(p=>'<div class="item"><span class="player-info">'+avatarHtml(p)+'<span>'+esc(p.nome)+' — '+esc(p.posicao)+'</span></span><label>Estrelas <select class="rating" data-id="'+esc(p.id)+'">'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(p.estrelas===n?'selected':'')+'>'+n+' ★</option>').join('')+'</select></label><label>📷 Foto do mensalista <input type="file" class="admin-player-photo" data-id="'+esc(p.id)+'" accept="image/*" aria-label="Alterar foto de '+esc(p.nome)+'"></label><button type="button" class="admin-save-photo" data-id="'+esc(p.id)+'">Salvar foto</button></div>').join('');
 document.querySelectorAll('.admin-save-photo').forEach(button=>button.onclick=async()=>{const id=button.dataset.id;const input=[...document.querySelectorAll('.admin-player-photo')].find(el=>el.dataset.id===id);const file=input?.files?.[0];if(!file){msg('Selecione uma foto primeiro.',true);return;}button.disabled=true;try{await uploadPhoto(file,id);msg('Foto do mensalista atualizada!');await refresh();}catch(error){msg('Não foi possível salvar a foto: '+error.message,true);}finally{button.disabled=false;}});
 document.querySelectorAll('.rating').forEach(el=>el.onchange=async()=>{
  const {error}=await db.from('players').update({estrelas:Number(el.value)}).eq('id',el.dataset.id);
  msg(error?error.message:'Estrelas atualizadas!',!!error);await refresh();
 });
}
$('draw').onclick=()=>{
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
 $('draw-result').innerHTML=teams.map((t,i)=>'<div class="panel"><h3>⚽ Time '+(i+1)+'</h3>'+t.map(p=>'<p>'+esc(p.nome)+(p.guest?' <small>· Diarista</small>':'')+' <span class="stars">'+ '★'.repeat(p.estrelas)+'☆'.repeat(5-p.estrelas)+'</span></p>').join('')+'</div>').join('');
 msg('Times sorteados! Diaristas foram incluídos apenas neste sorteio.');
 $('draw-result').scrollIntoView({behavior:'smooth',block:'start'});
};
