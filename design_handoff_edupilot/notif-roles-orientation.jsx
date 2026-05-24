// EduPilot — Notification Center par rôle + Orientation BEPC

// ─── Shell réutilisable ─────────────────────────────────────
const NotifShell = ({ role, user, navIdx = 13, cats, mainGroups, preview }) => {
  const navItems = role === 'PARENT' ? [
    { icon: 'home', label: 'Accueil' },
    { icon: 'users', label: 'Mes enfants', count: 2 },
    { icon: 'money', label: 'Paiements', count: 1 },
    { icon: 'calendar', label: 'EDT' },
    { icon: 'bell', label: 'Notifications', count: 5, active: true },
    { icon: 'sms', label: 'École' },
  ] : role === 'ÉLÈVE' ? [
    { icon: 'home', label: 'Tableau' },
    { icon: 'pencil', label: 'Notes' },
    { icon: 'book', label: 'Devoirs', count: 4 },
    { icon: 'calendar', label: 'EDT' },
    { icon: 'bell', label: 'Notifs', count: 6, active: true },
    { icon: 'trophy', label: 'Badges' },
  ] : role === 'ENSEIGNANT' ? [
    { icon: 'home', label: 'Mes classes' },
    { icon: 'pencil', label: 'Saisie notes', count: 3 },
    { icon: 'check', label: 'Appel' },
    { icon: 'calendar', label: 'EDT' },
    { icon: 'bell', label: 'Notifications', count: 7, active: true },
    { icon: 'sparkle', label: 'IA' },
  ] : directorNav.map((n, i) => ({ ...n, active: i === navIdx }));

  return (
    <DashShell role={role} user={user} nav={navItems}>
      <PageTitle title="Centre de notifications"
        sub={`${mainGroups.reduce((a, g) => a + g.items.length, 0)} messages · ${cats[0].n} non lus · regroupés et priorisés`}
        breadcrumb={['Notifications']}>
        <Button variant="ghost" icon="settings">Préférences</Button>
        <Button variant="secondary" icon="check">Tout marquer lu</Button>
      </PageTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1.5fr 1fr', gap: 14, height: 'calc(100% - 100px)' }}>
        <Card padding={10}>
          <SubLabel>Filtrer</SubLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
            {cats.map((c, i) => (
              <button key={c.k} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: 8, border: 0, background: i === 0 ? 'var(--brand-50)' : 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--brand-800)' : 'var(--text-secondary)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: `var(--${c.c}-500)` }}/>{c.l}
                </span>
                <span className="tabular" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)' }}>{c.n}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <SubLabel>Canal préféré</SubLabel>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" defaultChecked/>App</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" defaultChecked/>SMS</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox"/>WhatsApp</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" defaultChecked/>Email</label>
            </div>
          </div>
        </Card>

        <div style={{ overflow: 'auto', paddingRight: 4 }}>
          {mainGroups.map((g, gi) => (
            <NotifGroup key={gi} title={g.title} time={g.time} count={g.items.length} items={g.items}/>
          ))}
        </div>

        <div>{preview}</div>
      </div>
    </DashShell>
  );
};

