/* ORLOG - moteur de règles. Aucun affichage, état sérialisable en JSON. Joueurs 0 et 1.
   Faces : a=hache h=casque f=flèche s=bouclier m=main ; * = bordure dorée.
   Dé en jeu : { i: n° du dé (-1 si virtuel), f: face, g: doré, v: virtuel, x: détruit } */
const Orlog = (() => {
  const PV_MAX = 15;
  const parse = s => s.split(' ').map(x => ({ f: x[0], g: x.endsWith('*') }));
  const DES = ['a s f* a h m*', 'a s* f a m* h', 'a f* m a h* s', 'a s m* f h* a', 'a s* m a h f*', 'a s* m a f h*'].map(parse);

  // id: [priorité, nom, coûts des 3 paliers, description ({v} = valeur du palier), valeurs des 3 paliers]
  const FAV = {
    baldr:    [1, 'Invulnérabilité de Baldr', [3, 6, 9], 'Ajoute {v} dé(s) de défense, copies de tes casques ou boucliers', [1, 2, 3]],
    skadi:    [1, 'Chasse de Skadi', [6, 10, 14], 'Ajoute {v} flèche(s) (il faut déjà en avoir une)', [1, 2, 3]],
    bragi:    [1, 'Courroux de Bragi', [4, 8, 12], 'Ajoute {v} hache(s) (il faut déjà en avoir une)', [1, 2, 3]],
    freyr:    [2, 'Don de Freyr', [4, 6, 8], 'Ajoute {v} dés de la face majoritaire', [2, 3, 4]],
    thrymr:   [3, 'Vol de Thrymr', [3, 6, 9], 'Réduit de {v} niveau(x) la faveur adverse (P3 à P7)', [1, 2, 3]],
    loki:     [3, 'Ruse de Loki', [3, 6, 9], 'Détruit {v} jeton(s) adverse(s)', [1, 2, 3]],
    mimir:    [3, 'Sagesse de Mimir', [3, 5, 7], 'Gagne {v} jeton(s) par PV perdu cette manche', [1, 2, 3]],
    var:      [3, 'Serment de Var', [4, 7, 10], "Gagne {v} jeton(s) par jeton dépensé par l'adversaire", [1, 2, 3]],
    vidar:    [4, 'Puissance de Vidar', [2, 4, 6], 'Retire {v} casque(s) adverse(s)', [2, 4, 6]],
    ullr:     [4, "Visée d'Ullr", [2, 4, 6], 'Retire {v} bouclier(s) adverse(s)', [2, 4, 6]],
    hel:      [4, 'Étreinte de Hel', [6, 12, 18], 'Soigne {v} PV par dégât de hache infligé', [1, 2, 3]],
    heimdall: [4, "Garde d'Heimdall", [4, 7, 10], 'Soigne {v} PV par blocage réussi', [1, 2, 3]],
    tyr:      [4, 'Justice de Tyr', [4, 6, 8], 'Sacrifie tes dés de défense : {v} dégât(s) direct(s) par dé', [1, 2, 3]],
    skuld:    [4, 'Double de Skuld', [3, 6, 9], 'Détruit {v} flèche(s) adverse(s)', [1, 2, 3]],
    frigg:    [5, 'Regard de Frigg', [2, 4, 6], "Relance jusqu'à {v} dés non dorés", [2, 3, 4]],
    thor:     [6, 'Frappe de Thor', [4, 8, 12], 'Inflige {v} dégâts directs', [2, 5, 8]],
    brunhild: [6, 'Fureur de Brunhild', [4, 8, 12], '+{v} dégât(s) par hache non bloquée', [1, 2, 3]],
    odin:     [6, "Jugement d'Odin", [6, 10, 14], '{v} dégât(s) par dé doré', [1, 2, 3]],
    idunn:    [7, "Rajeunissement d'Idunn", [4, 7, 10], 'Soigne {v} PV', [2, 4, 6]],
    freyja:   [7, 'Bénédiction de Freyja', [3, 5, 7], "+{v} jetons à la manche suivante si tu as moins de PV que l'adversaire", [2, 4, 6]]
  };

  const rnd = (n, r) => Math.floor(r() * n);
  const nouvellePartie = () => ({ hp: [PV_MAX, PV_MAX], tok: [0, 0], first: rnd(2, Math.random), dice: [[], []], manche: 1, mortSubite: false });
  const lancer = (r = Math.random) => DES.map((d, i) => ({ i, ...d[rnd(6, r)], v: false, x: false }));
  const relancer = (dice, idx, r = Math.random) => idx.forEach(k => Object.assign(dice[k], DES[dice[k].i][rnd(6, r)]));
  const cout = (id, t) => FAV[id][2][t - 1];
  const texte = (id, t) => FAV[id][3].replace('{v}', FAV[id][4][t - 1]);

  // La faveur (id, palier t) peut-elle être choisie par le joueur p ? (jetons + conditions sur ses propres dés)
  function peutChoisir(S, p, id, t) {
    const c = cout(id, t);
    if (!c || S.tok[p] < c) return false;
    const D = S.dice[p].filter(d => !d.x), n = f => D.filter(d => d.f === f).length;
    if (id === 'skadi') return n('f') > 0;
    if (id === 'bragi') return n('a') > 0;
    if (id === 'baldr' || id === 'tyr') return n('h') + n('s') > 0;
    if (id === 'frigg') return D.some(d => !d.g && !d.v);
    return true;
  }

  /* Résout une manche. S : état avec S.dice = dés finaux des deux joueurs.
     choix[p] = { id, t, opt? } ou null. opt : { face } (Freyr), { n } (Tyr), { idx:[...] } (Frigg).
     Retourne { S, log, fin } ; fin = null (la partie continue), 0 ou 1 (joueur vainqueur). */
  function resoudre(S0, choix, r = Math.random) {
    const S = structuredClone(S0), log = [], L = m => log.push(m);
    const eff = [0, 0], dep = [0, 0], arme = [{}, {}], nonBloq = [0, 0], suite = [];
    const cnt = (p, f) => S.dice[p].filter(d => !d.x && d.f === f).length;
    const add = (p, f) => S.dice[p].push({ i: -1, f, g: false, v: true, x: false });
    const retirer = (p, f, n) => S.dice[p].filter(d => !d.x && d.f === f).sort((a, b) => b.g - a.g).slice(0, n).forEach(d => { d.x = true; });
    const perdre = (p, n) => { const l = Math.min(n, Math.max(S.hp[p], 0)); S.hp[p] -= n; if (arme[p].mimir) S.tok[p] += l * arme[p].mimir; };
    const soigner = (p, n) => { S.hp[p] = Math.min(PV_MAX, S.hp[p] + n); };
    const mort = () => { const a = S.hp[0] <= 0, b = S.hp[1] <= 0; return a && b ? 'nul' : a ? 1 : b ? 0 : null; };
    const fin = m => {
      if (m === 'nul') { S.hp = [1, 1]; S.mortSubite = true; L('Égalité : mort subite, les deux joueurs repartent à 1 PV.'); m = null; }
      S.first = 1 - S.first; S.manche++;
      return { S, log, fin: m };
    };

    // 1. Paiement des faveurs, puis Thrymr (ne touche que les faveurs de priorité 3 à 7 de l'adversaire)
    [0, 1].forEach(p => { const c = choix[p]; if (c) { eff[p] = c.t; dep[p] = cout(c.id, c.t); S.tok[p] -= dep[p]; } });
    [0, 1].forEach(p => {
      const c = choix[p], o = choix[1 - p];
      if (c && c.id === 'thrymr' && o && o.id !== 'thrymr' && FAV[o.id][0] >= 3) eff[1 - p] -= c.t;
    });
    const F = [0, 1].map(p => {
      const c = choix[p]; if (!c) return null;
      L(`J${p + 1} invoque ${FAV[c.id][1]} (palier ${c.t}).`);
      if (eff[p] <= 0) { L(`La faveur de J${p + 1} est annulée par Thrymr.`); return null; }
      return { ...c, e: eff[p] };
    });
    const val = p => FAV[F[p].id][4][F[p].e - 1];

    // 2. Début de résolution : jetons des faces dorées, puis vols de main (sur la même photo des réserves)
    [0, 1].forEach(p => { S.tok[p] += S.dice[p].filter(d => !d.v && d.g).length; });
    const t0 = [...S.tok], mains = [0, 1].map(p => S.dice[p].filter(d => !d.v && d.f === 'm').length);
    const vol = [Math.min(mains[0], t0[1]), Math.min(mains[1], t0[0])];
    S.tok[0] += vol[0] - vol[1]; S.tok[1] += vol[1] - vol[0];
    L(`Jetons : J1 ${S.tok[0]}, J2 ${S.tok[1]} (vols : J1 ${vol[0]}, J2 ${vol[1]}).`);

    // 3. Effets des faveurs
    const EFF = {
      baldr: (p, o, v) => { const b = S.dice[p].filter(d => !d.x && (d.f === 'h' || d.f === 's')); for (let k = 0; b.length && k < v; k++) add(p, b[k % b.length].f); },
      skadi: (p, o, v) => { for (let k = 0; k < v; k++) add(p, 'f'); },
      bragi: (p, o, v) => { for (let k = 0; k < v; k++) add(p, 'a'); },
      freyr: (p, o, v, opt) => {
        const cs = [...'ahfsm'].map(f => [f, cnt(p, f)]), m = Math.max(...cs.map(c => c[1]));
        const top = cs.filter(c => c[1] === m).map(c => c[0]), f = top.includes(opt.face) ? opt.face : top[0];
        for (let k = 0; k < v; k++) add(p, f);
      },
      thrymr: () => {},
      loki: (p, o, v) => { S.tok[o] = Math.max(0, S.tok[o] - v); },
      mimir: (p, o, v) => { arme[p].mimir = v; },
      var: (p, o, v) => { S.tok[p] += v * dep[o]; },
      vidar: (p, o, v) => retirer(o, 'h', v),
      ullr: (p, o, v) => retirer(o, 's', v),
      skuld: (p, o, v) => retirer(o, 'f', v),
      hel: (p, o, v) => { arme[p].hel = v; },
      heimdall: (p, o, v) => { arme[p].heim = v; },
      tyr: (p, o, v, opt, dgt) => {
        const d = S.dice[p].filter(x => !x.x && (x.f === 'h' || x.f === 's')), n = Math.min(opt.n ?? d.length, d.length);
        d.slice(0, n).forEach(x => { x.x = true; }); dgt[o] += v * n;
      },
      frigg: (p, o, v, opt) => {
        const c = S.dice[p].map((d, k) => k).filter(k => { const d = S.dice[p][k]; return !d.x && !d.g && !d.v; });
        relancer(S.dice[p], (opt.idx || c).filter(k => c.includes(k)).slice(0, v), r);
      },
      thor: (p, o, v, opt, dgt) => { dgt[o] += v; },
      brunhild: (p, o, v, opt, dgt) => { dgt[o] += v * nonBloq[p]; },
      odin: (p, o, v, opt, dgt) => { dgt[o] += v * S.dice[p].filter(d => !d.x && !d.v && d.g).length; },
      idunn: (p, o, v) => soigner(p, v),
      freyja: (p, o, v) => suite.push([p, v])
    };
    // Un groupe de priorité : effets (Tyr d'abord), dégâts directs appliqués ensemble, puis test de mort.
    const grp = pr => {
      const dgt = [0, 0];
      [0, 1].filter(p => F[p] && FAV[F[p].id][0] === pr)
        .sort((a, b) => (F[a].id === 'tyr' ? 0 : 1) - (F[b].id === 'tyr' ? 0 : 1))
        .forEach(p => EFF[F[p].id](p, 1 - p, val(p), F[p].opt || {}, dgt));
      [0, 1].forEach(p => { if (dgt[p]) { perdre(p, dgt[p]); L(`J${p + 1} subit ${dgt[p]} dégât(s) direct(s).`); } });
      return mort();
    };

    for (let pr = 1; pr <= 5; pr++) { const m = grp(pr); if (m !== null) return fin(m); }

    // 4. Combat séquentiel : le premier joueur attaque, puis le second ; soins et dégâts d'une étape comptés ensemble.
    for (const a of [S.first, 1 - S.first]) {
      const d = 1 - a, A = cnt(a, 'a'), Fl = cnt(a, 'f'), H = cnt(d, 'h'), Sh = cnt(d, 's');
      const dx = Math.max(0, A - H), df = Math.max(0, Fl - Sh), bl = Math.min(A, H) + Math.min(Fl, Sh);
      nonBloq[a] = dx;
      perdre(d, dx + df);
      if (arme[a].hel) soigner(a, arme[a].hel * dx);
      if (arme[d].heim) soigner(d, arme[d].heim * bl);
      L(`J${a + 1} attaque : ${dx + df} dégât(s), ${bl} blocage(s). PV : J1 ${S.hp[0]}, J2 ${S.hp[1]}.`);
      const m = mort(); if (m !== null) return fin(m);
    }

    // 5. Priorités 6 et 7 (Freyja : jetons versés pour la manche suivante, après les soins)
    const m6 = grp(6); if (m6 !== null) return fin(m6);
    grp(7);
    suite.forEach(([p, v]) => { if (S.hp[p] < S.hp[1 - p]) S.tok[p] += v; });
    return fin(null);
  }

  return { PV_MAX, DES, FAV, nouvellePartie, lancer, relancer, cout, texte, peutChoisir, resoudre };
})();
