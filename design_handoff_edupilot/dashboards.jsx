// EduPilot — 5 role dashboards (desktop)

const SidebarContext = React.createContext({ collapsed: false, toggle: () => {} });

const NavGroup = ({ label, children, collapsed }) => (
  <div style={{ marginBottom: 6 }}>
    {!collapsed && label && (
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '10px 12px 6px' }}>{label}</div>
    )}
    {collapsed && label && (
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 12px' }}/>
    )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
  </div>
);

const RailNavItem = ({ icon, label, count, active, onClick }) => {
  const { collapsed } = React.useContext(SidebarContext);
  if (collapsed) {
    return (
      <button onClick={onClick} title={label} style={{
        position: 'relative', width: 40, height: 40, margin: '0 auto',
        display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-md)',
        background: active ? 'var(--brand-700)' : 'transparent',
        color: active ? 'var(--neutral-0)' : 'var(--text-secondary)',
        border: 0, cursor: 'pointer', transition: 'all var(--motion-fast) var(--ease-out)',
      }}>
        <Icon name={icon} size={18}/>
        {count != null && count !== 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            minWidth: 14, height: 14, padding: '0 3px', borderRadius: 7,
            background: active ? 'rgba(255,255,255,0.95)' : 'var(--danger-500)',
            color: active ? 'var(--brand-800)' : '#fff',
            fontSize: 8, fontWeight: 700, display: 'grid', placeItems: 'center',
          }}>{typeof count === 'number' && count > 99 ? '99+' : count}</span>
        )}
      </button>
    );
  }
  return <NavItem icon={icon} label={label} count={count} active={active} onClick={onClick}/>;
};

const SidebarNav = ({ role, items, school, groups }) => {
  const { collapsed, toggle } = React.useContext(SidebarContext);
  const railed = collapsed;
  return (
    <aside style={{
      width: railed ? 64 : 232,
      background: 'var(--surface-card)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column',
      padding: railed ? '12px 8px' : '14px 12px',
      flexShrink: 0,
      transition: 'width var(--motion-base) var(--ease-out)',
      position: 'relative',
    }}>
      {/* Logo + collapse toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: railed ? '4px 0' : '4px 8px',
        marginBottom: 10,
        justifyContent: railed ? 'center' : 'space-between',
      }}>
        {railed ? (
          <Logo size={32}/>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Logo size={28}/>
              <div style={{ minWidth: 0 }}>
                <div className="display" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>EduPilot</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{role}</div>
              </div>
            </div>
          </>
        )}
        <button onClick={toggle} title={railed ? 'Étendre' : 'Réduire'} style={{
          position: railed ? 'absolute' : 'static',
          right: railed ? -12 : 'auto', top: railed ? 24 : 'auto',
          width: 22, height: 22, borderRadius: 11,
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          boxShadow: railed ? 'var(--shadow-sm)' : 'none',
          color: 'var(--text-secondary)',
          display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 2,
        }}>
          <Icon name="chevron" size={11} style={{ transform: railed ? 'none' : 'rotate(180deg)' }}/>
        </button>
      </div>

      {/* Search shortcut (rail mode shows icon only) */}
      {!railed && (
        <button style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', marginBottom: 12,
          background: 'var(--surface-sunken)', border: 0, borderRadius: 'var(--radius-md)',
          color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          width: '100%', textAlign: 'left',
        }}>
          <Icon name="search" size={14}/>
          <span style={{ flex: 1 }}>Rechercher…</span>
          <span className="mono" style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>⌘K</span>
        </button>
      )}

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {groups ? (
          groups.map((g, gi) => (
            <NavGroup key={gi} label={g.label} collapsed={railed}>
              {g.items.map((it, i) => <RailNavItem key={i} {...it}/>)}
            </NavGroup>
          ))
        ) : (
          <NavGroup collapsed={railed}>
            {items.map((it, i) => <RailNavItem key={i} {...it}/>)}
          </NavGroup>
        )}
      </div>

      {/* Footer: school switcher */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 6,
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: railed ? 'center' : 'flex-start',
      }}>
        <Avatar name={school || 'École Pilote'} size="sm"/>
        {!railed && (
          <>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{school || 'Cours Bénin Excellence'}</div>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Cotonou · 2025-26</div>
            </div>
            <Icon name="chevronDown" size={14} color="var(--text-tertiary)"/>
          </>
        )}
      </div>
    </aside>
  );
};

