/* Pelada dos Papangu: autenticação e dados compartilhados pelo Supabase */
const $ = id => document.getElementById(id);
const show = (id,yes=true) => $(id).classList.toggle('hide',!yes);
const msg = (s,err=false) => { $('message').textContent=s; $('message').className=err?'error':''; };
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,session,me,players=[];
let pendingRegistrationPhoto=null;
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
async function uploadPhoto(file){if(!file||!session?.user)return false;file=await optimizePhoto(file);const path=session.user.id+'/avatar.jpg';const {error}=await db.storage.from(PHOTO_BUCKET).upload(path,file,{upsert:true,contentType:file.type});if(error)throw error;const {error:e}=await db.from('players').update({foto_path:path}).eq('id',session.user.id);if(e)throw e;return true;}
function previewFile(input,img){const file=input.files?.[0];if(!file){show(img,false);return;}try{validatePhoto(file);$(img).src=URL.createObjectURL(file);show(img);}catch(e){input.value='';show(img,false);msg(e.message,true);}}
$('reg-photo').onchange=()=>previewFile($('reg-photo'),'reg-photo-preview');
$('profile-photo').onchange=()=>previewFile($('profile-photo'),'profile-photo-preview');
const configured = window.PAPANGU_SUPABASE_URL?.startsWith('https://') && window.PAPANGU_SUPABASE_ANON_KEY && !window.PAPANGU_SUPABASE_ANON_KEY.startsWith('COLE_');
if (!configured || !window.supabase) show('setup');
else {
 db=window.supabase.createClient(window.PAPANGU_SUPABASE_URL,window.PAPANGU_SUPABASE_ANON_KEY);
 db.auth.onAuthStateChange((_event,s)=>{session=s;setTimeout(()=>boot(),0);});
 boot();
}
async function boot(){
 try {
  const {data:{session:s},error}=await db.auth.getSession(); if(error) throw error;
  session=s; show('auth',!s);show('app',!!s);if(!s){me=null;return;}
  const {data,error:e}=await db.from('players').select('*').eq('id',s.user.id).single();if(e)throw e;
  me=data;show('admin',me.role==='admin');
  if(pendingRegistrationPhoto){try{await uploadPhoto(pendingRegistrationPhoto);pendingRegistrationPhoto=null;const {data:updated}=await db.from('players').select('*').eq('id',s.user.id).single();if(updated)me=updated;}catch(e){msg('Conta criada, mas não foi possível enviar a foto: '+e.message,true);pendingRegistrationPhoto=null;}}
  if(me.foto_path){$('profile-photo-preview').src=photoUrl(me.foto_path);show('profile-photo-preview');}else show('profile-photo-preview',false);
  $('profile-name').value=me.nome;$('profile-nick').value=me.apelido||'';$('profile-position').value=me.posicao;
  $('profile-stars').textContent='Avaliação: '+ '★'.repeat(me.estrelas)+'☆'.repeat(5-me.estrelas)+' (somente administrador)';
  await refresh();
 }catch(e){msg('Erro ao carregar: '+e.message,true);}
}
$('show-login').onclick=()=>{show('login-form');show('register-form',false)};
$('show-register').onclick=()=>{show('login-form',false);show('register-form')};
$('login-form').onsubmit=async e=>{e.preventDefault();const {error}=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});msg(error?error.message:'Login realizado.',!!error)};
$('register-form').onsubmit=async e=>{
 e.preventDefault();
 try{pendingRegistrationPhoto=validatePhoto($('reg-photo').files?.[0]);}catch(err){msg(err.message,true);return;}
 const {data,error}=await db.auth.signUp({email:$('reg-email').value.trim(),password:$('reg-password').value,options:{data:{nome:$('reg-name').value.trim(),apelido:$('reg-nick').value.trim(),posicao:$('reg-position').value}}});
 if(error){pendingRegistrationPhoto=null;msg(error.message,true);return;}
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
 $('participants').innerHTML=players.map(p=>'<label class="item"><span>'+esc(p.nome)+' — '+esc(p.posicao)+'</span><input type="checkbox" class="participant" value="'+esc(p.id)+'" style="width:auto"></label>').join('');
 if(me?.role==='admin') $('admin-list').innerHTML=players.map(p=>'<div class="item"><span>'+esc(p.nome)+' — '+esc(p.posicao)+'</span><label>Estrelas <select class="rating" data-id="'+esc(p.id)+'">'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(p.estrelas===n?'selected':'')+'>'+n+' ★</option>').join('')+'</select></label></div>').join('');
 document.querySelectorAll('.rating').forEach(el=>el.onchange=async()=>{
  const {error}=await db.from('players').update({estrelas:Number(el.value)}).eq('id',el.dataset.id);
  msg(error?error.message:'Estrelas atualizadas!',!!error);await refresh();
 });
}
$('draw').onclick=()=>{
 const selected=[...document.querySelectorAll('.participant:checked')].map(x=>players.find(p=>p.id===x.value)).filter(Boolean);
 const n=Number($('team-count').value),size=Number($('team-size').value);
 if(!Number.isInteger(n)||n<2||n>6||!Number.isInteger(size)||size<2||size>15){msg('Confira o número de times e jogadores.',true);return;}
 if(selected.length<n*size){msg('Selecione pelo menos '+(n*size)+' jogadores.',true);return;}
 selected.sort(()=>Math.random()-.5);selected.sort((a,b)=>b.estrelas-a.estrelas);
 const teams=Array.from({length:n},()=>[]);selected.slice(0,n*size).forEach((p,i)=>{
  const round=Math.floor(i/n),idx=i%n,team=round%2===0?idx:n-1-idx;teams[team].push(p);
 });
 $('draw-result').innerHTML=teams.map((t,i)=>'<div class="panel"><h3>Time '+(i+1)+'</h3>'+t.map(p=>'<p>'+esc(p.nome)+' — '+esc(p.posicao)+'</p>').join('')+'</div>').join('');
 msg('Times sorteados!');
};
