/* v2.0.5 — ponte de autorização offline antes do bootstrap legado */
(() => {
  // O app principal expõe __CENTRAL_BOOT__; mantemos o bootstrap suspenso
  // até a camada v2.0.5 instalar todos os overrides.
  globalThis.__CENTRAL_DEFER_BOOT__ = true;
  try {
    const raw=localStorage.getItem('central_offline_identity');
    if(!raw)return;
    const cached=JSON.parse(raw);
    const validatedAt=cached?.validatedAt||cached?.authenticatedAt;
    if(!validatedAt)return;
    const age=Date.now()-new Date(validatedAt).getTime();
    const max=7*24*60*60*1000;
    if(!Number.isFinite(age)||age<0||age>max)return;
    let day;
    try{day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
    catch(_){const d=new Date();day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
    // Evita que a regra antiga de "sessão diária" apague uma autorização offline ainda válida
    // antes que o patch v2.0.5 seja carregado.
    localStorage.setItem('central_daily_session_day',day);
  } catch(_) {}
})();