const TopBar = ({ user, role, search, notifs = 3 }) => (
  <header style={{
    height: 60, padding: '0 24px', background: 'var(--surface-card)',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
  }}>
    <div style={{ flex: 1, maxWidth: 380 }}>
      <Input icon="search" placeholder={search || 'Rechercher élève, classe, matière…'}/>
    </div>
    <div style={{ flex: 1 }}/>
    <Button variant="ghost" size="sm" icon="sparkle">Assistant IA</Button>
    <button style={{
      width: 38, height: 38, border: 0, background: 'transparent', borderRadius: 10, cursor: 'pointer',
      display: 'grid', placeItems: 'center', position: 'relative',
    }}>
      <Icon name="bell" size={18} color="var(--text-secondary)"/>
      {notifs > 0 && <span style={{
        position: 'absolute', top: 7, right: 8, width: 8, height: 8, borderRadius: 4,
        background: 'var(--danger-500)', boxShadow: '0 0 0 2px var(--surface-card)',
      }}/>}
    </button>
    <div style={{ height: 32, width: 1, background: 'var(--border-subtle)' }}/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar name={user} size="sm" status="online"/>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{user}</div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{role}</div>
      </div>
    </div>
  </header>
);

const PageHeader = ({ greeting, sub, children }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
    <div>
      <h1 className="display" style={{ fontSize: 32, margin: 0, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>{greeting}</h1>
      <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>{sub}</p>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>{children}</div>
  </div>
);

// ─── 1 · DIRECTOR DASHBOARD ─────────────────────────────────
const directorGroups = [
  { label: 'Pilotage', items: [
    { icon: 'home', label: "Vue d'ensemble" },
    { icon: 'chart', label: 'Analytics' },
    { icon: 'sparkle', label: 'Assistant IA' },
  ]},
  { label: 'Pédagogie', items: [
    { icon: 'users', label: 'Élèves', count: 1248 },
    { icon: 'book', label: 'Classes & matières' },
    { icon: 'pencil', label: 'Notes & bulletins' },
    { icon: 'calendar', label: 'Emploi du temps' },
    { icon: 'cards', label: 'Examens' },
    { icon: 'tag', label: 'Orientation', count: 3 },
  ]},
  { label: 'Vie scolaire', items: [
    { icon: 'check', label: 'Présences' },
    { icon: 'warning', label: 'Discipline' },
    { icon: 'danger', label: 'Santé & incidents', count: 2 },
    { icon: 'cards', label: 'Cantine' },
    { icon: 'school', label: 'Transport' },
    { icon: 'book', label: 'Bibliothèque' },
  ]},
  { label: 'Administration', items: [
    { icon: 'money', label: 'Finance', count: 14 },
    { icon: 'bell', label: 'Communication' },
    { icon: 'sms', label: 'Messagerie', count: 5 },
    { icon: 'settings', label: 'Paramètres' },
  ]},
];

const DirectorDash = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi"
    groups={directorGroups.map((g, gi) => ({
      ...g,
      items: g.items.map((it, ii) => ({ ...it, active: gi === 0 && ii === 0 })),
    }))}
    nav={[
      { icon: 'home', label: "Vue d'ensemble", active: true },
      { icon: 'school', label: 'Établissement' },
      { icon: 'users', label: 'Élèves', count: 1248 },
      { icon: 'book', label: 'Pédagogie' },
      { icon: 'money', label: 'Finance', count: 14 },
      { icon: 'calendar', label: 'Vie scolaire' },
      { icon: 'chart', label: 'Analytics' },
      { icon: 'bell', label: 'Communication' },
      { icon: 'settings', label: 'Paramètres' },
    ]}>
    <PageHeader greeting="Bonjour Mme Akpovi 👋" sub={<><span data-period="trimestre">Mardi 5 mai · Trimestre 2 — semaine 8 sur 12</span><span data-period="semestre">Mardi 5 mai · Semestre 2 — semaine 14 sur 22</span></>}>
      <Button variant="secondary" icon="download">Exporter rapport</Button>
      <Button icon="plus">Nouvelle annonce</Button>
    </PageHeader>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
      <MetricCard label="Élèves actifs" value="1 248" trend={4.2} trendLabel={<><span data-period="trimestre">vs trim. 1</span><span data-period="semestre">vs sem. 1</span></>} icon="users" variant="brand"/>
      <MetricCard label="Recouvrement" value="82" unit="%" trend={6.1} trendLabel="248,5M FCFA" icon="money" variant="success"/>
      <MetricCard label="Présence sem." value="92,4" unit="%" trend={-1.3} trendLabel="vs sem. dern." icon="check" variant="info"/>
      <MetricCard label="À risque" value="38" trend={12} trendLabel="à suivre" icon="warning" variant="warning"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
      <Card padding={20}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 className="display" style={{ fontSize: 18, margin: 0 }}>Recouvrement scolarité</h3>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
              <span data-period="trimestre">Trimestre 2 · objectif 95%</span>
              <span data-period="semestre">Semestre 2 · objectif 95%</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Badge variant="brand"><span data-period="trimestre">Trim. 2</span><span data-period="semestre">Sem. 2</span></Badge>
            <Badge variant="neutral"><span data-period="trimestre">Trim. 1</span><span data-period="semestre">Sem. 1</span></Badge>
          </div>
        </div>
        <BarChart/>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Encaissé</div><div className="display tabular" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>248,5<span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: 4 }}>M FCFA</span></div></div>
          <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>En retard (+15j)</div><div className="display tabular" style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: 'var(--warning-700)' }}>34,2<span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: 4 }}>M FCFA</span></div></div>
          <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Reste à recouvrer</div><div className="display tabular" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>54,8<span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: 4 }}>M FCFA</span></div></div>
        </div>
      </Card>
      <Card padding={0}>
        <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="display" style={{ fontSize: 18, margin: 0 }}>Notifications prioritaires</h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Filtrées · regroupées intelligemment</p>
          </div>
          <Badge variant="danger" size="sm">3 P0</Badge>
        </div>
        <div style={{ padding: '0 8px 12px' }}>
          <NotifItem type="urgent" priority="P0" title="Incident infirmerie · Marie B." body="CE2-A · suivi médical." time="il y a 4 min" actions={['Voir', 'SMS parent']}/>
          <NotifItem type="warning" title="14 paiements en retard · 4ᵉ B" body="Échéance dépassée de 8 jours." time="ce matin" actions={['Relance bulk SMS']}/>
          <NotifItem type="info" title="Conseil de classe 6ᵉ A" body="Demain 16h · 24 bulletins à valider." time="hier"/>
          <NotifItem type="success" title="Insight IA · Math CM2-A" body="Moyennes en hausse depuis 3 sem." time="hier"/>
        </div>
      </Card>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
      <Card>
        <SubLabel>Présence par niveau · cette semaine</SubLabel>
        {['CI–CM2 · primaire', '6ᵉ–3ᵉ · collège', '2nde–Term · lycée'].map((n, i) => {
          const v = [96, 91, 88][i];
          return <div key={i} style={{ marginTop: 10 }}><Progress label={n} sublabel={v + '%'} value={v} variant={v > 92 ? 'success' : v > 85 ? 'brand' : 'warning'}/></div>;
        })}
      </Card>
      <Card>
        <SubLabel>Équipe pédagogique</SubLabel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <div className="display tabular" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>62</div>
          <Badge variant="success" size="sm">3 nouveaux</Badge>
        </div>
        <div style={{ display: 'flex', marginTop: 12 }}>
          {['M. Adjavon', 'Mme Sossou', 'M. Hounsou', 'Mme Bio', 'M. Dossou', 'Mme Coffi'].map((n, i) => (
            <div key={i} style={{ marginLeft: i ? -8 : 0, boxShadow: '0 0 0 2px var(--surface-card)', borderRadius: '50%' }}>
              <Avatar name={n} size="sm"/>
            </div>
          ))}
          <div style={{ marginLeft: -8, width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-sunken)', boxShadow: '0 0 0 2px var(--surface-card)', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>+56</div>
        </div>
        <Button variant="ghost" size="sm" iconRight="arrowRight" style={{ marginTop: 12, marginLeft: -8 }}>Voir l'équipe</Button>
      </Card>
      <Card>
        <SubLabel>Cantine · semaine</SubLabel>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 8 }}>
          <div className="display tabular" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>847</div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingBottom: 3 }}>repas servis</span>
        </div>
        <div style={{ marginTop: 14 }}>
          <Sparkline data={[140, 165, 158, 172, 168, 44]} color="var(--brand-600)" height={42}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
          <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span>
        </div>
      </Card>
    </div>
  </DashShell>
);

