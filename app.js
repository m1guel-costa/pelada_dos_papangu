/* Pelada dos Papangu: autenticação e dados compartilhados pelo Supabase */
const $ = id => document.getElementById(id);
const show = (id,yes=true) => $(id).classList.toggle('hide',!yes);
const msg = (s,err=false) => { $('message').textContent=s; $('message').className=err?'error':''; };
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,session,me,players=[];
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
 const {data,error}=await db.auth.signUp({email:$('reg-email').value.trim(),password:$('reg-password').value,options:{data:{nome:$('reg-name').value.trim(),apelido:$('reg-nick').value.trim(),posicao:$('reg-position').value}}});
 msg(error?error.message:(data.session?'Conta criada!':'Cadastro recebido! Confira seu e-mail para confirmar a conta.'),!!error);
};
$('logout').onclick=async()=>{await db.auth.signOut();msg('Você saiu da conta.')};
$('profile-form').onsubmit=async e=>{
 e.preventDefault();const changes={nome:$('profile-name').value.trim(),apelido:$('profile-nick').value.trim(),posicao:$('profile-position').value};
 const {error}=await db.from('players').update(changes).eq('id',me.id);
 msg(error?error.message:'Perfil atualizado!',!!error);if(!error)await boot();
};
$('refresh').onclick=refresh;
async function refresh(){
 const {data,error}=await db.from('players').select('id,nome,apelido,posicao,estrelas,role').order('estrelas',{ascending:false});
 if(error){msg(error.message,true);return;}players=data||[];
 $('ranking').innerHTML=players.length?players.map((p,i)=>'<div class="item"><span>'+(i+1)+'. <b>'+esc(p.nome)+'</b> '+(p.apelido?'('+esc(p.apelido)+')':'')+'<br><small>'+esc(p.posicao)+'</small></span><span class="stars">'+ '★'.repeat(p.estrelas)+'☆'.repeat(5-p.estrelas)+'</span></div>').join(''):'Nenhum jogador cadastrado ainda.';
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
