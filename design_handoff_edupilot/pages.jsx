// EduPilot — Module pages (reuse DashShell)

const directorNav = [
  { icon: 'home', label: "Vue d'ensemble" },
  { icon: 'school', label: 'Établissement' },
  { icon: 'users', label: 'Élèves', count: 1248 },
  { icon: 'book', label: 'Pédagogie' },
  { icon: 'pencil', label: 'Notes' },
  { icon: 'check', label: 'Présences' },
  { icon: 'money', label: 'Finance', count: 14 },
  { icon: 'calendar', label: 'Emploi du temps' },
  { icon: 'danger', label: 'Incidents · Santé' },
  { icon: 'cards', label: 'Cantine' },
  { icon: 'book', label: 'Bibliothèque' },
  { icon: 'sparkle', label: 'Assistant IA' },
  { icon: 'chart', label: 'Analytics' },
  { icon: 'bell', label: 'Communication' },
];

const PageTitle = ({ title, sub, breadcrumb, children }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
    <div>
      {breadcrumb && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, display: 'flex', gap: 8 }}>
        {breadcrumb.map((b, i) => <React.Fragment key={i}>
          <span style={{ fontWeight: i === breadcrumb.length - 1 ? 600 : 400, color: i === breadcrumb.length - 1 ? 'var(--text-secondary)' : 'inherit' }}>{b}</span>
          {i < breadcrumb.length - 1 && <span>›</span>}
        </React.Fragment>)}
      </div>}
      <h1 className="display" style={{ fontSize: 30, margin: 0, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>{title}</h1>
      <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>{sub}</p>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>{children}</div>
  </div>
);

const FilterBar = ({ children }) => (
  <Card padding={12} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
    <Icon name="filter" size={14} color="var(--text-tertiary)"/>
    {children}
  </Card>
);

const Chip = ({ active, children, count }) => (
  <button style={{
    height: 30, padding: '0 12px', borderRadius: 'var(--radius-pill)',
    border: `1px solid ${active ? 'var(--brand-600)' : 'var(--border-default)'}`,
    background: active ? 'var(--brand-50)' : 'transparent',
    color: active ? 'var(--brand-800)' : 'var(--text-secondary)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }}>
    {children}
    {count != null && <span style={{ fontSize: 10, padding: '0 6px', borderRadius: 'var(--radius-pill)', background: active ? 'var(--brand-600)' : 'var(--neutral-200)', color: active ? '#fff' : 'var(--text-tertiary)' }}>{count}</span>}
  </button>
);

// ─── 1 · GRADES (Carnet de notes complet) ───────────────────
const GradesPage = () => (
  <DashShell role="ENSEIGNANT" user="M. Adjavon" nav={directorNav.map((n, i) => ({ ...n, active: i === 4 }))}>
    <PageTitle title="Carnet de notes" sub="3ᵉ A · Mathématiques · Trimestre 2"
      breadcrumb={['Pédagogie', 'Notes', '3ᵉ A — Mathématiques']}>
      <Button variant="secondary" icon="download">Exporter</Button>
      <Button variant="secondary" icon="sparkle">Suggérer (IA)</Button>
      <Button icon="plus">Nouveau devoir</Button>
    </PageTitle>

    <FilterBar>
      <Chip active>Tous les devoirs</Chip>
      <Chip count={2}>DST</Chip>
      <Chip count={5}>DM</Chip>
      <Chip count={3}>Interro</Chip>
      <div style={{ flex: 1 }}/>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>26 élèves · 10 devoirs · coeff. moyen 2,1</span>
    </FilterBar>

    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ overflow: 'auto', maxHeight: 540 }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-sunken)', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', minWidth: 200, position: 'sticky', left: 0, background: 'var(--surface-sunken)', borderRight: '1px solid var(--border-subtle)' }}>Élève</th>
              {['DST 1', 'DM 1', 'Inter. 1', 'DST 2', 'DM 2', 'DM 3', 'Inter. 2', 'Inter. 3', 'DM 4', 'DM 5'].map((d, i) => (
                <th key={i} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 56 }}>
                  <div>{d}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 2 }}>×{[3,1,1,3,1,1,1,1,1,1][i]}</div>
                </th>
              ))}
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', background: 'var(--brand-50)', position: 'sticky', right: 0, borderLeft: '1px solid var(--border-subtle)' }}>Moy.</th>
            </tr>
          </thead>
          <tbody>
            {[
              { n: 'Aïcha Hounsou', grades: [16.5, 18, 15, 17, 16, 19, 14, 17, 18, 16], avg: 16.8 },
              { n: 'Mathieu Sossou', grades: [13, 14, 12, 13.5, 14, 12, 13, 14, 15, 13], avg: 13.4 },
              { n: 'Fatou Adjavon', grades: [14.75, 15, 13, 14, 16, 14, 15, 16, 14, 15], avg: 14.6 },
              { n: 'Koffi Dossou', grades: [null, 11, 9, 12, 10, 11, 12, null, 13, 11], avg: 11.0 },
              { n: 'Marie Bossou', grades: [17.5, 18, 17, 19, 18, 19, 17, 18, 19, 18], avg: 18.0 },
              { n: 'Jean-Paul Bio', grades: [null, 12, null, 13, 11, 12, 13, 14, 12, 13], avg: 12.5 },
              { n: 'Aminatou Coffi', grades: [15, 16, 15, 15, 17, 15, 16, 17, 16, 15], avg: 15.5 },
              { n: 'Serge Padonou', grades: [10, 11, 8, 11, 10, 12, 11, 10, 12, 11], avg: 10.5 },
              { n: 'Lucie Houngbedji', grades: [14, 15, 13, 14, 15, 14, 14, 15, 16, 15], avg: 14.5 },
              { n: 'Pierre Akin', grades: [12, 13, 11, 13, 14, 13, 12, 13, 14, 13], avg: 12.8 },
              { n: 'Yvette Adissi', grades: [16, 17, 15, 17, 16, 17, 16, 18, 17, 16], avg: 16.5 },
              { n: 'Olivier Tossou', grades: [13, 14, 12, 13, 14, 13, 14, 15, 13, 14], avg: 13.5 },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', left: 0, background: 'var(--surface-card)', borderRight: '1px solid var(--border-subtle)' }}>
                  <Avatar name={r.n} size="xs"/>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{r.n}</span>
                </td>
                {r.grades.map((g, j) => (
                  <td key={j} style={{ padding: '8px 8px', textAlign: 'center' }}>
                    {g == null ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span> :
                      <span className="tabular" style={{
                        fontSize: 12, fontWeight: 600,
                        color: g < 10 ? 'var(--danger-700)' : g >= 16 ? 'var(--success-700)' : 'var(--text-primary)',
                      }}>{Number.isInteger(g) ? g : g.toFixed(2).replace('.', ',')}</span>
                    }
                  </td>
                ))}
                <td style={{ padding: '8px 12px', textAlign: 'center', background: 'var(--brand-50)', position: 'sticky', right: 0, borderLeft: '1px solid var(--border-subtle)' }}>
                  <span className="display tabular" style={{ fontSize: 14, fontWeight: 700, color: r.avg >= 14 ? 'var(--success-700)' : r.avg < 10 ? 'var(--danger-700)' : 'var(--brand-800)' }}>
                    {r.avg.toFixed(1).replace('.', ',')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 32 }}>
          <div><span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Moyenne classe</span><div className="display tabular" style={{ fontSize: 20, fontWeight: 700 }}>14,2</div></div>
          <div><span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Médiane</span><div className="display tabular" style={{ fontSize: 20, fontWeight: 700 }}>14,0</div></div>
          <div><span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Plus haute</span><div className="display tabular" style={{ fontSize: 20, fontWeight: 700, color: 'var(--success-700)' }}>18,0</div></div>
          <div><span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Sous la moyenne</span><div className="display tabular" style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger-700)' }}>4</div></div>
        </div>
        <Button size="md" icon="check">Verrouiller le trimestre</Button>
      </div>
    </Card>
  </DashShell>
);