// ─── 2 · TEACHER DASHBOARD ─────────────────────────────────
const TeacherDash = () => (
  <DashShell role="ENSEIGNANT" user="M. Adjavon"
    nav={[
      { icon: 'home', label: 'Mes classes', active: true },
      { icon: 'book', label: 'Cahier de textes' },
      { icon: 'pencil', label: 'Saisie de notes', count: 3 },
      { icon: 'check', label: "Appel d'aujourd'hui" },
      { icon: 'calendar', label: 'Emploi du temps' },
      { icon: 'users', label: 'Mes élèves', count: 142 },
      { icon: 'bell', label: 'Messages', count: 5 },
      { icon: 'sparkle', label: 'Assistant IA' },
    ]}>
    <PageHeader greeting="Bonjour M. Adjavon" sub="Mardi 5 mai · 3 cours aujourd'hui · 1 saisie en attente">
      <Button variant="secondary" icon="calendar">Mon emploi du temps</Button>
      <Button icon="plus">Nouvelle note</Button>
    </PageHeader>

    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
      <div>
        {/* Today's classes */}
        <Card padding={0} style={{ marginBottom: 14 }}>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <h3 className="display" style={{ fontSize: 18, margin: 0 }}>Aujourd'hui</h3>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Mathématiques · 3 cours · 78 élèves</p>
            </div>
            <Badge variant="info" dot>En cours</Badge>
          </div>
          <div>
            {[
              { time: '08:00 — 09:00', class: '4ᵉ B', subject: 'Théorème de Thalès', room: 'Salle 207', state: 'done', count: '28/28' },
              { time: '10:15 — 11:15', class: '3ᵉ A', subject: 'DST · fonctions affines', room: 'Salle 204', state: 'now', count: '24/26' },
              { time: '14:00 — 15:30', class: '6ᵉ C', subject: 'Géométrie · angles', room: 'Salle 207', state: 'next', count: '— — —' },
            ].map((c, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '110px 70px 1fr 80px 90px',
                gap: 14, alignItems: 'center', padding: '14px 20px',
                borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 0,
                background: c.state === 'now' ? 'var(--brand-50)' : 'transparent',
              }}>
                <div className="mono tabular" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.time}</div>
                <div className="display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{c.class}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.subject}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.room}</div>
                </div>
                <span className="tabular" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{c.count}</span>
                {c.state === 'done' && <Badge variant="success" icon="check" size="sm">Appel fait</Badge>}
                {c.state === 'now' && <Button size="sm" icon="check">Faire l'appel</Button>}
                {c.state === 'next' && <Button variant="secondary" size="sm">Préparer</Button>}
              </div>
            ))}
          </div>
        </Card>

        {/* Grade entry */}
        <Card padding={0}>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <h3 className="display" style={{ fontSize: 18, margin: 0 }}>Saisie rapide · DST 3ᵉ A</h3>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Coefficient 3 · 12 / 26 saisies</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="ghost" size="sm" icon="sparkle">Suggérer</Button>
              <Button size="sm" icon="check">Enregistrer</Button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-sunken)', textAlign: 'left' }}>
                <th style={{ padding: '8px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Élève</th>
                <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', width: 100 }}>Note /20</th>
                <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', width: 90 }}>Évolution</th>
                <th style={{ padding: '8px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', width: 110 }}>État</th>
              </tr>
            </thead>
            <tbody>
              {[
                { n: 'Aïcha Hounsou', g: '16,5', t: +1.2, s: 'saved' },
                { n: 'Mathieu Sossou', g: '13,0', t: -0.4, s: 'saved' },
                { n: 'Fatou Adjavon', g: '14,75', t: +0.8, s: 'editing' },
                { n: 'Koffi Dossou', g: '—', t: null, s: 'pending' },
                { n: 'Marie Bossou', g: '17,5', t: +2.1, s: 'saved' },
                { n: 'Jean-Paul Bio', g: '—', t: null, s: 'absent' },
              ].map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={r.n} size="xs"/>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{r.n}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {r.s === 'editing' ? (
                      <div style={{
                        height: 30, padding: '0 10px', display: 'inline-flex', alignItems: 'center',
                        border: '1.5px solid var(--brand-600)', borderRadius: 8,
                        background: 'var(--brand-50)',
                        fontSize: 13, fontWeight: 700, color: 'var(--brand-800)', minWidth: 60,
                      }} className="tabular">{r.g}<span style={{ width: 1, height: 14, background: 'var(--brand-700)', marginLeft: 4, animation: 'eduPulse 1s infinite' }}/></div>
                    ) : (
                      <span className="tabular" style={{ fontSize: 14, fontWeight: 700, color: r.g === '—' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{r.g}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {r.t != null && (
                      <span className="tabular" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: r.t >= 0 ? 'var(--success-700)' : 'var(--danger-700)' }}>
                        <Icon name={r.t >= 0 ? 'arrowUp' : 'arrowDown'} size={11}/>
                        {Math.abs(r.t).toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 20px' }}>
                    {r.s === 'saved' && <Badge variant="success" size="sm" icon="check">Enregistré</Badge>}
                    {r.s === 'editing' && <Badge variant="brand" size="sm" dot>En édition</Badge>}
                    {r.s === 'pending' && <Badge variant="neutral" size="sm">À saisir</Badge>}
                    {r.s === 'absent' && <Badge variant="warning" size="sm">Absent · DST</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card style={{ background: 'linear-gradient(135deg, var(--brand-800), var(--brand-700))', color: '#fff', border: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 10 }}>
            <Icon name="sparkle" size={14}/> Insight IA
          </div>
          <div className="display" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.25, marginBottom: 8 }}>
            3 élèves de 3ᵉ A montrent un décrochage en algèbre depuis 2 semaines.
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.55, marginBottom: 14 }}>
            Suggestion : exercices ciblés sur les fonctions affines avant le DST de vendredi.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="soft" size="sm" style={{ background: 'rgba(255,255,255,0.95)', color: 'var(--brand-800)' }}>Voir les 3 élèves</Button>
            <Button variant="ghost" size="sm" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>Plus tard</Button>
          </div>
        </Card>
        <Card>
          <SubLabel>Élèves à suivre</SubLabel>
          {[
            { n: 'Koffi Dossou', sub: '4ᵉ B · 3 absences sem.', tag: 'warning', tagL: 'Absences' },
            { n: 'Aïcha Hounsou', sub: '3ᵉ A · −1,8 pts en math', tag: 'danger', tagL: 'Décrochage' },
            { n: 'Marie Bossou', sub: 'CE2-A · suivi infirmerie', tag: 'info', tagL: 'Santé' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <Avatar name={s.n} size="sm"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.n}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.sub}</div>
              </div>
              <Badge variant={s.tag} size="sm">{s.tagL}</Badge>
            </div>
          ))}
        </Card>
        <Card>
          <SubLabel>Moyennes · mes classes</SubLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="display" style={{ fontSize: 18, fontWeight: 700, width: 50 }}>4ᵉ B</span>
              <Sparkline data={[12,12.5,13,13.2,13.8,13.5,14.1]} color="var(--success-600)" height={28}/>
              <span className="display tabular" style={{ fontSize: 18, fontWeight: 700, color: 'var(--success-700)' }}>14,1</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="display" style={{ fontSize: 18, fontWeight: 700, width: 50 }}>3ᵉ A</span>
              <Sparkline data={[13,13.2,12.8,12.5,12.3,12.0,11.8]} color="var(--warning-600)" height={28}/>
              <span className="display tabular" style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning-700)' }}>11,8</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="display" style={{ fontSize: 18, fontWeight: 700, width: 50 }}>6ᵉ C</span>
              <Sparkline data={[14,14.2,14.5,14.4,14.8,15.0,15.2]} color="var(--success-600)" height={28}/>
              <span className="display tabular" style={{ fontSize: 18, fontWeight: 700, color: 'var(--success-700)' }}>15,2</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 3 · PARENT DASHBOARD ─────────────────────────────────
const ParentDash = () => (
  <DashShell role="PARENT" user="M. Hounsou"
    nav={[
      { icon: 'home', label: 'Accueil', active: true },
      { icon: 'users', label: 'Mes enfants', count: 2 },
      { icon: 'money', label: 'Paiements', count: 1 },
      { icon: 'calendar', label: 'Emploi du temps' },
      { icon: 'bell', label: 'Notifications', count: 3 },
      { icon: 'sms', label: 'Messagerie école' },
      { icon: 'settings', label: 'Mon compte' },
    ]}>
    <PageHeader greeting="Bonjour M. Hounsou" sub="Aïcha · Mathieu — voici ce qui compte aujourd'hui">
      <Button variant="secondary" icon="sms">Contacter l'école</Button>
    </PageHeader>

    {/* Children cards */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
      {[
        { n: 'Aïcha Hounsou', c: '3ᵉ A · 14 ans', avg: '14,8', trend: +0.6, attend: 96, status: 'ok', high: { type: 'success', label: 'DST math · 16,5' } },
        { n: 'Mathieu Hounsou', c: 'CM1 · 9 ans', avg: '12,2', trend: -0.8, attend: 88, status: 'warn', high: { type: 'warning', label: '2 absences cette semaine' } },
      ].map((k, i) => (
        <Card key={i} padding={0} style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16,
            background: k.status === 'warn' ? 'var(--warning-50)' : 'var(--brand-50)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <Avatar name={k.n} size="xl"/>
            <div style={{ flex: 1 }}>
              <div className="display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em' }}>{k.n}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{k.c}</div>
              <div style={{ marginTop: 8 }}>
                <Badge variant={k.high.type}>{k.high.label}</Badge>
              </div>
            </div>
            <Icon name="chevron" size={18} color="var(--text-tertiary)"/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '18px 22px', gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Moyenne T2</div>
              <div className="display tabular" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{k.avg}</div>
              <span className="tabular" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: k.trend >= 0 ? 'var(--success-700)' : 'var(--danger-700)' }}>
                <Icon name={k.trend >= 0 ? 'arrowUp' : 'arrowDown'} size={11}/>{Math.abs(k.trend).toFixed(1)} pts
              </span>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Présence</div>
              <div className="display tabular" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{k.attend}<span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: 2 }}>%</span></div>
              <div style={{ height: 4, background: 'var(--neutral-200)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: k.attend + '%', background: k.attend > 92 ? 'var(--success-500)' : 'var(--warning-500)' }}/>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prochain</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>DST Français</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Vendredi 8 mai</div>
            </div>
          </div>
        </Card>
      ))}
    </div>

    {/* Payment + notifications */}
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h3 className="display" style={{ fontSize: 18, margin: 0 }}>Paiements de scolarité</h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Année 2025 — 26 · Flutterwave + Paystack</p>
          </div>
          <Badge variant="warning" icon="warning">1 échéance proche</Badge>
        </div>
        <div>
          {[
            { name: <><span>Aïcha · </span><span data-period="trimestre">Trim. 1</span><span data-period="semestre">Sem. 1</span></>, amount: '125 000', due: 'Payé · 12 oct.', state: 'paid' },
            { name: <><span>Mathieu · </span><span data-period="trimestre">Trim. 1</span><span data-period="semestre">Sem. 1</span></>, amount: '95 000', due: 'Payé · 12 oct.', state: 'paid' },
            { name: <><span>Aïcha · </span><span data-period="trimestre">Trim. 2</span><span data-period="semestre">Sem. 2</span></>, amount: '125 000', due: 'Échéance dans 6 jours', state: 'due' },
            { name: <><span>Mathieu · </span><span data-period="trimestre">Trim. 2</span><span data-period="semestre">Sem. 2</span></>, amount: '95 000', due: 'Échéance dans 6 jours', state: 'due' },
          ].map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center', padding: '12px 20px', borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 0 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: p.state === 'due' ? 'var(--warning-700)' : 'var(--text-tertiary)', marginTop: 2 }}>{p.due}</div>
              </div>
              <span className="display tabular" style={{ fontSize: 18, fontWeight: 700 }}>{p.amount}<span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: 4 }}>FCFA</span></span>
              {p.state === 'paid' ? <Badge variant="success" icon="check">Payé</Badge> : <Button size="sm" icon="money">Payer</Button>}
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', background: 'var(--surface-sunken)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total dû avant le 11 mai</span>
          <span className="display tabular" style={{ fontSize: 22, fontWeight: 700 }}>220 000 <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>FCFA</span></span>
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="display" style={{ fontSize: 18, margin: 0 }}>Activité récente</h3>
        </div>
        <div style={{ padding: '6px 8px' }}>
          <NotifItem type="success" title="DST Math 16,5/20 — Aïcha" body="Excellent · meilleure note de la classe."  time="il y a 2 h"/>
          <NotifItem type="warning" title="Mathieu absent — mardi matin" body="Aucun justificatif reçu." time="ce matin" actions={['Justifier']}/>
          <NotifItem type="info" title="Réunion parents 6ᵉ-CM1" body="Samedi 10 mai · 9h00 · salle des fêtes." time="hier"/>
          <NotifItem type="sms" title="SMS reçu de l'école" body="Rappel paiement T2 · 220 000 FCFA." time="lundi"/>
        </div>
      </Card>
    </div>
  </DashShell>
);

