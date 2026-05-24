// EduPilot — Mobile companion screens (375×812)

const Phone = ({ children, label }) => (
  <div style={{ width: 375, height: 760, background: 'var(--surface-page)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 32, boxShadow: '0 0 0 9px var(--neutral-900), 0 0 0 10px var(--neutral-800)' }}>
    {/* Status bar */}
    <div style={{ height: 38, padding: '12px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
      <span className="tabular">9:41</span>
      <span style={{ width: 80, height: 22, background: 'var(--neutral-900)', borderRadius: 12 }}/>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 11 }}>5G</span>
        <span style={{ width: 24, height: 11, border: '1.2px solid currentColor', borderRadius: 3, position: 'relative', padding: 1 }}>
          <span style={{ display: 'block', height: '100%', width: '85%', background: 'currentColor', borderRadius: 1 }}/>
        </span>
      </span>
    </div>
    {children}
  </div>
);

const BottomNav = ({ items }) => (
  <nav style={{
    height: 72, padding: '8px 12px 16px',
    background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)',
    display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`,
  }}>
    {items.map((it, i) => (
      <button key={i} style={{
        background: 'transparent', border: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 4, cursor: 'pointer', position: 'relative',
        color: it.active ? 'var(--brand-700)' : 'var(--text-tertiary)',
        fontFamily: 'inherit',
      }}>
        <div style={{ position: 'relative' }}>
          <Icon name={it.icon} size={22}/>
          {it.count != null && <span style={{
            position: 'absolute', top: -4, right: -8,
            minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8, background: 'var(--danger-500)',
            color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'grid', placeItems: 'center',
          }}>{it.count}</span>}
        </div>
        <span style={{ fontSize: 10, fontWeight: 600 }}>{it.label}</span>
      </button>
    ))}
  </nav>
);

// ── Parent mobile ──────────────────────────────────────────
const ParentMobile = () => (
  <Phone>
    <div style={{ flex: 1, overflow: 'hidden', padding: '8px 18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 16px' }}>
        <Avatar name="M. Hounsou" size="md"/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Bonjour</div>
          <div className="display" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>M. Hounsou</div>
        </div>
        <button style={{ width: 38, height: 38, border: 0, borderRadius: 12, background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', display: 'grid', placeItems: 'center', position: 'relative' }}>
          <Icon name="bell" size={18}/>
          <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: 4, background: 'var(--danger-500)' }}/>
        </button>
      </div>

      {/* Urgent banner */}
      <Card padding={14} style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-200)', marginBottom: 14, display: 'flex', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--warning-600)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="warning" size={18} color="#fff"/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning-900)' }}>Paiement T2 dans 6 jours</div>
          <div style={{ fontSize: 11, color: 'var(--warning-800)', marginTop: 2 }}>220 000 FCFA · Aïcha + Mathieu</div>
        </div>
      </Card>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Mes enfants</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {[
          { n: 'Aïcha', c: '3ᵉ A', avg: '14,8', t: +0.6, color: 'success' },
          { n: 'Mathieu', c: 'CM1', avg: '12,2', t: -0.8, color: 'warning' },
        ].map((k, i) => (
          <Card key={i} padding={12} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={k.n + ' Hounsou'} size="md"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{k.n}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{k.c} · moyenne {k.avg}</div>
            </div>
            <Badge variant={k.color} size="sm">
              {k.t > 0 ? '+' : ''}{k.t.toFixed(1)} pts
            </Badge>
            <Icon name="chevron" size={16} color="var(--text-tertiary)"/>
          </Card>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Récent</div>
      <Card padding={4} style={{ marginBottom: 8 }}>
        <NotifItem type="success" title="DST Math 16,5/20" body="Aïcha · meilleure note de la classe" time="2 h"/>
        <NotifItem type="warning" title="Mathieu absent — mardi" body="Aucun justificatif" time="ce matin" actions={['Justifier']}/>
        <NotifItem type="sms" title="SMS · Rappel paiement" time="lundi"/>
      </Card>
    </div>
    <BottomNav items={[
      { icon: 'home', label: 'Accueil', active: true },
      { icon: 'users', label: 'Enfants' },
      { icon: 'money', label: 'Payer', count: 1 },
      { icon: 'sms', label: 'École' },
      { icon: 'settings', label: 'Profil' },
    ]}/>
  </Phone>
);

// ── Student mobile ─────────────────────────────────────────
const StudentMobile = () => (
  <Phone>
    <div style={{ flex: 1, overflow: 'hidden', padding: '8px 18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 16px' }}>
        <Avatar name="Aïcha Hounsou" size="md"/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Salut 👋</div>
          <div className="display" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>Aïcha</div>
        </div>
        <Badge variant="warning" icon="flame">14j</Badge>
      </div>

      {/* Big stat hero */}
      <Card padding={20} style={{ background: 'linear-gradient(135deg, var(--brand-800), var(--brand-600))', color: '#fff', border: 0, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85 }}>Ma moyenne T2</div>
        <div className="display tabular" style={{ fontSize: 64, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.04em', marginTop: 4 }}>14,8</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <Icon name="arrowUp" size={12}/> +0,6 pts · 4ᵉ / 26
          </div>
          <Icon name="trophy" size={20}/>
        </div>
      </Card>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
        <Card padding={14} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--warning-50)', display: 'grid', placeItems: 'center' }}>
            <Icon name="book" size={18} color="var(--warning-700)"/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>4 devoirs</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>2 cette semaine</div>
          </div>
        </Card>
        <Card padding={14} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--info-50)', display: 'grid', placeItems: 'center' }}>
            <Icon name="calendar" size={18} color="var(--info-700)"/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Math 14h</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Salle 207</div>
          </div>
        </Card>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Dernières notes</div>
      <Card padding={0}>
        {[
          { sub: 'Maths', e: 'DST Thalès', n: '16,5', c: 'success' },
          { sub: 'Français', e: 'Camara Laye', n: '13,0', c: 'warning' },
          { sub: 'SVT', e: 'Génétique', n: '17,0', c: 'success' },
        ].map((g, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{g.sub}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{g.e}</div>
            </div>
            <span className="display tabular" style={{ fontSize: 22, fontWeight: 700, color: `var(--${g.c}-700)` }}>{g.n}</span>
          </div>
        ))}
      </Card>
    </div>
    <BottomNav items={[
      { icon: 'home', label: 'Accueil', active: true },
      { icon: 'pencil', label: 'Notes' },
      { icon: 'book', label: 'Devoirs', count: 4 },
      { icon: 'calendar', label: 'EDT' },
      { icon: 'trophy', label: 'Badges' },
    ]}/>
  </Phone>
);

// ── Teacher mobile (attendance) ────────────────────────────
const TeacherMobile = () => (
  <Phone>
    <div style={{ flex: 1, overflow: 'hidden', padding: '8px 18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 14px' }}>
        <button style={{ width: 36, height: 36, border: 0, background: 'transparent', display: 'grid', placeItems: 'center' }}>
          <Icon name="chevronDown" size={18} style={{ transform: 'rotate(90deg)' }}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Appel · 10h15</div>
          <div className="display" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>3ᵉ A — DST Maths</div>
        </div>
        <Badge variant="brand">24/26</Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
        <Card padding={10} style={{ background: 'var(--success-50)', border: 0, textAlign: 'center' }}>
          <div className="display tabular" style={{ fontSize: 22, fontWeight: 700, color: 'var(--success-800)' }}>22</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--success-800)' }}>Présents</div>
        </Card>
        <Card padding={10} style={{ background: 'var(--warning-50)', border: 0, textAlign: 'center' }}>
          <div className="display tabular" style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning-800)' }}>2</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warning-800)' }}>Retards</div>
        </Card>
        <Card padding={10} style={{ background: 'var(--danger-50)', border: 0, textAlign: 'center' }}>
          <div className="display tabular" style={{ fontSize: 22, fontWeight: 700, color: 'var(--danger-800)' }}>2</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--danger-800)' }}>Absents</div>
        </Card>
      </div>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        {[
          { n: 'Aïcha Hounsou', s: 'present' },
          { n: 'Mathieu Sossou', s: 'present' },
          { n: 'Fatou Adjavon', s: 'late' },
          { n: 'Koffi Dossou', s: 'absent' },
          { n: 'Marie Bossou', s: 'present' },
          { n: 'Jean-Paul Bio', s: 'present' },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
            <Avatar name={r.n} size="sm"/>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{r.n}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { k: 'present', l: 'P', c: 'success' },
                { k: 'late', l: 'R', c: 'warning' },
                { k: 'absent', l: 'A', c: 'danger' },
              ].map(b => {
                const active = r.s === b.k;
                return (
                  <button key={b.k} style={{
                    width: 36, height: 36, borderRadius: 10,
                    border: active ? 0 : '1.5px solid var(--border-default)',
                    background: active ? `var(--${b.c}-600)` : 'transparent',
                    color: active ? '#fff' : 'var(--text-tertiary)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{b.l}</button>
                );
              })}
            </div>
          </div>
        ))}
      </Card>
    </div>
    <div style={{ padding: 16, borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
      <Button full size="lg" icon="check">Valider l'appel · 26 élèves</Button>
    </div>
  </Phone>
);

Object.assign(window, { ParentMobile, StudentMobile, TeacherMobile });