// ─── 2 · FINANCE (Recouvrement) ─────────────────────────────
const FinancePage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 6 }))}>
    <PageTitle title="Finance · Recouvrement" sub="Trimestre 2 · 1 248 élèves · 14 paiements en retard"
      breadcrumb={['Finance', 'Recouvrement T2']}>
      <Button variant="secondary" icon="sms">Relance SMS bulk</Button>
      <Button variant="secondary" icon="download">Export comptable</Button>
      <Button icon="money">Encaisser</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Encaissé T2" value="248,5" unit="M FCFA" trend={6.1} icon="money" variant="success"/>
      <MetricCard label="En retard +15j" value="34,2" unit="M FCFA" trend={null} icon="warning" variant="warning"/>
      <MetricCard label="À recouvrer" value="54,8" unit="M FCFA" trend={null} icon="clock" variant="info"/>
      <MetricCard label="Taux" value="82" unit="%" trend={6.1} icon="check" variant="brand"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Dossiers en retard · 14</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip active>Tous</Chip>
            <Chip count={6}>+15j</Chip>
            <Chip count={5}>+30j</Chip>
            <Chip count={3}>+60j</Chip>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--surface-sunken)', textAlign: 'left' }}>
            {['Famille', 'Classe', 'Montant', 'Retard', 'Dernière relance', 'Action'].map(h => (
              <th key={h} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              { f: 'Famille Sossou', e: '2 enfants', c: '4ᵉ B + CM1', m: '220 000', r: 28, l: 'SMS · hier' },
              { f: 'Famille Bio', e: '1 enfant', c: '6ᵉ A', m: '125 000', r: 42, l: 'Appel · 3j' },
              { f: 'Famille Padonou', e: '3 enfants', c: '3ᵉ + 5ᵉ + CE1', m: '345 000', r: 18, l: 'SMS · auto' },
              { f: 'Famille Adissi', e: '1 enfant', c: '2nde C', m: '145 000', r: 62, l: 'Échéancier signé' },
              { f: 'Famille Houngbedji', e: '2 enfants', c: '3ᵉ A + 6ᵉ C', m: '220 000', r: 22, l: 'WhatsApp · 5j' },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={r.f} size="sm"/>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.f}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.e}</div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.c}</td>
                <td style={{ padding: '12px 14px' }}><span className="display tabular" style={{ fontSize: 14, fontWeight: 700 }}>{r.m}</span><span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>FCFA</span></td>
                <td style={{ padding: '12px 14px' }}>
                  <Badge variant={r.r > 60 ? 'danger' : r.r > 30 ? 'warning' : 'info'} size="sm">+{r.r}j</Badge>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-tertiary)' }}>{r.l}</td>
                <td style={{ padding: '12px 14px' }}><Button variant="secondary" size="sm" icon="sms">Relancer</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Modes de paiement · T2</SubLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {[
              { l: 'Mobile Money (MTN/Moov)', v: 48, c: 'brand' },
              { l: 'Flutterwave (carte)', v: 26, c: 'info' },
              { l: 'Paystack (carte)', v: 14, c: 'success' },
              { l: 'Virement bancaire', v: 8, c: 'warning' },
              { l: 'Espèces', v: 4, c: 'neutral' },
            ].map(m => <Progress key={m.l} label={m.l} sublabel={m.v + '%'} value={m.v} variant={m.c}/>)}
          </div>
        </Card>
        <Card>
          <SubLabel>Encaissements · 6 derniers mois</SubLabel>
          <div className="display tabular" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>248,5<span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>M FCFA</span></div>
          <div style={{ marginTop: 10 }}><Sparkline data={[28, 32, 45, 38, 55, 50]} color="var(--brand-700)" height={56}/></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
            <span>Déc</span><span>Jan</span><span>Fév</span><span>Mar</span><span>Avr</span><span>Mai</span>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 3 · ATTENDANCE (Appel quotidien — détail) ───────────────
