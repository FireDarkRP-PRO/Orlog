/* ORLOG - animations (Web Animations API, sans dépendance).
   - lancer : les dés (re)lancés tournent et changent de face avant de se poser ;
   - combat : haches et flèches volent vers l'adversaire, les casques et boucliers bloquent,
     les PV baissent coup par coup, les jetons, soins et faveurs s'affichent en bulles.
   Purement visuel : l'état du jeu est déjà à jour, ces animations ne font que le raconter.
   Respecte « réduire les animations » du système. */
const Anim = (() => {
  const reduit = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const FACES = ['a', 'h', 'f', 's', 'm'];
  const dort = ms => new Promise(r => setTimeout(r, ms));
  const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  let deja = new Set(), nouveaux = [], snap = null, rk = '', session = 0;

  /* ---------- Lancer de dés ---------- */
  // Dit si le dé k du joueur p vient d'être (re)lancé et n'a pas encore été animé.
  function dePret(v, p, k) {
    const ak = `${v.wins[0] + v.wins[1]}|${v.manche}|${v.r}|${p}|${k}`;
    const a = (v.phase === 'lancer' || v.phase === 'faveurs') && (v.rel[p] || []).includes(k) && !deja.has(ak);
    if (a) nouveaux.push(ak);
    return a;
  }

  function lancer(racine) {
    if (reduit) { racine.querySelectorAll('[data-anim]').forEach(b => b.removeAttribute('data-anim')); return; }
    racine.querySelectorAll('[data-anim]').forEach((b, i) => {
      const fin = b.dataset.anim, use = b.querySelector('use'), delai = (i % 6) * 70;
      b.removeAttribute('data-anim');
      use.setAttribute('href', '#ic-' + FACES[Math.floor(Math.random() * 5)]);
      b.classList.add('lance'); b.style.animationDelay = delai + 'ms';
      setTimeout(() => {
        let n = 0;
        const t = setInterval(() => {
          use.setAttribute('href', '#ic-' + (++n >= 7 ? fin : FACES[Math.floor(Math.random() * 5)]));
          if (n >= 7) clearInterval(t);
        }, 80);
      }, delai);
    });
  }

  /* ---------- Éléments flottants ---------- */
  function flotte(el, texte, couleur) {
    if (!el) return;
    const c = centre(el), d = document.createElement('div');
    d.className = 'popup'; d.textContent = texte; d.style.color = couleur;
    d.style.left = c.x + (Math.random() * 30 - 15) + 'px'; d.style.top = c.y + 'px';
    document.body.appendChild(d);
    d.animate([{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: 'translate(-50%,-50px)', opacity: 0 }], { duration: 1100, easing: 'ease-out' }).onfinish = () => d.remove();
  }

  function banniere(texte, panneau) {
    const c = centre(panneau), d = document.createElement('div');
    d.className = 'banniere'; d.textContent = texte; d.style.left = c.x + 'px'; d.style.top = c.y + 'px';
    document.body.appendChild(d);
    d.animate([
      { transform: 'translate(-50%,10px) scale(.8)', opacity: 0 },
      { transform: 'translate(-50%,0) scale(1)', opacity: 1, offset: .2 },
      { transform: 'translate(-50%,0) scale(1)', opacity: 1, offset: .8 },
      { transform: 'translate(-50%,-14px) scale(1)', opacity: 0 }], { duration: 1500 }).onfinish = () => d.remove();
  }

  const setPV = (o, p, val) => {
    const b = o.barres[p], v = Math.max(0, val);
    b.querySelector('i').style.width = v / Orlog.PV_MAX * 100 + '%';
    b.querySelector('span').textContent = v + ' PV';
  };

  /* ---------- Combat ---------- */
  async function tir(face, depuis, vers, bloque, delai) {          // un projectile : hache qui tourne, flèche qui vise
    if (!depuis || !vers) return;
    const a = centre(depuis), b = centre(vers), p = document.createElement('div');
    p.className = 'proj'; p.innerHTML = `<svg viewBox="0 0 32 32"><use href="#ic-${face}"/></svg>`;
    p.style.left = a.x - 18 + 'px'; p.style.top = a.y - 18 + 'px';
    document.body.appendChild(p);
    const dx = b.x - a.x, dy = b.y - a.y, k = bloque ? .8 : 1;
    const r0 = face === 'f' ? Math.atan2(dy, dx) * 180 / Math.PI + 45 : 0, r1 = face === 'f' ? r0 : 540;   // la pointe de l'icône vise en haut à droite
    await p.animate([{ transform: `translate(0,0) rotate(${r0}deg)` }, { transform: `translate(${dx * k}px,${dy * k}px) rotate(${r1}deg)` }],
      { duration: 560, delay: delai, easing: 'ease-in', fill: 'forwards' }).finished;
    if (bloque) await p.animate([{ opacity: 1 }, { transform: `translate(${dx * (k - .15)}px,${dy * (k - .15)}px) rotate(${r1 + 140}deg)`, opacity: 0 }], { duration: 260, fill: 'forwards' }).finished;
    p.remove();
  }

  async function etape(o, a, id) {                                  // le joueur a attaque le joueur 1 - a
    const d = 1 - a, D = o.dice;
    const liste = (p, f) => D[p].map((x, k) => ({ x, k })).filter(e => !e.x.x && e.x.f === f);
    const els = p => o.panneaux[p].querySelectorAll('.de');
    const lot = (face, att, def) => att.map((e, j) => {
      const bloque = j < def.length, cible = bloque ? els(d)[def[j].k] : o.barres[d];
      return tir(face, els(a)[e.k], cible, bloque, j * 140).then(() => {
        if (id !== session || !cible) return;
        if (bloque) {                                               // casque ou bouclier : choc et « Bloqué »
          cible.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', filter: 'brightness(1.7)' }, { transform: 'scale(1)' }], { duration: 340 });
          flotte(cible, 'Bloqué', '#1f6b3a');
        } else {                                                    // dégât : la barre de PV baisse, le panneau tremble
          o.cur[d]--; setPV(o, d, o.cur[d]); flotte(o.barres[d], '-1', '#9c3b2e');
          o.panneaux[d].animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 260 });
        }
      });
    });
    await Promise.all([...lot('a', liste(a, 'a'), liste(d, 'h')), ...lot('f', liste(a, 'f'), liste(d, 's'))]);
  }

  async function combat(o) {
    if (reduit) return;
    const id = ++session;
    o.barres = { 0: o.panneaux[0].querySelector('.pv'), 1: o.panneaux[1].querySelector('.pv') };
    o.cur = [...o.avant.hp];
    [0, 1].forEach(p => setPV(o, p, o.cur[p]));                     // on repart des PV d'avant la manche
    [0, 1].forEach(p => { const dt = o.apres.tok[p] - o.avant.tok[p]; if (dt) flotte(o.panneaux[p].querySelector('.jetons'), (dt > 0 ? '+' : '') + dt + ' jeton(s)', '#8a6a1f'); });
    o.faveurs.forEach(f => banniere(f.nom, o.panneaux[f.p]));
    await dort(o.faveurs.length ? 1500 : 400);
    if (id !== session) return;
    if (o.egalite) banniere('Égalité : mort subite !', o.panneaux[0]);
    else {
      for (const a of [o.premier, 1 - o.premier]) {
        await etape(o, a, id); await dort(300);
        if (id !== session) return;
        if (o.fin && o.cur[1 - a] <= 0) break;                      // la partie s'est arrêtée là : pas de riposte
      }
      [0, 1].forEach(p => {                                         // dégâts directs (Thor, Tyr…) et soins
        const diff = o.apres.hp[p] - o.cur[p];
        if (diff) flotte(o.barres[p], (diff > 0 ? '+' : '') + diff + ' PV', diff > 0 ? '#1f6b3a' : '#9c3b2e');
      });
    }
    [0, 1].forEach(p => setPV(o, p, o.apres.hp[p]));
  }

  /* ---------- À appeler après chaque rendu (multi.html, solo.html) ---------- */
  function apres(v, racine) {
    nouveaux.forEach(a => deja.add(a)); nouveaux = [];
    lancer(racine);
    if (v.phase === 'lancer' || v.phase === 'faveurs') {
      session++; document.querySelectorAll('.proj,.popup,.banniere').forEach(e => e.remove());
      snap = { hp: [...v.hp], tok: [...v.tok], sd: v.sd };         // état d'avant résolution
      return;
    }
    if (!['resultat', 'partie', 'fin'].includes(v.phase) || !v.res || !snap) return;
    const cle = v.wins[0] + v.wins[1] + '|' + v.manche + '|' + v.phase;
    if (cle === rk) return;                                         // déjà joué
    rk = cle;
    const ps = racine.querySelectorAll('.joueur'), panneaux = {};
    panneaux[1 - v.me] = ps[0]; panneaux[v.me] = ps[1];
    combat({ panneaux, dice: v.dice, premier: 1 - v.first, avant: snap, apres: { hp: v.hp, tok: v.tok },
      faveurs: v.res.choix.map((c, p) => c && { p, nom: Orlog.FAV[c.id][1] + ' (palier ' + c.t + ')' }).filter(Boolean),
      fin: v.fin !== null, egalite: v.sd && !snap.sd });
  }

  return { dePret, lancer, combat, apres };
})();
