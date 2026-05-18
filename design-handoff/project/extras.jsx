// EduPilot — Pages supplémentaires :
// Calendrier global, Cahier de liaison, Mon compte, Transport scolaire

// ─── 1 · CALENDRIER GLOBAL ÉTABLISSEMENT ────────────────────
const CalendarPage = () => {
  const months = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const events = {
    '5': { type: 'success', count: 2 },
    '7': { type: 'brand', count: 1, label: 'Conseil 3ᵉ A' },
    '8': { type: 'warning', count: 3 },
    '10': { type: 'info', count: 1, label: 'Réunion parents' },
    '11': { type: 'danger', count: 1, label: 'Échéance T2' },
    '12': { type: 'warning', count: 2 },
    '13': { type: 'warning', count: 2 },
    '14': { type: 'warning', count: 2 },
    '15': { type: 'warning', count: 4, label: 'Brevet blanc' },
    '16': { type: 'warning', count: 4 },
    '20': { type: 'success', count: 1 },
    '22': { type: 'success', count: 1, label: 'Sortie CE2' },
    '28': { type: 'brand', count: 1 },
  };
  return (
    <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
      <PageTitle title="Calendrier · mai 2026" sub="42 événements ce mois · examens, conseils, sorties, échéances"
        breadcrumb={['Pilotage', 'Calendrier']}>
        <Button variant="secondary" icon="download">iCal · Google Cal</Button>
        <Button icon="plus">Nouvel événement</Button>
      </PageTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, height: 'calc(100% - 100px)' }}>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          {/* Calendar header */}
          <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Button variant="ghost" size="sm" icon="chevron" style={{ transform: 'rotate(180deg)' }}/>
              <h3 className="display" style={{ fontSize: 18, margin: 0, letterSpacing: '-0.02em' }}>Mai 2026</h3>
              <Button variant="ghost" size="sm" icon="chevron"/>
              <Button variant="ghost" size="sm">Aujourd'hui</Button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip>Jour</Chip>
              <Chip>Semaine</Chip>
              <Chip active>Mois</Chip>
              <Chip>Année</Chip>
            </div>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-subtle)' }}>
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
              <div key={d} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', borderLeft: '1px solid var(--border-subtle)' }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', flex: 1 }}>
            {Array.from({ length: 35 }, (_, i) => {
              const dayNum = i - 3; // May 2026 starts on Friday → padding 4 cells
              const isCurrentMonth = dayNum >= 1 && dayNum <= 31;
              const isToday = dayNum === 5;
              const ev = events[String(dayNum)];
              return (
                <div key={i} style={{
                  borderTop: '1px solid var(--border-subtle)',
                  borderLeft: '1px solid var(--border-subtle)',
                  padding: 8, minHeight: 90,
                  background: isToday ? 'var(--brand-50)' : isCurrentMonth ? 'transparent' : 'var(--surface-sunken)',
                  opacity: isCurrentMonth ? 1 : 0.4,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
                  }}>
                    <span className="tabular" style={{
                      fontSize: 12, fontWeight: isToday ? 800 : 500,
                      color: isToday ? 'var(--brand-700)' : 'var(--text-primary)',
                      width: 22, height: 22, borderRadius: 11,
                      background: isToday ? '#fff' : 'transparent', display: 'grid', placeItems: 'center',
                      boxShadow: isToday ? 'var(--shadow-sm)' : 'none',
                    }}>{isCurrentMonth ? dayNum : ''}</span>
                    {ev && <span style={{ width: 6, height: 6, borderRadius: 3, background: `var(--${ev.type}-500)` }}/>}
                  </div>
                  {ev?.label && (
                    <div style={{
                      fontSize: 10, fontWeight: 600,
                      padding: '3px 6px', borderRadius: 4,
                      background: `var(--${ev.type}-50)`, color: `var(--${ev.type}-800)`,
                      borderLeft: `2px solid var(--${ev.type}-500)`,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{ev.label}</div>
                  )}
                  {ev?.count > 1 && (
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 600 }}>+{ev.count - (ev.label ? 1 : 0)} autres</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right: events list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          <Card padding={14}>
            <SubLabel>Filtres</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, fontSize: 12 }}>
              {[
                { c: 'brand', l: 'Conseils & réunions', n: 4 },
                { c: 'warning', l: 'Examens & DST', n: 8 },
                { c: 'danger', l: 'Échéances finance', n: 2 },
                { c: 'success', l: 'Sorties pédagogiques', n: 3 },
                { c: 'info', l: 'Événements parents', n: 4 },
              ].map(f => (
                <label key={f.l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" defaultChecked/>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--${f.c}-500)` }}/>
                  <span style={{ flex: 1 }}>{f.l}</span>
                  <span className="tabular" style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700 }}>{f.n}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card padding={0}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="display" style={{ fontSize: 15, margin: 0 }}>À venir · 5 jours</h3>
            </div>
            {[
              { d: 'Jeu 7', t: '16:00 · Conseil de classe 3ᵉ A', c: 'brand', sub: '14/16 enseignants confirmés' },
              { d: 'Ven 8', t: '17:00 · Échéance saisie notes T2', c: 'warning', sub: '24 enseignants concernés' },
              { d: 'Sam 10', t: '09:00 · Réunion parents 6ᵉ-CM1', c: 'info', sub: '142 inscriptions' },
              { d: 'Dim 11', t: 'Toute la journée · Échéance paiement T2', c: 'danger', sub: '14 dossiers en retard' },
              { d: 'Lun 12', t: '08:00 · Composition Français', c: 'warning', sub: '3ᵉ A + 3ᵉ B · salle 207-208' },
            ].map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
                <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{e.d.split(' ')[0]}</div>
                  <div className="display tabular" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: `var(--${e.c}-700)` }}>{e.d.split(' ')[1]}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{e.t}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{e.sub}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </DashShell>
  );
};

// ─── 2 · CAHIER DE LIAISON (digital) ────────────────────────
const LiaisonBook = () => (
  <DashShell role="PARENT" user="Patrick Hounsou" nav={[
    { icon: 'home', label: 'Accueil' },
    { icon: 'users', label: 'Mes enfants', count: 2 },
    { icon: 'money', label: 'Paiements', count: 1 },
    { icon: 'calendar', label: 'Emploi du temps' },
    { icon: 'book', label: 'Cahier de liaison', count: 3, active: true },
    { icon: 'bell', label: 'Notifications', count: 5 },
    { icon: 'sms', label: 'Messagerie école' },
  ]}>
    <PageTitle title="Cahier de liaison · Aïcha Hounsou"
      sub="3ᵉ A · 12 entrées ce trimestre · 3 nécessitent ta signature"
      breadcrumb={['Mes enfants', 'Aïcha Hounsou', 'Cahier de liaison']}>
      <Button variant="secondary" icon="users">Voir cahier de Mathieu</Button>
      <Button icon="pencil">Mot au professeur</Button>
    </PageTitle>

    {/* Hero: à signer */}
    <Card padding={20} style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-200)', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--warning-600)', display: 'grid', placeItems: 'center' }}>
          <Icon name="pencil" size={22} color="#fff"/>
        </div>
        <div style={{ flex: 1 }}>
          <div className="display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning-900)' }}>3 mots à signer</div>
          <div style={{ fontSize: 13, color: 'var(--warning-800)' }}>Signature numérique · rapide · enregistré dans le journal d'audit MEMP</div>
        </div>
        <Button style={{ background: 'var(--warning-600)' }} iconRight="arrowRight">Signer maintenant</Button>
      </div>
    </Card>

    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '12px 18px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)' }}>
          <Chip active>Tout</Chip>
          <Chip count={3}>À signer</Chip>
          <Chip>Mots du prof</Chip>
          <Chip>Mes mots</Chip>
          <Chip>Sorties · documents</Chip>
        </div>
        {/* Timeline */}
        <div>
          {[
            {
              from: 'M. Adjavon', role: 'Prof. Math', avatarColor: 'brand', date: 'aujourd\'hui · 14:32',
              type: 'comportement', t: 'Très bonne participation en algèbre',
              body: 'Aïcha a brillamment résolu le problème du jour au tableau. Elle aide aussi Pierre qui décroche un peu. Je le note pour ne pas l\'oublier.',
              tag: 'success', tagL: 'Félicitations', signed: true,
            },
            {
              from: 'Mme Akpovi', role: 'Directrice', avatarColor: 'danger', date: 'hier · 16:10',
              type: 'admin', t: 'Autorisation sortie scolaire',
              body: 'Sortie au Musée d\'Histoire de Ouidah · vendredi 16 mai · 8h-17h. Autorisation parentale requise. Frais 4 500 FCFA inclus dans la scolarité.',
              tag: 'warning', tagL: 'À signer', signed: false, action: 'Autoriser',
            },
            {
              from: 'Mme Bio', role: 'Prof. Français', avatarColor: 'info', date: '2 mai · 09:24',
              type: 'absence', t: 'Justification d\'absence — 28 avril',
              body: 'Aïcha n\'était pas en classe le 28 avril matin. Pouvez-vous indiquer le motif ? (Médecin, événement familial, autre…)',
              tag: 'warning', tagL: 'À signer', signed: false, action: 'Justifier',
            },
            {
              from: 'Mme Sossou', role: 'Infirmerie', avatarColor: 'warning', date: '30 avr · 11:15',
              type: 'sante', t: 'Passage infirmerie · mal de tête',
              body: 'Aïcha s\'est plaint d\'un mal de tête vers 10h. Repos infirmerie 30 minutes, eau, retour en classe. Aucun antidouleur administré.',
              tag: 'info', tagL: 'Information', signed: true,
            },
            {
              from: 'Patrick Hounsou', role: 'Vous', avatarColor: 'success', date: '28 avr · 20:45',
              type: 'mot-parent', t: 'Absence du 28 avril matin',
              body: 'Bonjour, Aïcha avait rendez-vous chez le médecin (asthme). Elle reprend cet après-midi. Merci de l\'excuser.',
              tag: 'neutral', tagL: 'Mot parent', signed: true, mine: true,
            },
            {
              from: 'M. Adjavon', role: 'Prof. Math', avatarColor: 'brand', date: '26 avr · 15:00',
              type: 'devoir', t: 'DM à rendre vendredi · théorème de Thalès',
              body: 'Exercices 12 à 18 page 84. Travail noté coef. 1. Aïcha peut consulter la vidéo du cours sur l\'espace LMS.',
              tag: 'info', tagL: 'Information', signed: true,
            },
          ].map((e, i) => (
            <div key={i} style={{
              padding: '14px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0,
              background: !e.signed ? 'var(--warning-50)' : 'transparent',
              display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 14, alignItems: 'flex-start',
            }}>
              <Avatar name={e.from} size="sm" color={e.mine ? 'var(--success-600)' : undefined}/>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{e.from}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {e.role}</span>
                  <Badge variant={e.tag} size="sm">{e.tagL}</Badge>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.t}</div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.55 }}>{e.body}</p>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  {e.date}{e.signed && ' · ✓ signé numériquement'}
                </div>
              </div>
              {!e.signed && e.action && <Button size="sm">{e.action}</Button>}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Aïcha · récap du mois</SubLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
            {[
              { l: 'Félicitations', v: 4, c: 'success' },
              { l: 'Vigilances', v: 1, c: 'warning' },
              { l: 'Documents', v: 3, c: 'info' },
              { l: 'Sanctions', v: 0, c: 'danger' },
            ].map(s => (
              <div key={s.l} style={{ padding: 10, background: `var(--${s.c}-50)`, borderRadius: 10 }}>
                <div className="display tabular" style={{ fontSize: 22, fontWeight: 700, color: `var(--${s.c}-700)` }}>{s.v}</div>
                <div style={{ fontSize: 10, color: `var(--${s.c}-800)`, fontWeight: 600 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SubLabel>Compose un mot</SubLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <select style={{ padding: '10px 14px', border: '1px solid var(--border-default)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface-card)' }}>
              <option>Pour : M. Adjavon (Prof. Math)</option>
              <option>Pour : Mme Bio (Prof. Français)</option>
              <option>Pour : Mme Akpovi (Direction)</option>
              <option>Pour : Mme Sossou (Infirmerie)</option>
            </select>
            <textarea placeholder="Écrire un mot…" rows={4} style={{
              padding: 12, border: '1px solid var(--border-default)', borderRadius: 10,
              fontSize: 13, fontFamily: 'inherit', resize: 'vertical', background: 'var(--surface-card)',
            }}/>
            <Button icon="sms" full>Envoyer · signé numériquement</Button>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 3 · MON COMPTE / PROFIL PERSONNEL ──────────────────────
const MyAccountPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="Mon compte" sub="Profil, sécurité, sessions, préférences personnelles"
      breadcrumb={['Mon compte']}/>

    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14 }}>
      <Card padding={10}>
        {['Profil', 'Sécurité & 2FA', 'Sessions actives', 'Notifications', 'Langue & région', 'Apparence', 'Confidentialité', 'Zone dangereuse'].map((t, i) => (
          <button key={t} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 10px', borderRadius: 8, border: 0,
            background: i === 0 ? 'var(--brand-50)' : 'transparent',
            color: i === 0 ? 'var(--brand-800)' : i === 7 ? 'var(--danger-700)' : 'var(--text-primary)',
            fontSize: 13, fontWeight: i === 0 ? 700 : 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{t}</button>
        ))}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card padding={28}>
          <h3 className="display" style={{ fontSize: 20, margin: '0 0 22px', letterSpacing: '-0.02em' }}>Profil</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Input label="Prénom" value="Marie"/>
                <Input label="Nom" value="Akpovi"/>
              </div>
              <Input label="Email" icon="sms" value="m.akpovi@cbe.bj"/>
              <Input label="Téléphone (WhatsApp)" icon="sms" value="+229 95 12 34 56"/>
              <Input label="Fonction" value="Directrice"/>
              <div style={{ marginTop: 6 }}>
                <SubLabel>Bio courte (apparaît sur les bulletins signés)</SubLabel>
                <textarea defaultValue="Directrice de l'établissement depuis 2018 — engagée pour une éducation rigoureuse et bienveillante." rows={3} style={{
                  width: '100%', padding: 12, border: '1px solid var(--border-default)', borderRadius: 10,
                  fontSize: 13, fontFamily: 'inherit', marginTop: 6, resize: 'vertical', background: 'var(--surface-card)',
                }}/>
              </div>
            </div>
            <div>
              <SubLabel>Photo de profil</SubLabel>
              <div style={{ marginTop: 8, padding: 18, border: '1px dashed var(--border-default)', borderRadius: 12, textAlign: 'center' }}>
                <Avatar name="Marie Akpovi" size="xl" style={{ width: 96, height: 96, margin: '0 auto 12px' }}/>
                <Button variant="secondary" size="sm">Modifier la photo</Button>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>JPG, PNG · 5 MB max · carrée</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost">Annuler</Button>
            <Button>Enregistrer</Button>
          </div>
        </Card>

        <Card padding={20}>
          <h3 className="display" style={{ fontSize: 16, margin: '0 0 14px', letterSpacing: '-0.02em' }}>Sessions actives · 3 appareils</h3>
          {[
            { i: 'school', d: 'MacBook Pro · Chrome', loc: 'Cotonou · 197.149.x.x', t: 'Maintenant', here: true },
            { i: 'users', d: 'iPhone 14 · App native', loc: 'Cotonou · 5G MTN', t: 'il y a 2h' },
            { i: 'cards', d: 'iPad · Safari', loc: 'Cotonou · WiFi école', t: 'hier · 18h22' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-sunken)', display: 'grid', placeItems: 'center' }}>
                <Icon name={s.i} size={16}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.d}{s.here && <Badge variant="success" size="sm" style={{ marginLeft: 8 }} dot>Cette session</Badge>}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.loc} · {s.t}</div>
              </div>
              {!s.here && <Button variant="ghost" size="sm">Déconnecter</Button>}
            </div>
          ))}
          <Button variant="danger" size="sm" icon="x" style={{ marginTop: 14 }}>Déconnecter tous les autres appareils</Button>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 4 · TRANSPORT SCOLAIRE ─────────────────────────────────
const TransportPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="Transport scolaire" sub="6 bus · 18 lignes · 412 élèves transportés · suivi GPS temps réel"
      breadcrumb={['Vie scolaire', 'Transport']}>
      <Button variant="secondary" icon="download">Liste passagers PDF</Button>
      <Button icon="plus">Nouvelle ligne</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Bus actifs" value="6/6" trend={null} icon="school" variant="success"/>
      <MetricCard label="Élèves transportés" value="412" trend={3.2} icon="users" variant="brand"/>
      <MetricCard label="Retards moy. matin" value="3,2" unit="min" trend={-22} icon="clock" variant="success"/>
      <MetricCard label="Incidents · semaine" value="0" icon="check" variant="success"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, height: 'calc(100% - 250px)' }}>
      {/* Map mock */}
      <Card padding={0} style={{ overflow: 'hidden', position: 'relative' }}>
        <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', zIndex: 2, position: 'relative', background: 'var(--surface-card)' }}>
          <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Suivi GPS · matin du mardi 5 mai</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip active>Tous</Chip>
            <Chip>Aller</Chip>
            <Chip>Retour</Chip>
          </div>
        </div>
        {/* Faux map */}
        <div style={{
          position: 'absolute', inset: '48px 0 0 0',
          background: `
            radial-gradient(circle at 30% 20%, rgba(16,185,129,0.10), transparent 40%),
            radial-gradient(circle at 70% 60%, rgba(245,158,11,0.10), transparent 40%),
            linear-gradient(135deg, #f0f7f5, #f3f6fc)`,
          overflow: 'hidden',
        }}>
          {/* Roads */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            <path d="M0 200 Q 200 150 400 230 T 800 250" stroke="rgba(15,23,42,0.12)" strokeWidth="6" fill="none"/>
            <path d="M100 0 Q 200 200 350 300 T 500 500" stroke="rgba(15,23,42,0.10)" strokeWidth="4" fill="none"/>
            <path d="M0 400 Q 250 380 500 430 T 800 410" stroke="rgba(15,23,42,0.10)" strokeWidth="5" fill="none"/>
            {/* School */}
            <circle cx="500" cy="280" r="14" fill="var(--brand-700)"/>
            <text x="500" y="285" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">🏫</text>
            <text x="500" y="310" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">CBE</text>
          </svg>
          {/* Bus markers */}
          {[
            { x: 200, y: 180, n: 'Bus 1', s: 'À l\'heure', c: 'success', stop: 'Akpakpa rue 7' },
            { x: 380, y: 100, n: 'Bus 2', s: '+3 min', c: 'warning', stop: 'Cadjèhoun' },
            { x: 620, y: 350, n: 'Bus 3', s: '+8 min', c: 'danger', stop: 'Fidjrossè' },
            { x: 280, y: 380, n: 'Bus 4', s: 'À l\'heure', c: 'success', stop: 'Tokpa-Hoho' },
            { x: 650, y: 180, n: 'Bus 5', s: '+1 min', c: 'success', stop: 'Cocotomey' },
            { x: 130, y: 320, n: 'Bus 6', s: '+5 min', c: 'warning', stop: 'Houenoussou' },
          ].map((b, i) => (
            <div key={i} style={{
              position: 'absolute', left: b.x, top: b.y,
              transform: 'translate(-50%, -100%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                padding: '6px 10px', borderRadius: 'var(--radius-pill)',
                background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)',
                fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: `var(--${b.c}-600)` }}/>
                {b.n} · {b.s}
              </div>
              <div style={{
                width: 16, height: 16, borderRadius: '50% 50% 50% 0',
                transform: 'rotate(-45deg)',
                background: `var(--${b.c}-600)`,
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}/>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={0} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Lignes · état temps réel</h3>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {[
            { n: '1', d: 'Akpakpa · 8 élèves', dr: 'M. Dossou', st: 'À l\'heure', c: 'success', sub: 'Arrivée 7h45 · arrivé 7h44' },
            { n: '2', d: 'Cadjèhoun · 12 élèves', dr: 'M. Sossou', st: '+3 min', c: 'warning', sub: 'Trafic Erevan' },
            { n: '3', d: 'Fidjrossè · 14 élèves', dr: 'M. Hounsou', st: '+8 min', c: 'danger', sub: 'Crevaison · dépannage en cours' },
            { n: '4', d: 'Tokpa-Hoho · 9 élèves', dr: 'M. Bio', st: 'À l\'heure', c: 'success', sub: 'Arrivée 7h50' },
            { n: '5', d: 'Cocotomey · 11 élèves', dr: 'Mme Adjavon', st: '+1 min', c: 'success', sub: 'Stop additionnel autorisé' },
            { n: '6', d: 'Houenoussou · 6 élèves', dr: 'M. Coffi', st: '+5 min', c: 'warning', sub: 'Pluie sur le trajet' },
          ].map((l, i) => (
            <div key={i} style={{ padding: '12px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `var(--${l.c}-100)`, color: `var(--${l.c}-800)`, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800 }}>{l.n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{l.d}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{l.dr} · {l.sub}</div>
              </div>
              <Badge variant={l.c} size="sm" dot>{l.st}</Badge>
            </div>
          ))}
        </div>
        <div style={{ padding: 14, borderTop: '1px solid var(--border-subtle)', background: 'var(--brand-50)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={14} color="var(--brand-700)" style={{ marginTop: 2 }}/>
          <div style={{ fontSize: 11, color: 'var(--brand-800)', lineHeight: 1.55 }}>
            <strong>SMS automatique</strong> envoyé aux 14 parents de Fidjrossè · arrivée bus #3 retardée de 8 min.
          </div>
        </div>
      </Card>
    </div>
  </DashShell>
);

Object.assign(window, { CalendarPage, LiaisonBook, MyAccountPage, TransportPage });

// Bonus : démo sidebar collapsed par défaut
const SidebarCollapsedDemo = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups} defaultCollapsed>
    <PageTitle title="Sidebar collapsée · mode rail 64px"
      sub="Clic sur le bouton flèche pour étendre · gain de 168px d'espace utile"
      breadcrumb={['Démos', 'Sidebar rail']}/>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Élèves actifs" value="1 248" trend={4.2} icon="users" variant="brand"/>
      <MetricCard label="Recouvrement" value="82" unit="%" trend={6.1} icon="money" variant="success"/>
      <MetricCard label="Présence sem." value="92,4" unit="%" trend={-1.3} icon="check" variant="info"/>
      <MetricCard label="Incidents" value="2" trend={-50} icon="warning" variant="warning"/>
    </div>
    <Card padding={28} style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
      <h3 className="display" style={{ fontSize: 20, margin: '0 0 10px' }}>Plus d'espace pour le contenu</h3>
      <p style={{ fontSize: 14, color: 'var(--brand-900)', margin: 0, lineHeight: 1.6 }}>
        En mode rail, seules les icônes sont visibles. Les compteurs (3 notifs, 14 finances…) restent en pastille rouge.
        Hover sur une icône affiche le tooltip avec le nom complet. Clic sur la flèche en haut → on étend à 232px.
        <br/><br/>
        Idéal pour les enseignants en saisie de notes, les surveillants en appel, ou tout écran où chaque pixel compte.
      </p>
    </Card>
  </DashShell>
);
window.SidebarCollapsedDemo = SidebarCollapsedDemo;
