// EduPilot — Operations: Discipline, Examens, Messagerie, LMS, Compétences, Gamification, Templates

// ─── 1 · DISCIPLINE ─────────────────────────────────────────
const DisciplinePage = () => (
  <DashShell role="SURVEILLANT" user="M. Coffi" nav={directorNav.map((n, i) => ({ ...n, active: i === 8 }))}>
    <PageTitle title="Discipline & comportement" sub="Suivi des sanctions, retards, manquements · semaine 8"
      breadcrumb={['Vie scolaire', 'Discipline']}>
      <Button variant="secondary" icon="download">Registre</Button>
      <Button icon="plus">Nouveau rapport</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Rapports semaine" value="18" trend={-22} icon="warning" variant="warning"/>
      <MetricCard label="En cours" value="5" icon="clock" variant="info"/>
      <MetricCard label="Conseil de discipline" value="1" icon="danger" variant="danger"/>
      <MetricCard label="Climat global" value="Bon" icon="check" variant="success"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '12px 18px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
          <Chip active>Tous</Chip>
          <Chip count={4}>Retards</Chip>
          <Chip count={8}>Comportement</Chip>
          <Chip count={3}>Tenue</Chip>
          <Chip count={2}>Tricherie</Chip>
          <Chip count={1}>Bagarre</Chip>
        </div>
        <div>
          {[
            { e: 'Koffi Dossou', c: '4ᵉ B', t: 'Bagarre cour récréation', tc: 'danger', s: 'Conseil de discipline convoqué', sv: 'danger', date: 'hier 10h45', by: 'M. Coffi' },
            { e: 'Serge Padonou', c: '3ᵉ A', t: 'Tricherie DST math', tc: 'warning', s: 'Avertissement écrit · 0/20', sv: 'warning', date: 'lundi', by: 'M. Adjavon' },
            { e: 'Pierre Akin', c: '4ᵉ B', t: 'Retard répété (4ᵉ fois)', tc: 'info', s: 'Mot dans carnet', sv: 'info', date: 'lundi', by: 'M. Coffi' },
            { e: 'Aminatou Coffi', c: '3ᵉ A', t: 'Tenue non conforme', tc: 'neutral', s: 'Rappel verbal', sv: 'success', date: 'vendredi', by: 'Mme Bio' },
            { e: 'Jean-Paul Bio', c: '6ᵉ C', t: 'Bavardages répétés', tc: 'neutral', s: 'Heure de retenue', sv: 'warning', date: 'jeudi', by: 'M. Hounsou' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 130px 110px', gap: 14, padding: '14px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0, alignItems: 'center' }}>
              <Avatar name={r.e} size="sm"/>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{r.e}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {r.c}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.t}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>par {r.by} · {r.date}</div>
              </div>
              <Badge variant={r.sv} size="sm">{r.s.split(' ·')[0]}</Badge>
              <Button variant="ghost" size="sm" iconRight="arrowRight">Détail</Button>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Évolution sur 8 semaines</SubLabel>
          <Sparkline data={[24, 26, 22, 28, 19, 25, 23, 18]} color="var(--warning-600)" height={56}/>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>S1 → S8 · rapports / semaine</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--success-700)', fontWeight: 600 }}>
            <Icon name="arrowDown" size={12}/>−25% vs moyenne T1
          </div>
        </Card>
        <Card>
          <SubLabel>Top motifs · T2</SubLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {[
              { l: 'Bavardages', v: 42, c: 'warning' },
              { l: 'Retards', v: 28, c: 'info' },
              { l: 'Tenue', v: 18, c: 'neutral' },
              { l: 'Tricherie', v: 8, c: 'danger' },
              { l: 'Bagarre', v: 4, c: 'danger' },
            ].map(m => <Progress key={m.l} label={m.l} sublabel={m.v} value={m.v} variant={m.c}/>)}
          </div>
        </Card>
        <Card style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Icon name="sparkle" size={16} color="var(--brand-700)" style={{ marginTop: 2 }}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-900)' }}>Insight</div>
              <p style={{ fontSize: 12, color: 'var(--brand-800)', margin: '4px 0 0', lineHeight: 1.55 }}>
                Pic de bavardages en 6ᵉ C les jeudis après-midi. Suggestion : revoir l'enchaînement EPS → étude.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 2 · EXAMENS & DST ─────────────────────────────────────
const ExamsPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 4 }))}>
    <PageTitle title="Examens · Trimestre 2" sub="Composition · 5 jours · 12 salles · 28 enseignants surveillants"
      breadcrumb={['Pédagogie', 'Examens', 'Compositions T2']}>
      <Button variant="secondary" icon="download">Convocations PDF</Button>
      <Button icon="plus">Nouvelle épreuve</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Épreuves" value="42" icon="cards" variant="brand"/>
      <MetricCard label="Surveillants planifiés" value="28/30" icon="users" variant="success"/>
      <MetricCard label="Conflits salles" value="0" icon="check" variant="success"/>
      <MetricCard label="Anonymats prêts" value="100%" icon="check" variant="brand"/>
    </div>

    <Card padding={0}>
      <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Planning · semaine 12-16 mai</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <Chip active>Toutes les classes</Chip>
          <Chip>3ᵉ A</Chip>
          <Chip>3ᵉ B</Chip>
          <Chip>2nde C</Chip>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(5, 1fr)' }}>
        {/* Header row */}
        <div/>
        {['Lun 12', 'Mar 13', 'Mer 14', 'Jeu 15', 'Ven 16'].map((d, i) => (
          <div key={d} style={{ padding: '14px 12px', textAlign: 'center', borderLeft: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="display" style={{ fontSize: 14, fontWeight: 700 }}>{d}</div>
          </div>
        ))}
        {/* AM slot */}
        <div style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }} className="mono">08:00<br/>10:00</div>
        {[
          { s: 'Français', c: '3ᵉ A · 3ᵉ B', r: 'Salle 207-208', surv: 4, color: 'brand' },
          { s: 'Math', c: '3ᵉ A', r: 'Salle 207', surv: 2, color: 'info' },
          null,
          { s: 'Anglais', c: '3ᵉ A · 3ᵉ B', r: 'Salle 105', surv: 3, color: 'brand' },
          { s: 'SVT', c: '3ᵉ A', r: 'Labo', surv: 2, color: 'success' },
        ].map((e, i) => (
          <div key={i} style={{ padding: 8, borderLeft: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', minHeight: 90 }}>
            {e && (
              <div style={{ padding: 10, background: `var(--${e.color}-50)`, borderLeft: `3px solid var(--${e.color}-600)`, borderRadius: 8, height: '100%' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: `var(--${e.color}-900)` }}>{e.s}</div>
                <div style={{ fontSize: 10, color: `var(--${e.color}-800)`, marginTop: 4 }}>{e.c}</div>
                <div style={{ fontSize: 10, color: `var(--${e.color}-800)`, opacity: 0.7 }}>{e.r}</div>
                <div style={{ marginTop: 6, fontSize: 10, color: `var(--${e.color}-700)`, fontWeight: 600 }}>{e.surv} surv.</div>
              </div>
            )}
          </div>
        ))}
        {/* PM slot */}
        <div style={{ padding: '14px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }} className="mono">14:00<br/>16:00</div>
        {[
          { s: 'Histoire-Géo', c: '3ᵉ A', r: 'Salle 301', surv: 2, color: 'warning' },
          { s: 'Physique', c: '3ᵉ A', r: 'Labo', surv: 2, color: 'info' },
          { s: 'EPS', c: '3ᵉ A', r: 'Terrain', surv: 1, color: 'success' },
          null,
          { s: 'Brevet blanc', c: '3ᵉ A · 3ᵉ B · 3ᵉ C', r: 'Gymnase', surv: 8, color: 'danger' },
        ].map((e, i) => (
          <div key={i} style={{ padding: 8, borderLeft: '1px solid var(--border-subtle)', minHeight: 90 }}>
            {e && (
              <div style={{ padding: 10, background: `var(--${e.color}-50)`, borderLeft: `3px solid var(--${e.color}-600)`, borderRadius: 8, height: '100%' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: `var(--${e.color}-900)` }}>{e.s}</div>
                <div style={{ fontSize: 10, color: `var(--${e.color}-800)`, marginTop: 4 }}>{e.c}</div>
                <div style={{ fontSize: 10, color: `var(--${e.color}-800)`, opacity: 0.7 }}>{e.r}</div>
                <div style={{ marginTop: 6, fontSize: 10, color: `var(--${e.color}-700)`, fontWeight: 600 }}>{e.surv} surv.</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  </DashShell>
);

// ─── 3 · MESSAGERIE ────────────────────────────────────────
const MessagingPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 13 }))}>
    <PageTitle title="Messagerie" sub="Conversations internes · parents · enseignants · 12 non lus"
      breadcrumb={['Communication', 'Messagerie']}>
      <Button icon="plus">Nouveau message</Button>
    </PageTitle>

    <Card padding={0} style={{ height: 620, display: 'grid', gridTemplateColumns: '280px 1fr 280px' }}>
      {/* Conversation list */}
      <div style={{ borderRight: '1px solid var(--border-subtle)', overflow: 'auto' }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border-subtle)' }}>
          <Input icon="search" placeholder="Rechercher…"/>
        </div>
        {[
          { n: 'M. Adjavon', last: 'Bulletins prêts pour 3ᵉ A', t: '2 min', unread: 2, active: true },
          { n: 'Mme Sossou (Infirmerie)', last: 'Marie Bossou : suivi 24h OK', t: '14 min', unread: 1 },
          { n: 'Famille Hounsou', last: 'Question sur le DST math…', t: '1h' },
          { n: 'Mme Bio (Comptabilité)', last: 'Recouvrement T2 à jour ✓', t: '3h' },
          { n: 'Groupe · enseignants 6ᵉ', last: 'Conseil demain 16h confirmé', t: 'hier', unread: 1 },
          { n: 'M. Patrick (Famille Sossou)', last: 'Merci pour le bulletin', t: 'hier' },
          { n: 'Mme Coffi (Bibliothèque)', last: 'Inventaire annuel prévu', t: '2j' },
          { n: 'Famille Bossou', last: 'Confirmé le rdv vendredi', t: '3j' },
        ].map((c, i) => (
          <div key={i} style={{
            padding: 14, borderBottom: '1px solid var(--border-subtle)',
            background: c.active ? 'var(--brand-50)' : 'transparent',
            cursor: 'pointer', display: 'flex', gap: 12,
          }}>
            <Avatar name={c.n} size="md"/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: c.unread ? 700 : 500, color: 'var(--text-primary)' }}>{c.n}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{c.t}</span>
              </div>
              <div style={{ fontSize: 11, color: c.unread ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: c.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{c.last}</div>
            </div>
            {c.unread && <span style={{ width: 18, height: 18, borderRadius: 9, background: 'var(--brand-600)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{c.unread}</span>}
          </div>
        ))}
      </div>

      {/* Active thread */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name="M. Adjavon" size="sm" status="online"/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>M. Paul Adjavon</div>
            <div style={{ fontSize: 11, color: 'var(--success-700)' }}>En ligne · Prof. Math 3ᵉ A</div>
          </div>
          <Button variant="ghost" size="sm" icon="sms"/>
          <Button variant="ghost" size="sm" icon="info"/>
        </div>
        <div style={{ flex: 1, padding: 20, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-page)' }}>
          <div style={{ alignSelf: 'center', padding: '4px 12px', borderRadius: 12, background: 'var(--surface-card)', fontSize: 10, color: 'var(--text-tertiary)' }}>Aujourd'hui · 8 mai</div>
          {[
            { from: 'them', t: 'Bonjour, j\'ai fini la saisie des notes du DST. 24/26 saisies, 2 absents (Koffi, Jean-Paul).', time: '9h12' },
            { from: 'me', t: 'Parfait, merci ! Pour les 2 absents, justificatifs reçus ?', time: '9h15' },
            { from: 'them', t: 'Koffi : médecin (vu hier par Mme Sossou). Jean-Paul : aucun signe.', time: '9h18' },
            { from: 'me', t: 'OK, je lance un SMS aux parents de Jean-Paul.', time: '9h19' },
            { from: 'them', t: 'Top. Aussi : bulletins 3ᵉ A prêts pour validation conseil de jeudi.', time: '9h21' },
          ].map((m, i) => (
            <div key={i} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', display: 'flex', gap: 8, maxWidth: '70%' }}>
              {m.from === 'them' && <Avatar name="M. Adjavon" size="xs"/>}
              <div>
                <div style={{
                  padding: '10px 14px',
                  background: m.from === 'me' ? 'var(--brand-600)' : 'var(--surface-card)',
                  color: m.from === 'me' ? '#fff' : 'var(--text-primary)',
                  borderRadius: 14,
                  borderBottomRightRadius: m.from === 'me' ? 4 : 14,
                  borderBottomLeftRadius: m.from === 'them' ? 4 : 14,
                  fontSize: 13, lineHeight: 1.5,
                  boxShadow: m.from === 'them' ? 'var(--shadow-sm)' : 'none',
                }}>{m.t}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4, textAlign: m.from === 'me' ? 'right' : 'left' }}>{m.time} {m.from === 'me' && '· lu'}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="ghost" size="sm" icon="plus"/>
          <Input placeholder="Écrire un message…" style={{ flex: 1 }}/>
          <Button icon="arrowRight" size="md"/>
        </div>
      </div>

      {/* Right context */}
      <div style={{ borderLeft: '1px solid var(--border-subtle)', padding: 16, overflow: 'auto' }}>
        <Avatar name="M. Adjavon" size="xl" style={{ margin: '0 auto', display: 'block', width: 72, height: 72 }}/>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div className="display" style={{ fontSize: 16, fontWeight: 700 }}>M. Paul Adjavon</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Enseignant Math · 3ᵉ A, 4ᵉ B, 6ᵉ C</div>
        </div>
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border-subtle)' }}>
          <SubLabel>Contact</SubLabel>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>📧 p.adjavon@cbe.bj</div>
            <div>📱 +229 97 22 11 30</div>
            <div>🏢 Salle des profs · bureau 4</div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <SubLabel>Fichiers partagés · 3</SubLabel>
          {[
            { n: 'DST_math_T2_corrige.pdf', s: '2.4 MB' },
            { n: 'Bulletins_3eA_T2.zip', s: '8.1 MB' },
            { n: 'Progression_algebre.xlsx', s: '0.4 MB' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 0, fontSize: 12 }}>
              <Icon name="cards" size={14} color="var(--brand-700)"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{f.n}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{f.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  </DashShell>
);

// ─── 4 · LMS · DEVOIRS ─────────────────────────────────────
const LMSPage = () => (
  <DashShell role="ENSEIGNANT" user="M. Adjavon" nav={directorNav.map((n, i) => ({ ...n, active: i === 3 }))}>
    <PageTitle title="Devoirs & ressources" sub="3ᵉ A · Mathématiques · 12 devoirs publiés ce trimestre"
      breadcrumb={['Pédagogie', 'LMS', '3ᵉ A · Math']}>
      <Button variant="secondary" icon="cards">Bibliothèque ressources</Button>
      <Button icon="plus">Nouveau devoir</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '12px 18px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)' }}>
          <Chip active>En cours</Chip>
          <Chip count={3}>Publiés</Chip>
          <Chip count={8}>Notés</Chip>
          <Chip>Brouillons</Chip>
        </div>
        {[
          { t: 'Exercices fonctions affines · chapitre 7', due: 'Dans 2 jours', stat: '18/26 rendus', a: 'brand', dv: 'warning' },
          { t: 'DM · théorème de Thalès', due: 'Dans 5 jours', stat: '6/26 rendus', a: 'info', dv: 'info' },
          { t: 'Préparation Brevet blanc · annales', due: 'Dans 1 semaine', stat: 'À ouvrir', a: 'neutral', dv: 'neutral' },
        ].map((d, i) => (
          <div key={i} style={{ padding: '16px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{d.t}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Publié il y a 5 jours · M. Adjavon</div>
              </div>
              <Badge variant={d.dv} size="sm" icon="clock">{d.due}</Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Progress value={i === 0 ? 69 : i === 1 ? 23 : 0} variant={d.a} label={null} sublabel={null}/>
              <span className="tabular" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{d.stat}</span>
              <Button variant="secondary" size="sm" iconRight="arrowRight">Voir</Button>
            </div>
          </div>
        ))}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Activité élèves · 7 jours</SubLabel>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span className="display tabular" style={{ fontSize: 32, fontWeight: 700 }}>184</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>connexions · 22/26 élèves actifs</span>
          </div>
          <Sparkline data={[18, 22, 28, 24, 32, 30, 30]} color="var(--brand-700)" height={48}/>
        </Card>
        <Card>
          <SubLabel>Ressources les plus consultées</SubLabel>
          {[
            { n: 'Vidéo · Thalès expliqué (4 min)', v: 64, c: 'info' },
            { n: 'PDF · Fiche méthode fonctions', v: 52, c: 'success' },
            { n: 'Exercices interactifs · GeoGebra', v: 41, c: 'brand' },
            { n: 'Annales Brevet 2024 corrigées', v: 28, c: 'warning' },
          ].map((r, i) => (
            <div key={i} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{r.n}</span>
                <span className="tabular" style={{ fontSize: 12, fontWeight: 700, color: `var(--${r.c}-700)` }}>{r.v}</span>
              </div>
              <div style={{ height: 3, background: 'var(--neutral-200)', borderRadius: 1.5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (r.v / 70 * 100) + '%', background: `var(--${r.c}-500)` }}/>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 5 · ÉVALUATIONS PAR COMPÉTENCES ────────────────────────
const CompetencesPage = () => (
  <DashShell role="ENSEIGNANT" user="M. Adjavon" nav={directorNav.map((n, i) => ({ ...n, active: i === 4 }))}>
    <PageTitle title="Évaluations par compétences" sub="3ᵉ A · Mathématiques · grille MEMP"
      breadcrumb={['Pédagogie', 'Compétences', '3ᵉ A · Math']}>
      <Button variant="secondary" icon="download">Bilan PDF</Button>
      <Button icon="plus">Évaluer</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(4, 1fr)', gap: 0, fontSize: 12, background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ padding: '12px 18px', background: 'var(--surface-sunken)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Compétence</div>
      {['Acquis', 'En cours d\'acquisition', 'Non acquis', 'Non évalué'].map((h, i) => (
        <div key={h} style={{ padding: '12px 14px', background: 'var(--surface-sunken)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: ['var(--success-700)', 'var(--warning-700)', 'var(--danger-700)', 'var(--text-tertiary)'][i], textAlign: 'center', borderLeft: '1px solid var(--border-subtle)' }}>{h}</div>
      ))}

      {[
        { c: 'C1 · Chercher · résoudre un problème', v: [18, 6, 2, 0] },
        { c: 'C2 · Modéliser · traduire une situation', v: [12, 10, 4, 0] },
        { c: 'C3 · Représenter · figures, graphiques', v: [20, 4, 2, 0] },
        { c: 'C4 · Raisonner · démontrer', v: [8, 12, 6, 0] },
        { c: 'C5 · Calculer · technique opératoire', v: [16, 8, 2, 0] },
        { c: 'C6 · Communiquer · expression', v: [14, 10, 2, 0] },
      ].map((row, ri) => (
        <React.Fragment key={ri}>
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-subtle)', fontSize: 13, fontWeight: 600 }}>{row.c}</div>
          {row.v.map((n, vi) => {
            const colors = ['success', 'warning', 'danger', 'neutral'];
            const c = colors[vi];
            const pct = n / 26;
            return (
              <div key={vi} style={{ padding: '14px 14px', borderTop: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 44, height: 44, borderRadius: 12,
                  background: `oklch(0.96 0.06 var(--${c}-hue, 0) / ${pct})`,
                  color: `var(--${c}-800)`,
                  border: `1px solid var(--${c}-200)`,
                }} className="display tabular">
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{n}</span>
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>

    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      <Card>
        <SubLabel>Compétences solides (>70% acquis)</SubLabel>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--success-700)', fontWeight: 600 }}>C1, C3, C5, C6</div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>La classe maîtrise bien représentation, calcul et expression.</p>
      </Card>
      <Card>
        <SubLabel>À renforcer</SubLabel>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--warning-700)', fontWeight: 600 }}>C2 · Modélisation</div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>Travailler la traduction de situations réelles en équations.</p>
      </Card>
      <Card style={{ background: 'var(--danger-50)', border: '1px solid var(--danger-200)' }}>
        <SubLabel>Priorité absolue</SubLabel>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--danger-700)', fontWeight: 600 }}>C4 · Raisonnement / démonstration</div>
        <p style={{ fontSize: 12, color: 'var(--danger-800)', marginTop: 6 }}>6 élèves non-acquis. Séance ciblée recommandée avant Brevet.</p>
      </Card>
    </div>
  </DashShell>
);

// ─── 6 · GAMIFICATION (full) ────────────────────────────────
const GamificationPage = () => (
  <DashShell role="ÉLÈVE" user="Aïcha Hounsou" nav={directorNav.slice(0, 8).map((n, i) => ({ ...n, active: i === 7 }))}>
    <PageTitle title="Mes badges & classement"
      sub="Gagne des badges en restant régulière, en atteignant tes objectifs et en aidant tes camarades.">
      <Badge variant="warning" icon="flame">14 jours · série</Badge>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <h3 className="display" style={{ fontSize: 16, margin: '0 0 14px' }}>Mes 12 badges obtenus</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
            {[
              { i: 'trophy', l: 'Top 5', c: 'warning', date: '3j', rare: 'Or' },
              { i: 'flame', l: 'Série 14j', c: 'danger', date: 'aujourd\'hui', rare: 'Argent' },
              { i: 'sparkle', l: 'IA Pro', c: 'brand', date: '1 sem.', rare: 'Argent' },
              { i: 'check', l: '100% devoirs', c: 'success', date: '2 sem.', rare: 'Or' },
              { i: 'book', l: 'Lectrice', c: 'info', date: '1 mois', rare: 'Bronze' },
              { i: 'pencil', l: 'Plume d\'or', c: 'success', date: '2 mois', rare: 'Argent' },
              { i: 'chart', l: '+1 pt/sem', c: 'brand', date: '3 mois', rare: 'Bronze' },
              { i: 'users', l: 'Tutrice', c: 'success', date: '4 mois', rare: 'Argent' },
              { i: 'school', l: '1 an', c: 'warning', date: '5 mois', rare: 'Or' },
              { i: 'sms', l: 'Polyglotte', c: 'info', date: '6 mois', rare: 'Bronze' },
              { i: 'calendar', l: '0 absence T1', c: 'success', date: '7 mois', rare: 'Or' },
              { i: 'sparkle', l: 'Boursière', c: 'brand', date: '1 an', rare: 'Platine' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: `var(--${b.c}-100)`, border: `2px solid var(--${b.c}-300)`, display: 'grid', placeItems: 'center' }}>
                    <Icon name={b.i} size={26} color={`var(--${b.c}-700)`}/>
                  </div>
                  <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: b.rare === 'Or' || b.rare === 'Platine' ? 'var(--warning-500)' : 'var(--neutral-700)', color: '#fff' }}>{b.rare}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center' }}>{b.l}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>il y a {b.date}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Prochains défis</h3>
            <Badge variant="brand" icon="sparkle">+3 badges possibles</Badge>
          </div>
          {[
            { t: 'Atteindre 16 de moyenne au T2', p: 92, sub: 'Plus que 0,3 pts ! Tu es à 14,8 actuellement.', c: 'success' },
            { t: 'Lire 5 livres ce trimestre', p: 60, sub: '3/5 livres lus · prochain : "Une si longue lettre"', c: 'info' },
            { t: 'Aider 3 camarades en math', p: 33, sub: '1/3 séances de tutorat enregistrées', c: 'brand' },
          ].map((c, i) => (
            <div key={i} style={{ padding: '12px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.t}</span>
                <span className="tabular" style={{ fontSize: 12, fontWeight: 700, color: `var(--${c.c}-700)` }}>{c.p}%</span>
              </div>
              <Progress value={c.p} variant={c.c}/>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{c.sub}</div>
            </div>
          ))}
        </Card>
      </div>

      <Card>
        <SubLabel>Classement · 3ᵉ A · T2</SubLabel>
        <div style={{ marginTop: 8 }}>
          {[
            { r: 1, n: 'Marie Bossou', v: 18.0, badges: 18 },
            { r: 2, n: 'Yvette Adissi', v: 16.5, badges: 14 },
            { r: 3, n: 'Aminatou Coffi', v: 15.5, badges: 11 },
            { r: 4, n: 'Aïcha Hounsou', v: 14.8, badges: 12, me: true },
            { r: 5, n: 'Fatou Adjavon', v: 14.6, badges: 9 },
            { r: 6, n: 'Lucie Houngbedji', v: 14.5, badges: 8 },
            { r: 7, n: 'Pierre Akin', v: 12.8, badges: 5 },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px',
              background: s.me ? 'var(--brand-50)' : 'transparent', borderRadius: 8,
              border: s.me ? '1px solid var(--brand-200)' : '1px solid transparent',
              marginBottom: 4,
            }}>
              <span className="display tabular" style={{ width: 22, fontSize: 16, fontWeight: 700, textAlign: 'center', color: s.r <= 3 ? 'var(--warning-700)' : 'var(--text-tertiary)' }}>
                {s.r === 1 ? '🥇' : s.r === 2 ? '🥈' : s.r === 3 ? '🥉' : s.r}
              </span>
              <Avatar name={s.n} size="sm"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: s.me ? 700 : 600 }}>{s.n}{s.me && ' · toi'}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.badges} badges</div>
              </div>
              <span className="display tabular" style={{ fontSize: 14, fontWeight: 700, color: s.v >= 14 ? 'var(--success-700)' : 'var(--text-primary)' }}>{s.v.toFixed(1).replace('.', ',')}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </DashShell>
);

// ─── 7 · EMAIL / SMS TEMPLATES ──────────────────────────────
const TemplatesPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 13 }))}>
    <PageTitle title="Modèles de communication" sub="Email · SMS · WhatsApp · pré-écrits, personnalisés par l'IA"
      breadcrumb={['Communication', 'Modèles']}>
      <Button icon="plus">Nouveau modèle</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14, height: 580 }}>
      <Card padding={0}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border-subtle)' }}>
          <Input icon="search" placeholder="Rechercher un modèle…"/>
        </div>
        {[
          { c: 'Pédagogie', items: ['Bulletin disponible', 'Conseil de classe', 'Convocation Brevet', 'Sortie pédagogique'] },
          { c: 'Vie scolaire', items: ['Absence non justifiée', 'Retards répétés', 'Incident médical'] },
          { c: 'Finance', items: ['Rappel échéance T2', 'Confirmation paiement', 'Échéancier proposé'], active: 0 },
          { c: 'Administration', items: ['Inscription validée', 'Documents manquants'] },
        ].map((cat, ci) => (
          <div key={ci}>
            <div style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', background: 'var(--surface-sunken)' }}>{cat.c}</div>
            {cat.items.map((it, i) => (
              <div key={i} style={{
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
                background: cat.active === i ? 'var(--brand-50)' : 'transparent',
                borderLeft: cat.active === i ? '3px solid var(--brand-700)' : '3px solid transparent',
                cursor: 'pointer',
              }}>
                <Icon name="sms" size={14} color="var(--text-tertiary)"/>
                <span style={{ fontSize: 13, fontWeight: cat.active === i ? 700 : 500, color: cat.active === i ? 'var(--brand-900)' : 'var(--text-primary)' }}>{it}</span>
              </div>
            ))}
          </div>
        ))}
      </Card>

      <Card padding={0} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Rappel échéance T2</h3>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Multi-canaux · auto-déclenché 7j avant échéance</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Badge variant="success" size="sm" dot>Actif</Badge>
            <Button variant="ghost" size="sm" icon="sparkle">Reformuler (IA)</Button>
            <Button size="sm" icon="check">Enregistrer</Button>
          </div>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
          <div>
            <SubLabel>SMS · 160 caractères</SubLabel>
            <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 12, fontSize: 13, lineHeight: 1.55, marginTop: 8, fontFamily: 'var(--font-body)' }}>
              Bonjour <span style={{ background: 'var(--brand-100)', padding: '0 4px', borderRadius: 3, color: 'var(--brand-800)', fontWeight: 700 }}>{'{parent.prenom}'}</span>, le paiement de scolarité de <span style={{ background: 'var(--brand-100)', padding: '0 4px', borderRadius: 3, color: 'var(--brand-800)', fontWeight: 700 }}>{'{eleve.prenom}'}</span> arrive à échéance le <span style={{ background: 'var(--brand-100)', padding: '0 4px', borderRadius: 3, color: 'var(--brand-800)', fontWeight: 700 }}>{'{echeance.date}'}</span> (<span style={{ background: 'var(--brand-100)', padding: '0 4px', borderRadius: 3, color: 'var(--brand-800)', fontWeight: 700 }}>{'{montant}'}</span> FCFA). Payez en ligne : <span style={{ background: 'var(--brand-100)', padding: '0 4px', borderRadius: 3, color: 'var(--brand-800)', fontWeight: 700 }}>{'{lien.paiement}'}</span> — CBE.
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>148 / 160 caractères · 1 SMS</div>
            <div style={{ marginTop: 18 }}>
              <SubLabel>Variables disponibles</SubLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {['{parent.prenom}', '{eleve.prenom}', '{eleve.classe}', '{montant}', '{echeance.date}', '{ecole.nom}', '{lien.paiement}'].map(v => (
                  <span key={v} className="mono" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'var(--brand-50)', color: 'var(--brand-800)', border: '1px solid var(--brand-200)' }}>{v}</span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <SubLabel>Aperçu · téléphone parent</SubLabel>
            <div style={{ marginTop: 8, padding: 16, background: 'var(--neutral-900)', borderRadius: 22, position: 'relative' }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 14, fontSize: 13, lineHeight: 1.55, color: '#0F172A' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>CBE · il y a 2 min</div>
                Bonjour Patrick, le paiement de scolarité de Aïcha arrive à échéance le 11 mai (125 000 FCFA). Payez en ligne : edupilot.bj/p/A0142 — CBE.
              </div>
            </div>
            <div style={{ marginTop: 18, padding: 14, background: 'var(--success-50)', borderRadius: 10, fontSize: 12, color: 'var(--success-800)', lineHeight: 1.55 }}>
              <strong>Performance historique</strong><br/>
              Ce modèle a été envoyé 287 fois ce trimestre. 94% lus, 38% de paiement dans les 48h.
            </div>
          </div>
        </div>
      </Card>
    </div>
  </DashShell>
);

Object.assign(window, {
  DisciplinePage, ExamsPage, MessagingPage, LMSPage,
  CompetencesPage, GamificationPage, TemplatesPage,
});