const AttendancePage = () => (
  <DashShell role="ENSEIGNANT" user="M. Adjavon" nav={directorNav.map((n, i) => ({ ...n, active: i === 5 }))}>
    <PageTitle title="Appel quotidien" sub="Mardi 5 mai · 4ᵉ B · 8h00–9h00 · Salle 207"
      breadcrumb={['Présences', '4ᵉ B', 'Mardi 5 mai']}>
      <Button variant="secondary" icon="download">Export PDF</Button>
      <Button icon="check">Valider · 28 élèves</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <Card padding={14} style={{ background: 'var(--success-50)', border: 0 }}>
        <SubLabel>Présents</SubLabel>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span className="display tabular" style={{ fontSize: 36, fontWeight: 700, color: 'var(--success-800)' }}>25</span>
          <span style={{ fontSize: 12, color: 'var(--success-700)' }}>/ 28</span>
        </div>
      </Card>
      <Card padding={14} style={{ background: 'var(--warning-50)', border: 0 }}>
        <SubLabel>Retards</SubLabel>
        <span className="display tabular" style={{ fontSize: 36, fontWeight: 700, color: 'var(--warning-800)' }}>2</span>
      </Card>
      <Card padding={14} style={{ background: 'var(--danger-50)', border: 0 }}>
        <SubLabel>Absents</SubLabel>
        <span className="display tabular" style={{ fontSize: 36, fontWeight: 700, color: 'var(--danger-800)' }}>1</span>
      </Card>
      <Card padding={14}>
        <SubLabel>Taux du jour</SubLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <RingProgress value={89} size={48} variant="success">
            <span className="tabular" style={{ fontSize: 11, fontWeight: 700 }}>89%</span>
          </RingProgress>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>vs 92% moyenne semaine</span>
        </div>
      </Card>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
          <Input icon="search" placeholder="Filtrer élève…" style={{ flex: 1 }}/>
          <Button variant="ghost" size="sm">Tout présent</Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
          {[
            { n: 'Aïcha Hounsou', s: 'present' }, { n: 'Mathieu Sossou', s: 'present' },
            { n: 'Fatou Adjavon', s: 'late', note: '+8 min' }, { n: 'Koffi Dossou', s: 'absent', note: 'Justifié · médecin' },
            { n: 'Marie Bossou', s: 'present' }, { n: 'Jean-Paul Bio', s: 'present' },
            { n: 'Aminatou Coffi', s: 'late', note: '+3 min' }, { n: 'Serge Padonou', s: 'present' },
            { n: 'Lucie Houngbedji', s: 'present' }, { n: 'Pierre Akin', s: 'present' },
            { n: 'Yvette Adissi', s: 'present' }, { n: 'Olivier Tossou', s: 'present' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: i > 1 ? '1px solid var(--border-subtle)' : 0, borderLeft: i % 2 ? '1px solid var(--border-subtle)' : 0 }}>
              <Avatar name={r.n} size="xs"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.n}</div>
                {r.note && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.note}</div>}
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[{ k: 'present', l: 'P', c: 'success' }, { k: 'late', l: 'R', c: 'warning' }, { k: 'absent', l: 'A', c: 'danger' }].map(b => {
                  const active = r.s === b.k;
                  return <button key={b.k} style={{
                    width: 28, height: 28, borderRadius: 8,
                    border: active ? 0 : '1px solid var(--border-default)',
                    background: active ? `var(--${b.c}-600)` : 'transparent',
                    color: active ? '#fff' : 'var(--text-tertiary)',
                    fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{b.l}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-200)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Icon name="warning" size={18} color="var(--warning-700)"/>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning-900)' }}>Élève à risque détecté</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--warning-800)', margin: 0, lineHeight: 1.55 }}>
            <strong>Koffi Dossou</strong> · 3ᵉ absence cette semaine. Un SMS sera envoyé au parent dans 2h sauf justificatif.
          </p>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <Button size="sm" variant="secondary">Voir dossier</Button>
            <Button size="sm" variant="ghost">Annuler le SMS</Button>
          </div>
        </Card>
        <Card>
          <SubLabel>Tendance · 4 dernières semaines</SubLabel>
          <Sparkline data={[94, 92, 91, 89]} color="var(--brand-700)" height={56}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
            <span>S5</span><span>S6</span><span>S7</span><span>S8</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--warning-700)' }}>
            <Icon name="arrowDown" size={12}/>Présence en baisse · enquête recommandée
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 4 · HEALTH / MEDICAL ──────────────────────────────────
const HealthPage = () => (
  <DashShell role="INFIRMIÈRE" user="Mme Sossou" nav={directorNav.map((n, i) => ({ ...n, active: i === 8 }))}>
    <PageTitle title="Santé & incidents" sub="Infirmerie · Cours Bénin Excellence · 5 fiches actives"
      breadcrumb={['Vie scolaire', 'Santé']}>
      <Button variant="secondary" icon="download">Registre PDF</Button>
      <Button icon="plus">Nouvel incident</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Incidents ouverts" value="5" trend={-37} icon="danger" variant="warning"/>
      <MetricCard label="Visites cette semaine" value="28" icon="info" variant="info"/>
      <MetricCard label="Élèves suivis" value="14" icon="users" variant="brand"/>
      <MetricCard label="Vaccins à jour" value="96" unit="%" trend={2.1} icon="check" variant="success"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Incidents récents</h3>
        </div>
        <div>
          {[
            { t: 'Chute dans la cour · Marie Bossou (CE2-A)', d: 'Genou écorché. Désinfecté. Surveillance 24h.', time: '10h45 · aujourd\'hui', v: 'danger', state: 'En cours' },
            { t: 'Mal de tête · Aïcha Hounsou (3ᵉ A)', d: 'Repos infirmerie 30min. Parent prévenu.', time: '9h20 · aujourd\'hui', v: 'warning', state: 'Suivi' },
            { t: 'Crise d\'asthme · Pierre Akin (4ᵉ B)', d: 'Ventoline administrée. RAS depuis.', time: 'Hier 14h', v: 'warning', state: 'Clos' },
            { t: 'Coupure légère · Lucie Houngbedji (3ᵉ A)', d: 'Pansement. Parent informé via SMS.', time: 'Hier 11h', v: 'info', state: 'Clos' },
          ].map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 14, padding: '14px 20px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `var(--${it.v}-50)`, display: 'grid', placeItems: 'center' }}>
                <Icon name="danger" size={16} color={`var(--${it.v}-700)`}/>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{it.t}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{it.d}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{it.time}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <Badge variant={it.state === 'En cours' ? 'danger' : it.state === 'Suivi' ? 'warning' : 'success'} size="sm">{it.state}</Badge>
                <Button variant="ghost" size="sm" iconRight="arrowRight">Fiche</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Conditions chroniques · suivi</SubLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
            {[
              { c: 'Asthme', n: 6, color: 'warning' },
              { c: 'Allergie alimentaire', n: 4, color: 'danger' },
              { c: 'Drépanocytose', n: 2, color: 'info' },
              { c: 'Diabète type 1', n: 1, color: 'brand' },
              { c: 'Épilepsie', n: 1, color: 'warning' },
            ].map(c => (
              <div key={c.c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--${c.color}-500)` }}/>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.c}</span>
                </div>
                <span className="tabular" style={{ fontSize: 13, fontWeight: 700 }}>{c.n}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SubLabel>Calendrier vaccinal · au jour</SubLabel>
          <RingProgress value={96} size={80} variant="success" style={{ margin: '8px auto' }}>
            <span className="display tabular" style={{ fontSize: 18, fontWeight: 700 }}>96%</span>
          </RingProgress>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', margin: '4px 0 0' }}>50 élèves nécessitent un rappel</p>
          <Button variant="secondary" size="sm" full style={{ marginTop: 12 }}>Envoyer rappels parents</Button>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 5 · AI ASSISTANT ──────────────────────────────────────
const AIPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 11 }))}>
    <PageTitle title="Assistant IA" sub="Insights, recommandations & génération de contenu pédagogique"
      breadcrumb={['Outils', 'Assistant IA']}>
      <Badge variant="brand" icon="sparkle">Bêta · IA locale</Badge>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
      {[
        { i: 'warning', t: 'Décrochage détecté', s: '3 élèves de 3ᵉ A · math', c: 'warning' },
        { i: 'chart', t: 'Tendance positive', s: 'CM2-A · +2,1 pts en français', c: 'success' },
        { i: 'sms', t: 'Suggestion SMS', s: '8 parents · paiement T2', c: 'brand' },
      ].map((k, i) => (
        <Card key={i} style={{ borderLeft: `3px solid var(--${k.c}-600)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Icon name={k.i} size={16} color={`var(--${k.c}-700)`}/>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{k.t}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{k.s}</p>
          <Button variant="ghost" size="sm" iconRight="arrowRight" style={{ marginTop: 8, marginLeft: -8 }}>Voir détail</Button>
        </Card>
      ))}
    </div>

    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--gradient-cta)', display: 'grid', placeItems: 'center' }}>
          <Icon name="sparkle" size={16} color="#fff"/>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Conversation avec EduPilot AI</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Vos données restent locales · jamais envoyées à OpenAI</div>
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 360 }}>
        {/* user */}
        <div style={{ display: 'flex', gap: 12, alignSelf: 'flex-end', maxWidth: '78%' }}>
          <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', padding: '10px 14px', borderRadius: 16, borderBottomRightRadius: 4, fontSize: 13, lineHeight: 1.55 }}>
            Pourquoi les notes de math en 3ᵉ A baissent depuis 2 semaines ?
          </div>
          <Avatar name="Marie Akpovi" size="sm"/>
        </div>
        {/* ai */}
        <div style={{ display: 'flex', gap: 12, alignSelf: 'flex-start', maxWidth: '85%' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-cta)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="sparkle" size={14} color="#fff"/>
          </div>
          <div style={{ background: 'var(--surface-sunken)', padding: '12px 16px', borderRadius: 16, borderBottomLeftRadius: 4, fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <p style={{ margin: '0 0 10px' }}>D'après les données des 14 derniers jours, 3 facteurs concomitants :</p>
            <ul style={{ paddingLeft: 18, margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong>Chapitre fonctions affines</strong> — moyenne classe 11,2 vs 14,8 sur le précédent.</li>
              <li><strong>3 élèves en décrochage</strong> : Aïcha H., Pierre A., Yvette A.</li>
              <li><strong>Corrélation</strong> : ces 3 élèves ont aussi 2+ absences sur la période.</li>
            </ul>
            <div style={{ padding: 12, background: 'var(--brand-50)', borderRadius: 10, fontSize: 12 }}>
              <strong style={{ color: 'var(--brand-800)' }}>💡 Recommandation :</strong> séance de soutien ciblée vendredi avant le DST. Je peux générer le contenu.
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <Button size="sm" variant="soft" icon="sparkle">Générer le soutien</Button>
              <Button size="sm" variant="ghost">Envoyer aux 3 parents</Button>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Input icon="sparkle" placeholder="Posez une question à l'IA… (ex : 'meilleurs élèves en français au T1')" style={{ flex: 1 }}/>
        <Button icon="arrowRight" size="md" style={{ background: 'var(--gradient-cta)' }}>Envoyer</Button>
      </div>
    </Card>
  </DashShell>
);

// ─── 6 · SCHEDULE (Emploi du temps) ─────────────────────────
const SchedulePage = () => {
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const hours = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
  const subjects = {
    'Lundi-08:00': { s: 'Math', t: 'M. Adjavon', r: 'S.207', c: 'info', span: 2 },
    'Lundi-10:00': { s: 'Français', t: 'Mme Bio', r: 'S.204', c: 'brand', span: 1 },
    'Lundi-11:00': { s: 'Histoire-Géo', t: 'M. Dossou', r: 'S.301', c: 'warning', span: 1 },
    'Lundi-14:00': { s: 'SVT', t: 'Mme Hounsou', r: 'Labo', c: 'success', span: 2 },
    'Mardi-08:00': { s: 'EPS', t: 'M. Coffi', r: 'Terrain', c: 'success', span: 2 },
    'Mardi-10:00': { s: 'Math', t: 'M. Adjavon', r: 'S.207', c: 'info', span: 1 },
    'Mardi-14:00': { s: 'Anglais', t: 'Mme Akin', r: 'S.105', c: 'brand', span: 1 },
    'Mardi-15:00': { s: 'Arts', t: 'Mme Bossou', r: 'Atelier', c: 'warning', span: 2 },
    'Mercredi-08:00': { s: 'Math', t: 'M. Adjavon', r: 'S.207', c: 'info', span: 1 },
    'Mercredi-09:00': { s: 'Français', t: 'Mme Bio', r: 'S.204', c: 'brand', span: 2 },
    'Mercredi-11:00': { s: 'Latin', t: 'M. Padonou', r: 'S.108', c: 'neutral', span: 1 },
    'Jeudi-08:00': { s: 'Physique', t: 'M. Tossou', r: 'Labo', c: 'info', span: 2 },
    'Jeudi-10:00': { s: 'Math', t: 'M. Adjavon', r: 'S.207', c: 'info', span: 1 },
    'Jeudi-14:00': { s: 'Français', t: 'Mme Bio', r: 'S.204', c: 'brand', span: 2 },
    'Jeudi-16:00': { s: 'Étude', t: 'Surv.', r: 'Bibli.', c: 'neutral', span: 1 },
    'Vendredi-08:00': { s: 'Anglais', t: 'Mme Akin', r: 'S.105', c: 'brand', span: 1 },
    'Vendredi-09:00': { s: 'Math', t: 'M. Adjavon', r: 'S.207', c: 'info', span: 1 },
    'Vendredi-10:00': { s: 'DST Math', t: 'M. Adjavon', r: 'S.207', c: 'danger', span: 2 },
    'Vendredi-14:00': { s: 'Histoire-Géo', t: 'M. Dossou', r: 'S.301', c: 'warning', span: 2 },
    'Samedi-08:00': { s: 'Soutien Math', t: 'M. Adjavon', r: 'S.207', c: 'success', span: 2 },
  };
  const skip = new Set();
  return (
    <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 7 }))}>
      <PageTitle title="Emploi du temps" sub="3ᵉ A · Semaine du 4 au 9 mai 2026"
        breadcrumb={['Pédagogie', 'Emplois du temps', '3ᵉ A']}>
        <Button variant="secondary" icon="filter">Vue enseignant</Button>
        <Button variant="secondary" icon="download">PDF</Button>
        <Button icon="pencil">Éditer (drag)</Button>
      </PageTitle>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(6, 1fr)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div/>
          {days.map(d => (
            <div key={d} style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', borderLeft: '1px solid var(--border-subtle)' }}>
              {d}
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 2 }}>{['4', '5', '6', '7', '8', '9'][days.indexOf(d)]} mai</div>
            </div>
          ))}
        </div>
        {hours.map((h, hi) => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '70px repeat(6, 1fr)', minHeight: 64, borderBottom: hi < hours.length - 1 ? '1px solid var(--border-subtle)' : 0 }}>
            <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }} className="mono">{h}</div>
            {days.map(d => {
              const key = `${d}-${h}`;
              if (skip.has(key)) return null;
              const slot = subjects[key];
              if (!slot) return <div key={key} style={{ borderLeft: '1px solid var(--border-subtle)', background: hi === 4 ? 'var(--surface-sunken)' : 'transparent' }}/>;
              if (slot.span > 1) {
                for (let k = 1; k < slot.span; k++) skip.add(`${d}-${hours[hi + k]}`);
              }
              return (
                <div key={key} style={{ borderLeft: '1px solid var(--border-subtle)', padding: 4, gridRow: `span ${slot.span}`, position: 'relative' }}>
                  <div style={{
                    height: '100%', minHeight: 64 * slot.span - 8,
                    padding: 10, borderRadius: 'var(--radius-md)',
                    background: `var(--${slot.c}-50)`,
                    borderLeft: `3px solid var(--${slot.c}-600)`,
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: `var(--${slot.c}-900)` }}>{slot.s}</span>
                    <span style={{ fontSize: 10, color: `var(--${slot.c}-800)`, opacity: 0.85 }}>{slot.t}</span>
                    <span style={{ fontSize: 10, color: `var(--${slot.c}-800)`, opacity: 0.7, marginTop: 'auto' }}>{slot.r}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </Card>
    </DashShell>
  );
};

// ─── 7 · LIBRARY ───────────────────────────────────────────
const LibraryPage = () => (
  <DashShell role="BIBLIOTHÉCAIRE" user="Mme Coffi" nav={directorNav.map((n, i) => ({ ...n, active: i === 10 }))}>
    <PageTitle title="Bibliothèque" sub="2 480 ouvrages · 142 emprunts en cours · 12 retards"
      breadcrumb={['Vie scolaire', 'Bibliothèque']}>
      <Button variant="secondary" icon="sms">Relancer retards</Button>
      <Button icon="plus">Nouveau prêt</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Ouvrages" value="2 480" icon="book" variant="brand"/>
      <MetricCard label="Emprunts actifs" value="142" trend={8} icon="cards" variant="info"/>
      <MetricCard label="Retards" value="12" trend={-25} icon="warning" variant="warning"/>
      <MetricCard label="Lecteurs actifs" value="438" trend={12} icon="users" variant="success"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)' }}>
          <Input icon="search" placeholder="Titre, ISBN, auteur…" style={{ flex: 1 }}/>
          <Chip active>Tous</Chip>
          <Chip>Roman</Chip>
          <Chip>Manuel</Chip>
          <Chip>BD</Chip>
        </div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { t: 'L\'enfant noir', a: 'Camara Laye', c: 'Roman', cover: '#8B5CF6', avail: '3/5' },
            { t: 'Une si longue lettre', a: 'Mariama Bâ', c: 'Roman', cover: '#EF4444', avail: '2/4' },
            { t: 'Math · 3ᵉ Hachette', a: 'Collectif', c: 'Manuel', cover: '#2563EB', avail: '12/26', urgent: true },
            { t: 'Aya de Yopougon', a: 'M. Abouet', c: 'BD', cover: '#F59E0B', avail: '4/6' },
            { t: 'Les Bouts de bois', a: 'Ousmane Sembène', c: 'Roman', cover: '#10B981', avail: '5/5' },
            { t: 'Le Vieux Nègre', a: 'Ferdinand Oyono', c: 'Roman', cover: '#6366F1', avail: '1/3' },
          ].map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: 10, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 56, height: 80, background: b.cover, borderRadius: 6, position: 'relative', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}>
                <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, height: 1, background: 'rgba(255,255,255,0.5)' }}/>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>{b.t}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{b.a}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge size="sm" variant="neutral">{b.c}</Badge>
                  <Badge size="sm" variant={b.urgent ? 'danger' : 'success'}>{b.avail}</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SubLabel>Retards · à relancer</SubLabel>
        {[
          { n: 'Aminatou Coffi', b: 'Une si longue lettre', d: '+12j' },
          { n: 'Serge Padonou', b: 'Math · 3ᵉ Hachette', d: '+8j' },
          { n: 'Pierre Akin', b: 'Aya de Yopougon', d: '+5j' },
          { n: 'Lucie Houngbedji', b: 'L\'enfant noir', d: '+3j' },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
            <Avatar name={r.n} size="sm"/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{r.n}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.b}</div>
            </div>
            <Badge variant="warning" size="sm">{r.d}</Badge>
          </div>
        ))}
        <Button variant="secondary" full size="sm" icon="sms" style={{ marginTop: 12 }}>Relancer les 4</Button>
      </Card>
    </div>
  </DashShell>
);

