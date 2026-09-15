/* Placeholder destinations can be replaced independently for each audience. */
(() => {
  const waitlists = window.MESA_WAITLIST_URLS || {};
  const nav = document.querySelector('.audience-nav');
  const toggle = nav?.querySelector('.nav-toggle');
  function closeMenu() { nav?.classList.remove('menu-open'); toggle?.setAttribute('aria-expanded','false'); }
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') { const open=nav?.classList.contains('menu-open');closeMenu();if(open)toggle.focus(); } });
  document.addEventListener('click', e => { if(nav && !nav.contains(e.target)) closeMenu(); });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click',closeMenu));
  matchMedia('(min-width:761px)').addEventListener('change', closeMenu);

  const campaign = {};
  const params = new URLSearchParams(location.search);
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','segment']) {
    const value=params.get(key);if(value)campaign[key]=value.slice(0,180);
  }
  document.querySelectorAll('[data-campaign-link]').forEach(a => {
    const target = new URL(a.getAttribute('href'),location.href);
    Object.entries(campaign).forEach(([k,v])=>target.searchParams.set(k,v));
    a.href=target.pathname+target.search+target.hash;
  });
  const audience=document.body.dataset.audience || 'home';
  function track(event, extra={}) {
    const detail={event,audience,landing_version:'v1',...campaign,...extra};
    window.dispatchEvent(new CustomEvent('mesa:analytics',{detail}));
    if(Array.isArray(window.dataLayer))window.dataLayer.push(detail);
  }
  track('landing_view');
  const dialog=document.querySelector('.waitlist-dialog');
  document.querySelectorAll('[data-waitlist]').forEach(a => {
    let destination;
    try {
      const value=waitlists[audience];
      const url=value && new URL(value,location.href);
      if(url && ['https:','http:'].includes(url.protocol)){Object.entries(campaign).forEach(([k,v])=>url.searchParams.set(k,v));url.searchParams.set('audience',audience);destination=url.href;a.href=destination;}
    } catch { /* Keep the preview link when a configured destination is invalid. */ }
    a.addEventListener('click', e => {
      track('cta_click',{placement:a.dataset.waitlist});
      if(!destination && a.dataset.waitlist === 'footer' && dialog?.showModal) {e.preventDefault();dialog.showModal();track('waitlist_placeholder_open');}
    });
  });
  dialog?.querySelector('.dialog-close')?.addEventListener('click',()=>dialog.close());
  dialog?.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  document.querySelectorAll('[data-demo]').forEach(video=>{
    const seen=new Set();
    video.addEventListener('play',()=>track('demo_play',{demo:video.dataset.demo}));
    video.addEventListener('timeupdate',()=>{if(!video.duration)return;for(const mark of [25,50,75]){if(video.currentTime/video.duration*100>=mark&&!seen.has(mark)){seen.add(mark);track('demo_progress',{demo:video.dataset.demo,percent:mark});}}});
    video.addEventListener('ended',()=>{if(!seen.has(100)){seen.add(100);track('demo_progress',{demo:video.dataset.demo,percent:100});}});
  });
})();