// ─── 4 · STUDENT DASHBOARD ─────────────────────────────────
const StudentDash = () => (
  <DashShell role="ÉLÈVE" user="Aïcha Hounsou"
    nav={[
      { icon: 'home', label: 'Mon tableau', active: true },
      { icon: 'calendar', label: 'Emploi du temps' },
      { icon: 'pencil', label: 'Mes notes' },
      { icon: 'book', label: 'Devoirs', count: 4 },
      { icon: 'trophy', label: 'Mes badges', count: 12 },
      { icon: 'users', label: 'Ma classe' },
      { icon: 'sms', label: 'Messagerie' },
    ]}>
    <PageHeader greeting="Salut Aïcha 👋" sub={<><span data-period="trimestre">3ᵉ A · Tu es 4ᵉ de la classe ce trimestre. Belle progression !</span><span data-period="semestre">3ᵉ A · Tu es 4ᵉ de la classe ce semestre. Belle progression !</span></>}>
      <Button variant="ghost" icon="trophy">12 badges</Button>
      <Button variant="secondary" icon="calendar">Mon EDT</Button>
    </PageHeader>

    {/* Hero strip */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
      <Card style={{ background: 'linear-gradient(135deg, var(--brand-800), var(--brand-600))', color: '#fff', border: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85 }}>Ma moyenne T2</div>
        <div className="display tabular" style={{ fontSize: 56, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.04em', marginTop: 6 }}>14,8</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12 }}>
          <Icon name="arrowUp" size={12}/> +0,6 pts <span data-period="trimestre">vs trim. 1</span><span data-period="semestre">vs sem. 1</span>
        </div>
      </Card>
      <Card>
        <SubLabel>Classement</SubLabel>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
          <span className="display tabular" style={{ fontSize: 56, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.04em' }}>4</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>/ 26</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: 'var(--success-700)', fontWeight: 600 }}>
          <Icon name="arrowUp" size={11}/> Tu as gagné 3 places
        </div>
      </Card>
      <Card style={{ display: 'flex', flexDirection: 'column' }}>
        <SubLabel>Série en cours</SubLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--warning-50)', display: 'grid', placeItems: 'center' }}>
            <Icon name="flame" size={28} color="var(--warning-600)"/>
          </div>
          <div>
            <div className="display tabular" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>14<span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: 4 }}>jours</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Présence parfaite · garde la flamme !</div>
          </div>
        </div>
      </Card>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <Card padding={0}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="display" style={{ fontSize: 18, margin: 0 }}>Mes dernières notes</h3>
        </div>
        <div>
          {[
            { sub: 'Mathématiques', e: 'DST · théorème de Thalès', n: '16,5', max: 20, c: 3, t: +1.2, color: 'success' },
            { sub: 'Français', e: 'Dissertation · Camara Laye', n: '13,0', max: 20, c: 2, t: -0.5, color: 'warning' },
            { sub: 'SVT', e: 'Interro · génétique', n: '17,0', max: 20, c: 1, t: +1.8, color: 'success' },
            { sub: 'Histoire-Géo', e: "Exposé · les royaumes du Bénin", n: '14,5', max: 20, c: 2, t: +0.3, color: 'brand' },
            { sub: 'Anglais', e: 'Oral presentation · my hometown', n: '15,0', max: 20, c: 2, t: 0, color: 'brand' },
          ].map((g, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 70px 70px', gap: 14, alignItems: 'center', padding: '12px 20px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `var(--${g.color}-50)`, display: 'grid', placeItems: 'center' }}>
                <Icon name={g.sub === 'Mathématiques' ? 'chart' : g.sub === 'SVT' ? 'sparkle' : g.sub === 'Anglais' ? 'sms' : 'book'} size={16} color={`var(--${g.color}-700)`}/>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{g.sub}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{g.e} · coef. {g.c}</div>
              </div>
              <span className="display tabular" style={{ fontSize: 22, fontWeight: 700, color: `var(--${g.color}-700)` }}>{g.n}</span>
              {g.t !== 0 && (
                <span className="tabular" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: g.t > 0 ? 'var(--success-700)' : 'var(--danger-700)' }}>
                  <Icon name={g.t > 0 ? 'arrowUp' : 'arrowDown'} size={11}/>{Math.abs(g.t).toFixed(1)}
                </span>
              )}
              {g.t === 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Mes devoirs</h3>
            <Badge variant="warning" size="sm">2 dus cette semaine</Badge>
          </div>
          {[
            { sub: 'Math', e: 'Exos 12-18 p.84', due: 'Demain', state: 'todo' },
            { sub: 'Français', e: 'Lecture · chap. 4-6', due: 'Vendredi', state: 'progress' },
            { sub: 'SVT', e: 'Schéma cellulaire', due: 'Lundi', state: 'todo' },
            { sub: 'EPS', e: 'Fiche d\'observation', due: 'Mardi', state: 'done' },
          ].map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 6,
                border: `1.5px solid ${d.state === 'done' ? 'var(--success-600)' : 'var(--border-default)'}`,
                background: d.state === 'done' ? 'var(--success-600)' : 'transparent',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                {d.state === 'done' && <Icon name="check" size={11} color="#fff" strokeWidth={3}/>}
                {d.state === 'progress' && <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--warning-500)' }}/>}
              </div>
              <div style={{ flex: 1, textDecoration: d.state === 'done' ? 'line-through' : 'none', opacity: d.state === 'done' ? 0.55 : 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{d.sub} — {d.e}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Pour {d.due}</div>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <SubLabel>Mes badges récents</SubLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 4 }}>
            {[
              { i: 'trophy', l: 'Top 5', c: 'warning' },
              { i: 'flame', l: '14j série', c: 'danger' },
              { i: 'sparkle', l: 'IA Pro', c: 'brand' },
              { i: 'check', l: '100% devoirs', c: 'success' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 10, background: `var(--${b.c}-50)`, borderRadius: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `var(--${b.c}-600)`, display: 'grid', placeItems: 'center' }}>
                  <Icon name={b.i} size={18} color="#fff"/>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: `var(--${b.c}-800)`, textAlign: 'center' }}>{b.l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 5 · SUPER ADMIN DASHBOARD ─────────────────────────────
const SuperAdminDash = () => (
  <DashShell role="SUPER ADMIN" user="Réseau Excellence" school="Réseau · 8 établissements"
    nav={[
      { icon: 'grid', label: 'Vue réseau', active: true },
      { icon: 'school', label: 'Établissements', count: 8 },
      { icon: 'users', label: 'Utilisateurs', count: '8 240' },
      { icon: 'money', label: 'Finance consolidée' },
      { icon: 'chart', label: 'Analytics BI' },
      { icon: 'bell', label: 'Alertes', count: 5 },
      { icon: 'settings', label: 'Configuration' },
    ]}>
    <PageHeader greeting="Réseau Excellence" sub="8 établissements · 8 240 élèves · vue consolidée temps réel">
      <Button variant="secondary" icon="download">Export consolidé</Button>
      <Button icon="plus">Nouveau site</Button>
    </PageHeader>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
      <MetricCard label="Élèves réseau" value="8 240" trend={3.4} trendLabel="vs an dern." icon="users" variant="brand"/>
      <MetricCard label="CA consolidé" value="1,42" unit="Mrd FCFA" trend={8.7} trendLabel="vs T1" icon="money" variant="success"/>
      <MetricCard label="Recouvrement" value="84" unit="%" trend={2.1} trendLabel="moyenne réseau" icon="check" variant="info"/>
      <MetricCard label="Sites en alerte" value="2" trend={null} trendLabel="P1 actifs" icon="warning" variant="warning"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <Card padding={0}>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="display" style={{ fontSize: 18, margin: 0 }}>Établissements</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="ghost" size="sm" icon="filter">Filtrer</Button>
            <Button variant="ghost" size="sm" icon="grid">Carte</Button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-sunken)', textAlign: 'left' }}>
              {['Établissement', 'Élèves', 'Recouvrement', 'Présence', 'Alerte'].map((h, i) => (
                <th key={i} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { n: 'Excellence Cotonou', loc: 'Cotonou · Akpakpa', s: 1248, r: 92, p: 94, a: null },
              { n: 'Excellence Calavi', loc: 'Abomey-Calavi', s: 982, r: 78, p: 91, a: { v: 'warning', l: 'Recouvrement bas' } },
              { n: 'Excellence Porto-Novo', loc: 'Porto-Novo', s: 1140, r: 88, p: 93, a: null },
              { n: 'Excellence Parakou', loc: 'Parakou', s: 856, r: 81, p: 89, a: null },
              { n: 'Excellence Bohicon', loc: 'Bohicon', s: 642, r: 74, p: 86, a: { v: 'danger', l: '8 incidents · 30j' } },
              { n: 'Excellence Lokossa', loc: 'Lokossa', s: 588, r: 86, p: 92, a: null },
              { n: 'Excellence Natitingou', loc: 'Natitingou', s: 720, r: 90, p: 95, a: null },
              { n: 'Excellence Djougou', loc: 'Djougou', s: 1064, r: 83, p: 90, a: null },
            ].map((s, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={s.n} size="sm"/>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.n}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.loc}</div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }} className="tabular">{s.s.toLocaleString('fr-FR')}</td>
                <td style={{ padding: '12px 16px', minWidth: 130 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="tabular" style={{ fontSize: 13, fontWeight: 600, width: 32, color: s.r < 80 ? 'var(--warning-700)' : 'var(--text-primary)' }}>{s.r}%</span>
                    <div style={{ height: 4, flex: 1, background: 'var(--neutral-200)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: s.r + '%', background: s.r < 80 ? 'var(--warning-500)' : 'var(--success-500)' }}/>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }} className="tabular">{s.p}%</td>
                <td style={{ padding: '12px 16px' }}>{s.a ? <Badge variant={s.a.v} dot>{s.a.l}</Badge> : <Badge variant="success" size="sm" dot>Stable</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Revenus consolidés · 12 mois</SubLabel>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span className="display tabular" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em' }}>1,42</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Mrd FCFA</span>
            <Badge variant="success" size="sm">+8,7%</Badge>
          </div>
          <div style={{ marginTop: 14 }}>
            <Sparkline data={[80,92,88,98,105,110,118,122,128,132,138,142]} color="var(--brand-700)" height={48}/>
          </div>
        </Card>
        <Card>
          <SubLabel>Top alertes réseau</SubLabel>
          <div style={{ marginLeft: -14, marginRight: -14 }}>
            <NotifItem type="urgent" priority="P0" title="Excellence Bohicon · 8 incidents en 30j" body="Au-dessus du seuil réseau." time="1 h"/>
            <NotifItem type="warning" title="Calavi · recouvrement 78%" body="Sous l'objectif réseau (84%)." time="3 h"/>
            <NotifItem type="info" title="Sync analytics · 8/8 sites" body="Toutes les écoles à jour." time="hier"/>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── Shared shell ─────────────────────────────────────────
const DashShell = ({ role, user, school, nav, groups, defaultCollapsed, children }) => {
  const [collapsed, setCollapsed] = React.useState(!!defaultCollapsed);
  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed(c => !c) }}>
      <div style={{
        width: 1280, minHeight: 820, height: '100%', background: 'var(--surface-page)',
        display: 'flex', overflow: 'hidden',
        borderRadius: 0,
        color: 'var(--text-primary)',
      }}>
        <SidebarNav role={role} items={nav} school={school} groups={groups}/>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <TopBar user={user} role={role}/>
          <main style={{ flex: 1, padding: '24px 28px', overflow: 'visible' }}>{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

// ─── Bar chart (decorative for director) ──────────────────
const BarChart = () => {
  const data = [
    { l: 'CI–CP', t1: 88, t2: 94 },
    { l: 'CE1–CE2', t1: 76, t2: 86 },
    { l: 'CM1–CM2', t1: 82, t2: 89 },
    { l: '6ᵉ–5ᵉ', t1: 70, t2: 82 },
    { l: '4ᵉ–3ᵉ', t1: 68, t2: 78 },
    { l: '2nde', t1: 72, t2: 80 },
    { l: '1ʳᵉ', t1: 74, t2: 81 },
    { l: 'Term', t1: 80, t2: 86 },
  ];
  const max = 100;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 140, paddingTop: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, flex: 1, width: '100%', justifyContent: 'center' }}>
            <div style={{ width: '38%', height: (d.t1 / max * 100) + '%', background: 'var(--neutral-300)', borderRadius: '4px 4px 0 0' }}/>
            <div style={{ width: '38%', height: (d.t2 / max * 100) + '%', background: 'var(--brand-700)', borderRadius: '4px 4px 0 0', position: 'relative' }}>
              <span className="tabular" style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: 'var(--brand-800)' }}>{d.t2}%</span>
            </div>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>{d.l}</span>
        </div>
      ))}
    </div>
  );
};

Object.assign(window, { DirectorDash, TeacherDash, ParentDash, StudentDash, SuperAdminDash, Section, SubLabel, SidebarContext, directorGroups });