// ─── 8 · CAFETERIA ─────────────────────────────────────────
const CafeteriaPage = () => (
  <DashShell role="GESTIONNAIRE" user="Mme Adjavon" nav={directorNav.map((n, i) => ({ ...n, active: i === 9 }))}>
    <PageTitle title="Cantine" sub="Mardi 5 mai · 184 repas prévus · cuisine traditionnelle béninoise"
      breadcrumb={['Vie scolaire', 'Cantine']}>
      <Button variant="secondary" icon="pencil">Modifier le menu</Button>
      <Button icon="check">Valider le service</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Repas servis sem." value="847" trend={4} icon="cards" variant="brand"/>
      <MetricCard label="Aujourd'hui" value="184" icon="users" variant="info"/>
      <MetricCard label="Allergies déclarées" value="12" icon="warning" variant="warning"/>
      <MetricCard label="Coût moy./repas" value="425" unit="FCFA" trend={-2} icon="money" variant="success"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Menu de la semaine</h3>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Validé par la nutritionniste · cuisine traditionnelle locale</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { d: 'Lun', plat: 'Riz au gras', prot: 'Poulet braisé', side: 'Salade verte', avail: '✓' },
            { d: 'Mar', plat: 'Pâte rouge', prot: 'Poisson fumé', side: 'Légumes', avail: 'En cours', today: true },
            { d: 'Mer', plat: 'Akassa', prot: 'Sauce gombo', side: 'Banane', avail: 'À venir' },
            { d: 'Jeu', plat: 'Riz haricots', prot: 'Œuf', side: 'Sauce tomate', avail: 'À venir' },
            { d: 'Ven', plat: 'Wagasi', prot: 'Sauce arachide', side: 'Fonio', avail: 'À venir' },
          ].map((m, i) => (
            <div key={i} style={{ padding: 14, borderRight: i < 4 ? '1px solid var(--border-subtle)' : 0, background: m.today ? 'var(--brand-50)' : 'transparent' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: m.today ? 'var(--brand-700)' : 'var(--text-tertiary)' }}>{m.d}</div>
              <div className="display" style={{ fontSize: 14, fontWeight: 700, marginTop: 8, color: 'var(--text-primary)' }}>{m.plat}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{m.prot}<br/>{m.side}</div>
              <div style={{ marginTop: 10 }}>
                <Badge variant={m.today ? 'brand' : i === 0 ? 'success' : 'neutral'} size="sm">{m.avail}</Badge>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 20px', background: 'var(--surface-sunken)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div><span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Calories moy.</span><div className="display tabular" style={{ fontSize: 16, fontWeight: 700 }}>620 kcal</div></div>
          <div><span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Protéines</span><div className="display tabular" style={{ fontSize: 16, fontWeight: 700 }}>28g</div></div>
          <div><span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Coût total sem.</span><div className="display tabular" style={{ fontSize: 16, fontWeight: 700 }}>360k FCFA</div></div>
          <div><span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Origine locale</span><div className="display tabular" style={{ fontSize: 16, fontWeight: 700, color: 'var(--success-700)' }}>92%</div></div>
        </div>
      </Card>

      <Card>
        <SubLabel>Restrictions alimentaires · 12 élèves</SubLabel>
        <div style={{ marginTop: 8 }}>
          {[
            { c: 'Arachide', n: 4, color: 'danger' },
            { c: 'Lactose', n: 3, color: 'warning' },
            { c: 'Gluten', n: 2, color: 'warning' },
            { c: 'Halal uniquement', n: 28, color: 'info' },
            { c: 'Végétarien', n: 6, color: 'success' },
          ].map(r => (
            <div key={r.c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: `var(--${r.color}-500)` }}/>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{r.c}</span>
              <span className="tabular" style={{ fontSize: 13, fontWeight: 700 }}>{r.n}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: 12, background: 'var(--danger-50)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="warning" size={14} color="var(--danger-700)" style={{ marginTop: 2 }}/>
          <div style={{ fontSize: 12, color: 'var(--danger-800)', lineHeight: 1.5 }}>
            <strong>4 élèves avec allergie arachide</strong> · pâte au sésame préparée séparément ce mardi.
          </div>
        </div>
      </Card>
    </div>
  </DashShell>
);

Object.assign(window, {
  GradesPage, FinancePage, AttendancePage, HealthPage,
  AIPage, SchedulePage, LibraryPage, CafeteriaPage,
});