// ─── Notification preview cards ─────────────────────────────
const NotifPreview = ({ accent, badge, title, time, body, timeline, actions }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <Card padding={0}>
      <div style={{ padding: '14px 18px', background: `var(--${accent}-50)`, borderBottom: `1px solid var(--${accent}-200)` }}>
        <Badge variant={accent} size="sm">{badge}</Badge>
        <h3 className="display" style={{ fontSize: 16, margin: '8px 0 0', lineHeight: 1.3 }}>{title}</h3>
        <p style={{ fontSize: 11, color: `var(--${accent}-800)`, margin: '4px 0 0' }}>{time}</p>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>{body}</div>
        {timeline && (
          <>
            <SubLabel>Timeline</SubLabel>
            <div style={{ marginTop: 8, position: 'relative', paddingLeft: 14, borderLeft: '2px solid var(--border-subtle)' }}>
              {timeline.map((e, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: 10 }}>
                  <span style={{ position: 'absolute', left: -19, top: 4, width: 8, height: 8, borderRadius: 4, background: `var(--${e.c}-500)`, boxShadow: '0 0 0 3px var(--surface-card)' }}/>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{e.t}</div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{e.e}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {actions && (
          <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {actions.map((a, i) => <Button key={i} size="sm" variant={i === 0 ? 'primary' : 'secondary'} icon={a.i}>{a.l}</Button>)}
          </div>
        )}
      </div>
    </Card>
    <Card style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <Icon name="sparkle" size={16} color="var(--brand-700)" style={{ marginTop: 2 }}/>
        <div style={{ fontSize: 12, color: 'var(--brand-800)', lineHeight: 1.55 }}>
          <strong>Intelligence :</strong> EduPilot regroupe les alertes répétitives en 1 notification + agit en ton nom (SMS auto, rappels) selon tes règles.
        </div>
      </div>
    </Card>
  </div>
);

// ─── 1 · NOTIF PARENT ───────────────────────────────────────
const NotifParent = () => (
  <NotifShell role="PARENT" user="Patrick Hounsou"
    cats={[
      { k: 'all', l: 'Tout', n: 23, c: 'neutral' },
      { k: 'p0', l: 'Urgent', n: 1, c: 'danger' },
      { k: 'finance', l: 'Paiements', n: 3, c: 'warning' },
      { k: 'notes', l: 'Notes & bulletins', n: 6, c: 'success' },
      { k: 'absence', l: 'Présences', n: 4, c: 'warning' },
      { k: 'devoirs', l: 'Devoirs', n: 5, c: 'info' },
      { k: 'evenement', l: 'Événements', n: 4, c: 'brand' },
    ]}
    mainGroups={[
      { title: '🔴 À traiter aujourd\'hui', time: '< 1h', items: [
        { type: 'urgent', priority: 'P0', title: 'Paiement T2 · échéance dans 6 jours', body: 'Aïcha + Mathieu · 220 000 FCFA · payez en 30 sec via MTN ou Moov.', time: '12 min', actions: ['Payer maintenant'] },
      ]},
      { title: '🎓 Côté école', time: 'aujourd\'hui', items: [
        { type: 'success', title: 'DST Maths 16,5/20 — Aïcha 🎉', body: 'Meilleure note de la classe. Félicitations !', time: '2 h', sender: 'M. Adjavon', actions: ['Voir bulletin'] },
        { type: 'warning', title: '2 absences cette semaine — Mathieu', body: 'Mardi matin · aucun justificatif reçu. SMS auto demain matin si rien.', time: '3 h', actions: ['Justifier', 'Contacter école'] },
        { type: 'reminder', title: 'Devoir maison à rendre vendredi — Aïcha', body: 'Mathématiques · DM théorème de Thalès.', time: '6 h' },
        { type: 'info', title: 'Conseil de classe 3ᵉ A — jeudi 16h', body: 'Bulletin disponible vendredi soir.', time: '8 h' },
      ]},
      { title: '📨 Cette semaine', time: '1-6 j', items: [
        { type: 'sms', title: 'SMS · Réunion parents-prof samedi 9h', body: 'Salle des fêtes · 142 confirmés. Confirmez votre présence.', time: 'lundi', actions: ['Je serai là', 'Empêché'] },
        { type: 'success', title: 'Paiement T1 confirmé · 220 000 FCFA', body: 'Reçu Flutterwave #FLW-882104.', time: 'jeudi' },
        { type: 'info', title: 'Sortie pédagogique CE2 reportée', body: 'Mathieu · météo défavorable. Reprogrammée mardi prochain.', time: 'mardi' },
      ]},
    ]}
    preview={<NotifPreview
      accent="warning" badge="ÉCHÉANCE PROCHE"
      title="Paiement scolarité T2"
      time="à régler avant le 11 mai 2026"
      body={<>Deux paiements à régler pour <strong>Aïcha</strong> (125 000 FCFA) et <strong>Mathieu</strong> (95 000 FCFA). Total : <strong>220 000 FCFA</strong>. Vous pouvez payer en ligne en moins de 30 secondes.</>}
      timeline={[
        { t: '02 mai', e: '1ʳᵉ relance par SMS', c: 'info' },
        { t: '05 mai', e: 'Rappel app (vous y êtes)', c: 'warning' },
        { t: '11 mai', e: 'Échéance · sinon majoration 5%', c: 'danger' },
      ]}
      actions={[
        { i: 'money', l: 'Payer 220 000 FCFA' },
        { i: 'calendar', l: 'Demander un échéancier' },
      ]}
    />}/>
);

// ─── 2 · NOTIF ENSEIGNANT ──────────────────────────────────
const NotifTeacher = () => (
  <NotifShell role="ENSEIGNANT" user="Paul Adjavon"
    cats={[
      { k: 'all', l: 'Tout', n: 31, c: 'neutral' },
      { k: 'saisie', l: 'Notes à saisir', n: 3, c: 'warning' },
      { k: 'absence', l: 'Absences classe', n: 8, c: 'danger' },
      { k: 'messages', l: 'Messages', n: 5, c: 'brand' },
      { k: 'devoirs', l: 'Devoirs rendus', n: 9, c: 'info' },
      { k: 'ia', l: 'Insights IA', n: 4, c: 'brand' },
      { k: 'admin', l: 'Conseils & réunions', n: 2, c: 'success' },
    ]}
    mainGroups={[
      { title: '⏰ À faire avant vendredi 17h', time: 'cette semaine', items: [
        { type: 'warning', priority: 'P0', title: 'Saisie DST Math · 3ᵉ A — 62/84 saisies', body: 'Échéance vendredi 17h · IA peut suggérer les notes manquantes.', time: '3 h', actions: ['Continuer la saisie'] },
        { type: 'reminder', title: 'Conseil de classe 3ᵉ A · jeudi 16h', body: '4 décisions en attente. Bulletins à valider avant 14h.', time: '6 h' },
        { type: 'info', title: 'DM Thalès · 18 copies à corriger', body: 'Élèves ont rendu en ligne. Correction IA pré-calculée disponible.', time: 'hier' },
      ]},
      { title: '🤖 Insights IA · tes classes', time: 'aujourd\'hui', items: [
        { type: 'info', title: 'Décrochage détecté · 3 élèves en 3ᵉ A · algèbre', body: 'Aïcha, Pierre, Yvette · régression > 1,5 pts sur 2 semaines.', time: '1 h', sender: 'EduPilot AI', actions: ['Générer soutien', 'Contacter parents'] },
        { type: 'success', title: 'Top progression · CM2-A (+2,1 pts)', body: 'Effet du changement de manuel. Bravo !', time: '4 h', sender: 'EduPilot AI' },
        { type: 'reminder', title: 'Suggestion d\'EDT · soutien math vendredi 14h', body: '14 enseignants disponibles · 1 salle libre.', time: '7 h' },
      ]},
      { title: '📨 Messages parents', time: 'aujourd\'hui', items: [
        { type: 'sms', title: 'Famille Hounsou · question sur le DST', body: '"Pourquoi 16,5 et pas 17 ? Détail SVP."', time: '2 h', actions: ['Répondre'] },
        { type: 'info', title: 'Famille Sossou · merci', body: '"Merci pour la patience avec Mathieu."', time: '5 h' },
      ]},
      { title: '🚨 Absences classe', time: 'cette semaine', items: [
        { type: 'warning', title: '3 absences · Koffi Dossou (4ᵉ B)', body: 'Regroupement automatique. SMS parent auto dans 2h.', time: 'matin', actions: ['Justifier', 'Annuler SMS'] },
        { type: 'warning', title: '2 absences · Jean-Paul Bio (3ᵉ A)', body: 'Aucun justificatif. Préviens-tu les parents ?', time: 'hier' },
      ]},
    ]}
    preview={<NotifPreview
      accent="info" badge="🤖 INSIGHT IA"
      title="3 élèves décrochent en algèbre"
      time="détecté ce matin · 3ᵉ A · math"
      body={<>D'après les 14 derniers jours, <strong>Aïcha H., Pierre A., Yvette A.</strong> montrent une régression > 1,5 pts en algèbre. Corrélation : ces 3 élèves ont chacun ≥ 2 absences sur la même période.</>}
      timeline={[
        { t: 'S6', e: 'Moyenne classe 14,8', c: 'success' },
        { t: 'S7', e: 'Chapitre fonctions affines · 12,1', c: 'warning' },
        { t: 'S8', e: 'Tendance baissière confirmée', c: 'danger' },
      ]}
      actions={[
        { i: 'sparkle', l: 'Générer séance soutien' },
        { i: 'sms', l: 'SMS aux 3 parents' },
      ]}
    />}/>
);

// ─── 3 · NOTIF ÉLÈVE ───────────────────────────────────────
const NotifStudent = () => (
  <NotifShell role="ÉLÈVE" user="Aïcha Hounsou"
    cats={[
      { k: 'all', l: 'Tout', n: 18, c: 'neutral' },
      { k: 'notes', l: 'Mes notes', n: 4, c: 'success' },
      { k: 'devoirs', l: 'Devoirs', n: 5, c: 'warning' },
      { k: 'edt', l: 'Mon emploi du temps', n: 2, c: 'info' },
      { k: 'badges', l: 'Badges & défis', n: 3, c: 'brand' },
      { k: 'messages', l: 'Messages prof', n: 2, c: 'success' },
      { k: 'evenement', l: 'Événements', n: 2, c: 'warning' },
    ]}
    mainGroups={[
      { title: '🔥 À faire maintenant', time: 'urgent', items: [
        { type: 'warning', priority: 'P0', title: 'DM Thalès à rendre demain', body: 'Math · M. Adjavon · à déposer avant 8h00.', time: '14 h restantes', actions: ['Ouvrir le devoir'] },
        { type: 'reminder', title: 'Inter. Anglais · vendredi 10h', body: 'Préparation Brevet · révise les "tag questions".', time: '4 j' },
      ]},
      { title: '🎉 Bravo !', time: 'aujourd\'hui', items: [
        { type: 'success', title: 'DST Maths 16,5/20 · meilleure note classe !', body: 'Tu gagnes le badge "Top 1 DST" (Or) 🏆', time: '2 h', actions: ['Voir mon badge'] },
        { type: 'success', title: 'Tu es maintenant 4ᵉ de la classe', body: 'Tu as gagné 3 places ce trimestre.', time: '3 h' },
        { type: 'reminder', title: 'Plus que 0,3 pts pour le badge "Top 3" (Or)', body: 'Objectif que tu t\'es fixé · tu es à 14,8.', time: '6 h' },
      ]},
      { title: '📚 Devoirs & cours', time: 'cette semaine', items: [
        { type: 'info', title: 'Nouveau cours publié · Géométrie', body: 'Vidéo 4 min · M. Adjavon · facultatif mais utile.', time: '1 j' },
        { type: 'info', title: '4 devoirs cette semaine · 2 rendus', body: 'Exos p.84 (math), lecture chap. 4-6 (français).', time: '1 j' },
        { type: 'sms', title: 'M. Adjavon te félicite', body: '"Continue comme ça Aïcha — tu peux viser le top 3."', time: '2 j', actions: ['Répondre'] },
      ]},
      { title: '📅 Vie scolaire', time: 'cette semaine', items: [
        { type: 'info', title: 'Conseil de classe jeudi · bulletin vendredi soir', body: 'Tes parents seront notifiés directement.', time: '2 j' },
        { type: 'reminder', title: 'Réunion parents-prof samedi 9h', body: 'Pense à le rappeler à tes parents 😉', time: '4 j' },
      ]},
    ]}
    preview={<NotifPreview
      accent="success" badge="🏆 NOUVEAU BADGE"
      title="Top 1 DST · Or"
      time="débloqué il y a 2h"
      body={<>Bravo Aïcha ! Tu as obtenu <strong>16,5/20</strong> au DST Maths, la meilleure note de la classe. C'est ton 13ᵉ badge — tu es dans le top 5% des élèves de l'école.</>}
      timeline={[
        { t: 'S6', e: 'DST blanc · 14,5', c: 'info' },
        { t: 'S7', e: 'Soutien optionnel suivi', c: 'brand' },
        { t: 'S8', e: 'DST officiel · 16,5 🎉', c: 'success' },
      ]}
      actions={[
        { i: 'trophy', l: 'Voir tous mes badges' },
        { i: 'sms', l: 'Partager à mes parents' },
      ]}
    />}/>
);

// ─── 4 · ORIENTATION POST-BEPC (Séries A1-A2 · B · C · D · E · F1-F4 · G1-G3 · DT) ─
const SERIES_BJ = {
  A1: { fam: 'A', t: 'Lettres-Langues', c: 'brand', bac: 'Littéraire', dom: 'Français, langues vivantes, philo' },
  A2: { fam: 'A', t: 'Lettres-Sciences humaines', c: 'brand', bac: 'Littéraire', dom: 'Histoire-géo, philo, langues' },
  B:  { fam: 'B', t: 'Lettres-Sciences sociales', c: 'brand', bac: 'Littéraire', dom: 'Économie, sociologie, philo' },
  C:  { fam: 'C', t: 'Sciences & Mathématiques', c: 'info', bac: 'Scientifique', dom: 'Maths, physique-chimie, sciences ingénieur' },
  D:  { fam: 'D', t: 'Biologie-Géologie', c: 'success', bac: 'Scientifique', dom: 'SVT, physique-chimie, maths' },
  E:  { fam: 'E', t: 'Mathématiques & Techniques', c: 'info', bac: 'Sci. & Technique', dom: 'Maths, sciences techniques industrielles' },
  F:  { fam: 'F', t: 'Techniques industrielles', c: 'warning', bac: 'Sci. & Technique', dom: 'F1 méca · F2 électro · F3 électrotech. · F4 génie civil' },
  G:  { fam: 'G', t: 'Techniques tertiaires', c: 'warning', bac: 'Tech. & Commercial', dom: 'G1 admin · G2 gestion · G3 commerce' },
  DT: { fam: 'DT', t: 'Diplôme de Technicien', c: 'danger', bac: 'Diplôme professionnel', dom: 'Filières pro (mode, BTP, info, eau, hôtellerie…)' },
};

const SeriesLegend = () => (
  <Card padding={20} style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
      <div>
        <h3 className="display" style={{ fontSize: 18, margin: 0, letterSpacing: '-0.02em' }}>Séries du système béninois</h3>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>3 bacs · 11 séries + DT (Diplôme de Technicien) — source DOB / MEMP</p>
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
        {['Littéraire', 'Scientifique', 'Sci. & Tech.', 'Tech. & Comm.', 'Pro / DT'].map((b, i) => (
          <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--${['brand','info','warning','warning','danger'][i]}-500)` }}/>
            {b}
          </span>
        ))}
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {Object.entries(SERIES_BJ).map(([k, s]) => (
        <div key={k} style={{ padding: 14, borderRadius: 12, background: `var(--${s.c}-50)`, borderLeft: `3px solid var(--${s.c}-600)` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="display" style={{ fontSize: 22, fontWeight: 800, color: `var(--${s.c}-800)`, letterSpacing: '-0.02em' }}>
              {k === 'DT' ? 'DT' : `Série ${k}`}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: `var(--${s.c}-800)` }}>· {s.t}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{s.dom}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bac {s.bac}</div>
        </div>
      ))}
    </div>
  </Card>
);

const OrientationPage = () => {
  const seriesColor = s => SERIES_BJ[s]?.c || 'neutral';
  return (
    <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
      <PageTitle title="Orientation post-BEPC · 3ᵉ A" sub="Année 2025-2026 · 26 élèves · conseil d'orientation jeudi 7 mai"
        breadcrumb={['Pédagogie', 'Orientation', '3ᵉ A · post-BEPC']}>
        <Button variant="secondary" icon="download">Fiches DOB / MEMP</Button>
        <Button icon="check">Clôturer affectations</Button>
      </PageTitle>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { l: 'À orienter', v: '26', c: 'brand' },
          { l: 'Décisions saisies', v: '18', c: 'success' },
          { l: 'En arbitrage', v: '5', c: 'warning' },
          { l: 'Désaccord famille/jury', v: '3', c: 'danger' },
          { l: 'IA suggestions prêtes', v: '26/26', c: 'brand' },
        ].map(s => (
          <Card key={s.l} padding={14}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
            <div className="display tabular" style={{ fontSize: 28, fontWeight: 700, color: `var(--${s.c}-700)`, marginTop: 4 }}>{s.v}</div>
          </Card>
        ))}
      </div>

      <SeriesLegend/>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <Card padding={0}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Décisions d'orientation · 3ᵉ A</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip active>Tous</Chip>
              <Chip count={5}>Arbitrage</Chip>
              <Chip count={3}>Désaccord</Chip>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: 'var(--surface-sunken)' }}>
              {['Élève', 'Moy. générale', 'BEPC blanc', 'Profil IA', '1ᵉʳ vœu famille', 'Reco. conseil', 'État'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                { n: 'Marie Bossou', m: 18.0, bepc: 16.8, ai: 'C', wish: 'C', dec: 'C', state: 'ok' },
                { n: 'Aïcha Hounsou', m: 14.8, bepc: 15.2, ai: 'D', wish: 'D', dec: 'D', state: 'ok' },
                { n: 'Yvette Adissi', m: 16.5, bepc: 16.0, ai: 'A1', wish: 'A1', dec: 'A1', state: 'ok' },
                { n: 'Fatou Adjavon', m: 14.6, bepc: 14.0, ai: 'A2', wish: 'A2', dec: 'A2', state: 'ok' },
                { n: 'Mathieu Sossou', m: 13.4, bepc: 13.1, ai: 'G', wish: 'C', dec: '?', state: 'conflict' },
                { n: 'Aminatou Coffi', m: 15.5, bepc: 14.2, ai: 'B', wish: 'D', dec: '?', state: 'arbitrage' },
                { n: 'Pierre Akin', m: 12.8, bepc: 12.0, ai: 'F2', wish: 'A1', dec: 'F2', state: 'conflict' },
                { n: 'Serge Padonou', m: 10.5, bepc: 10.0, ai: 'G2', wish: 'G2', dec: 'G2', state: 'ok' },
                { n: 'Koffi Dossou', m: 11.0, bepc: 10.4, ai: 'DT', wish: 'D', dec: '?', state: 'conflict' },
                { n: 'Lucie Houngbedji', m: 14.5, bepc: 14.6, ai: 'E', wish: 'E', dec: 'E', state: 'ok' },
                { n: 'Olivier Tossou', m: 13.5, bepc: 13.2, ai: 'F3', wish: 'F3', dec: 'F3', state: 'ok' },
              ].map((r, i) => {
                const decSeries = r.dec === '?' ? null : (r.dec.match(/^[A-Z]/) || [])[0];
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={r.n} size="sm"/><span style={{ fontSize: 13, fontWeight: 600 }}>{r.n}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="display tabular" style={{ fontSize: 14, fontWeight: 700, color: r.m >= 14 ? 'var(--success-700)' : r.m < 12 ? 'var(--warning-700)' : 'var(--text-primary)' }}>{r.m.toFixed(1).replace('.', ',')}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="tabular" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{r.bepc.toFixed(1).replace('.', ',')}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Badge variant={seriesColor(r.ai)} size="sm" icon="sparkle">{r.ai}</Badge>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Badge variant={seriesColor(r.wish)} size="sm">{r.wish}</Badge>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {r.dec === '?' ? <Badge variant="neutral" size="sm">À décider</Badge> : <Badge variant={seriesColor(r.dec)} size="sm">{r.dec}</Badge>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {r.state === 'ok' && <Badge variant="success" size="sm" icon="check">Validé</Badge>}
                      {r.state === 'arbitrage' && <Badge variant="warning" size="sm" dot>Arbitrage</Badge>}
                      {r.state === 'conflict' && <Badge variant="danger" size="sm" dot>Désaccord</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <SubLabel>Répartition prévue · 26 élèves</SubLabel>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { s: 'A1-A2 · Lettres', v: 4, c: 'brand', pct: 15 },
                { s: 'B · Sci. sociales', v: 2, c: 'brand', pct: 8 },
                { s: 'C · Sciences & Math', v: 4, c: 'info', pct: 15 },
                { s: 'D · Bio-Géologie', v: 6, c: 'success', pct: 23 },
                { s: 'E · Math & Tech.', v: 2, c: 'info', pct: 8 },
                { s: 'F (F1-F4) · Indus.', v: 3, c: 'warning', pct: 12 },
                { s: 'G (G1-G3) · Tertiaire', v: 3, c: 'warning', pct: 12 },
                { s: 'DT · Pro', v: 2, c: 'danger', pct: 7 },
              ].map(s => (
                <div key={s.s}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{s.s}</span>
                    <span className="tabular" style={{ fontSize: 11, fontWeight: 700, color: `var(--${s.c}-700)` }}>{s.v} ({s.pct}%)</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--neutral-200)', borderRadius: 2.5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: s.pct + '%', background: `var(--${s.c}-600)` }}/>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ background: 'linear-gradient(135deg, var(--brand-800), var(--accent-600))', color: '#fff', border: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 8 }}>
              <Icon name="sparkle" size={12}/>Désaccord à discuter
            </div>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>
              Koffi Dossou · vœu D, IA recommande DT
            </div>
            <p style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.6, marginTop: 8 }}>
              Moyenne 11,0/20 · BEPC blanc 10,4. <strong>SVT 9,5 · physique 10,2.</strong> Profil "manuel & pragmatique" — la série D risque l'échec. Le DT (filière maintenance ou électronique) garantit l'employabilité.
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              <Button variant="soft" size="sm" style={{ background: '#fff', color: 'var(--brand-700)' }}>Programmer RDV</Button>
              <Button variant="ghost" size="sm" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>Voir le dossier</Button>
            </div>
          </Card>

          <Card>
            <SubLabel>Critères DOB · barème pondéré</SubLabel>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              • <strong>40%</strong> · moyenne pondérée matières dominantes (T1+T2+T3)<br/>
              • <strong>20%</strong> · BEPC blanc (mars)<br/>
              • <strong>15%</strong> · vœux famille (1ᵉʳ · 2ᵉ · 3ᵉ)<br/>
              • <strong>15%</strong> · capacité d'accueil série<br/>
              • <strong>10%</strong> · avis conseil de classe
            </div>
          </Card>
        </div>
      </div>
    </DashShell>
  );
};

// ─── 5 · ORIENTATION · VUE ÉLÈVE (vœux & reco IA) ──────────
const OrientationStudent = () => (
  <DashShell role="ÉLÈVE" user="Aïcha Hounsou" nav={directorNav.slice(0, 8).map((n, i) => ({ ...n, active: i === 3 }))}>
    <PageTitle title="Mon orientation post-BEPC"
      sub="Choisis tes 3 vœux de série pour la 2nde · à remplir avant le 7 mai">
      <Badge variant="brand" icon="sparkle">IA t'aide</Badge>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
      <div>
        <Card style={{ background: 'linear-gradient(135deg, var(--success-700), var(--brand-700))', color: '#fff', border: 0, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 12 }}>
            <Icon name="sparkle" size={14}/> Recommandation EduPilot AI · pour toi
          </div>
          <div className="display" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>
            Série D · Biologie-Géologie
          </div>
          <p style={{ fontSize: 14, opacity: 0.92, lineHeight: 1.6, marginTop: 10 }}>
            Tu excelles en <strong>SVT (17/20)</strong>, <strong>Physique-Chimie (15,5)</strong> et tu aimes les sciences du vivant. C'est la série idéale pour viser un <strong>bac scientifique mention bien ou très-bien</strong>, et ensuite médecine, pharmacie, agronomie, vétérinaire.
          </p>
          <div style={{ display: 'flex', gap: 18, marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <div><div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Compatibilité</div><div className="display tabular" style={{ fontSize: 22, fontWeight: 700 }}>92%</div></div>
            <div><div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mention bac visée</div><div className="display tabular" style={{ fontSize: 22, fontWeight: 700 }}>Bien</div></div>
            <div><div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Places dispo</div><div className="display tabular" style={{ fontSize: 22, fontWeight: 700 }}>14 / 32</div></div>
          </div>
        </Card>

        <Card padding={0}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Tes 3 vœux · classés par préférence</h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Glisse-déposes pour réorganiser · tes parents valideront ensuite</p>
          </div>
          {[
            { rank: 1, s: 'D', t: 'Biologie-Géologie · bac scientifique', match: 92 },
            { rank: 2, s: 'C', t: 'Sciences & Mathématiques · bac scientifique', match: 78 },
            { rank: 3, s: 'A1', t: 'Lettres-Langues · bac littéraire', match: 54 },
          ].map((v, i) => {
            const c = SERIES_BJ[v.s].c;
            return (
              <div key={i} style={{ padding: '16px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="display tabular" style={{ fontSize: 32, fontWeight: 800, color: `var(--${c}-700)`, width: 36, textAlign: 'center' }}>{v.rank}</div>
                <div style={{ width: 64, height: 56, borderRadius: 14, background: `var(--${c}-100)`, display: 'grid', placeItems: 'center' }}>
                  <span className="display" style={{ fontSize: 22, fontWeight: 800, color: `var(--${c}-700)`, letterSpacing: '-0.02em' }}>{v.s}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Série {v.s} — {v.t}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Compatibilité IA · {v.match}%</div>
                  <div style={{ height: 4, background: 'var(--neutral-200)', borderRadius: 2, marginTop: 6, overflow: 'hidden', width: 200 }}>
                    <div style={{ height: '100%', width: v.match + '%', background: `var(--${c}-600)` }}/>
                  </div>
                </div>
                <Button variant="ghost" size="sm" icon="x"/>
              </div>
            );
          })}
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Pourquoi série D te correspond</SubLabel>
          <div style={{ marginTop: 10 }}>
            {[
              { s: 'SVT', v: 17, c: 'success' },
              { s: 'Physique-Chimie', v: 15.5, c: 'success' },
              { s: 'Mathématiques', v: 16.5, c: 'success' },
              { s: 'Français', v: 13.0, c: 'warning' },
              { s: 'Histoire-Géo', v: 14.5, c: 'info' },
            ].map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <span style={{ fontSize: 12, flex: 1 }}>{m.s}</span>
                <div style={{ height: 4, width: 80, background: 'var(--neutral-200)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (m.v / 20 * 100) + '%', background: `var(--${m.c}-500)` }}/>
                </div>
                <span className="display tabular" style={{ fontSize: 13, fontWeight: 700, width: 40, textAlign: 'right', color: `var(--${m.c}-700)` }}>{m.v.toFixed(1).replace('.', ',')}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SubLabel>Mentions du bac · barème DOB</SubLabel>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { m: 'Passable', r: '10,00 → 11,99', c: 'neutral' },
              { m: 'Assez Bien', r: '12,00 → 13,99', c: 'info' },
              { m: 'Bien', r: '14,00 → 15,99', c: 'success' },
              { m: 'Très Bien', r: '≥ 16,00', c: 'warning' },
            ].map(s => (
              <div key={s.m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, background: s.m === 'Bien' ? 'var(--success-50)' : 'transparent', border: s.m === 'Bien' ? '1px solid var(--success-200)' : '1px solid transparent' }}>
                <Badge variant={s.c} size="sm">{s.m}</Badge>
                <span className="tabular" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.r}</span>
                {s.m === 'Bien' && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: 'var(--success-700)' }}>← Ton objectif</span>}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SubLabel>Après le bac D · métiers possibles</SubLabel>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Médecin', 'Pharmacien', 'Vétérinaire', 'Sage-femme', 'Ingénieur agro', 'Biologiste', 'Kiné', 'Dentiste', 'Chercheur'].map(m => (
              <Badge key={m} variant="success" size="sm">{m}</Badge>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.55 }}>
            Études entre 4 et 9 ans après le bac · démarrage de carrière entre 22 et 27 ans.
          </p>
        </Card>

        <Button size="lg" full iconRight="arrowRight" style={{ background: 'var(--gradient-cta)' }}>Valider mes 3 vœux</Button>
        <Button variant="ghost" full size="sm" icon="sparkle">Discuter avec un conseiller</Button>
      </div>
    </div>
  </DashShell>
);

// ─── 6 · ORIENTATION CM2 → 6ᵉ (passage CEP) ─────────────────
const OrientationCEP = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="Passage CM2 → 6ᵉ · CEP 2026"
      sub="CM2-A · 32 élèves · session juin · cycle primaire MEMP"
      breadcrumb={['Pédagogie', 'Orientation', 'CM2 · CEP']}>
      <Button variant="secondary" icon="download">Liste candidats DEC-MEMP</Button>
      <Button icon="check">Inscrire au CEP</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Candidats CEP" value="32" icon="users" variant="brand"/>
      <MetricCard label="Taux réussite estimé" value="91" unit="%" trend={4} icon="check" variant="success"/>
      <MetricCard label='Mention "Bien" projetée' value="14" icon="trophy" variant="success"/>
      <MetricCard label="À renforcer" value="5" icon="warning" variant="warning"/>
      <MetricCard label="Inscriptions DEC envoyées" value="32/32" icon="check" variant="success"/>
    </div>

    <Card padding={20} style={{ marginBottom: 14 }}>
      <h3 className="display" style={{ fontSize: 16, margin: '0 0 12px' }}>Le cycle primaire & le CEP</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-700)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>1ᵉʳ cycle</div>
          <strong style={{ color: 'var(--text-primary)' }}>CI + CP</strong> — Apprentissage lecture, écriture, calcul.
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--info-700)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>2ᵉ cycle</div>
          <strong style={{ color: 'var(--text-primary)' }}>CE1 + CE2</strong> — Consolidation des fondamentaux.
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-700)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>3ᵉ cycle · CEP</div>
          <strong style={{ color: 'var(--text-primary)' }}>CM1 + CM2</strong> — Approfondissement & préparation au CEP (passage en 6ᵉ).
        </div>
      </div>
    </Card>

    <Card padding={0}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Pronostic CEP · CM2-A</h3>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ background: 'var(--surface-sunken)' }}>
          {['Élève', 'Moy. CM2', 'Lecture', 'Calcul', 'Dictée', 'Pronostic CEP', 'Recommandation'].map(h => (
            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {[
            { n: 'Mathieu Hounsou', m: 14.2, l: 16, c: 14, d: 13, p: 'Bien', pv: 'success', r: 'Apte 6ᵉ' },
            { n: 'Sarah Bossou', m: 16.5, l: 18, c: 17, d: 15, p: 'Très Bien', pv: 'success', r: 'Apte 6ᵉ' },
            { n: 'Jean Sossou', m: 12.0, l: 13, c: 11, d: 12, p: 'Passable', pv: 'info', r: 'Apte 6ᵉ' },
            { n: 'Léa Adjavon', m: 11.5, l: 11, c: 12, d: 11, p: 'Passable', pv: 'info', r: 'Soutien · vacances' },
            { n: 'Hervé Bio', m: 9.8, l: 9, c: 11, d: 8, p: 'Risque échec', pv: 'warning', r: 'Soutien intensif' },
            { n: 'Aïssatou Coffi', m: 8.2, l: 7, c: 9, d: 8, p: 'Échec probable', pv: 'danger', r: 'Redoublement conseillé' },
          ].map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={r.n} size="sm"/><span style={{ fontSize: 13, fontWeight: 600 }}>{r.n}</span>
              </td>
              <td style={{ padding: '12px 14px' }}>
                <span className="display tabular" style={{ fontSize: 14, fontWeight: 700, color: r.m >= 14 ? 'var(--success-700)' : r.m < 10 ? 'var(--danger-700)' : 'var(--text-primary)' }}>{r.m.toFixed(1).replace('.', ',')}</span>
              </td>
              {[r.l, r.c, r.d].map((v, j) => (
                <td key={j} style={{ padding: '12px 14px' }} className="tabular">{v}</td>
              ))}
              <td style={{ padding: '12px 14px' }}>
                <Badge variant={r.pv} size="sm">{r.p}</Badge>
              </td>
              <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-secondary)' }}>{r.r}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </DashShell>
);

Object.assign(window, { NotifParent, NotifTeacher, NotifStudent, OrientationPage, OrientationStudent, OrientationCEP, SERIES_BJ });
