// EduPilot — Student suite: Profil 360, Bulletin, Conseil de classe, Inscription

// ─── 1 · PROFIL ÉLÈVE 360° ──────────────────────────────────
const StudentProfile = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 2 }))}>
    <PageTitle title="Aïcha Hounsou" sub="3ᵉ A · 14 ans · matricule BJ-2026-A0142 · née le 12 mars 2012"
      breadcrumb={['Élèves', '3ᵉ A', 'Aïcha Hounsou']}>
      <Button variant="secondary" icon="download">Bulletin PDF</Button>
      <Button variant="secondary" icon="sms">Contacter parent</Button>
      <Button icon="pencil">Éditer</Button>
    </PageTitle>

    {/* Hero strip */}
    <Card padding={24} style={{ marginBottom: 14, background: 'linear-gradient(135deg, var(--brand-50), var(--neutral-100))', border: '1px solid var(--brand-200)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Avatar name="Aïcha Hounsou" size="xl" style={{ width: 96, height: 96 }}/>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Badge variant="success" icon="check">Inscrite · T2</Badge>
            <Badge variant="brand" icon="trophy">Top 5 classe</Badge>
            <Badge variant="warning" icon="flame">Série 14j</Badge>
          </div>
          <h2 className="display" style={{ fontSize: 28, margin: 0, fontWeight: 700, letterSpacing: '-0.025em' }}>Aïcha Hounsou</h2>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Boursière d'État · option scientifique · arrivée septembre 2023</div>
        </div>
        <div style={{ display: 'flex', gap: 32, paddingLeft: 24, borderLeft: '1px solid var(--border-subtle)' }}>
          {[
            { l: 'Moyenne T2', v: '14,8', c: 'success' },
            { l: 'Rang', v: '4/26', c: 'brand' },
            { l: 'Présence', v: '96%', c: 'success' },
            { l: 'Paiement', v: '✓ À jour', c: 'success' },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
              <div className="display tabular" style={{ fontSize: 24, fontWeight: 700, color: `var(--${s.c}-700)`, marginTop: 2 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>

    {/* Tabs */}
    <div style={{ display: 'flex', gap: 6, marginBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
      {['Vue 360°', 'Notes', 'Présences', 'Finance', 'Santé', 'Discipline', 'Dossier'].map((t, i) => (
        <button key={t} style={{
          padding: '10px 14px', background: 'transparent', border: 0,
          borderBottom: `2px solid ${i === 0 ? 'var(--brand-700)' : 'transparent'}`,
          color: i === 0 ? 'var(--brand-700)' : 'var(--text-secondary)',
          fontFamily: 'inherit', fontSize: 13, fontWeight: i === 0 ? 700 : 500, cursor: 'pointer',
        }}>{t}</button>
      ))}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Performances par matière · T2</h3>
            <Badge variant="success" size="sm">+0,6 pts vs T1</Badge>
          </div>
          {[
            { s: 'Mathématiques', n: 16.5, c: 4, t: +1.2, v: 'success' },
            { s: 'Français', n: 13.0, c: 4, t: -0.4, v: 'warning' },
            { s: 'SVT', n: 17.0, c: 3, t: +1.8, v: 'success' },
            { s: 'Anglais', n: 15.0, c: 2, t: 0, v: 'brand' },
            { s: 'Histoire-Géo', n: 14.5, c: 3, t: +0.3, v: 'brand' },
            { s: 'Physique-Chimie', n: 15.5, c: 3, t: +0.8, v: 'success' },
            { s: 'EPS', n: 14.0, c: 1, t: 0, v: 'neutral' },
            { s: 'Arts plastiques', n: 17.5, c: 1, t: +2.0, v: 'success' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 50px', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{m.s}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>coef. {m.c}</span>
              <div style={{ height: 4, background: 'var(--neutral-200)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (m.n / 20 * 100) + '%', background: `var(--${m.v}-500)` }}/>
              </div>
              <span className="display tabular" style={{ fontSize: 14, fontWeight: 700, color: `var(--${m.v}-700)`, textAlign: 'right' }}>
                {m.n.toFixed(1).replace('.', ',')}
              </span>
            </div>
          ))}
        </Card>

        <Card>
          <SubLabel><span data-period="trimestre">Évolution sur 3 trimestres</span><span data-period="semestre">Évolution sur 2 semestres</span></SubLabel>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 14, height: 120 }}>
            {[
              { t: 'T1 2024', v: 12.5 }, { t: 'T2 2024', v: 13.0 }, { t: 'T3 2024', v: 13.4 },
              { t: 'T1 2025', v: 14.2 }, { t: 'T2 2025', v: 14.8 },
            ].map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span className="tabular" style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-700)' }}>{b.v.toFixed(1).replace('.', ',')}</span>
                <div style={{ width: '60%', height: (b.v / 20 * 100) + '%', background: i === 4 ? 'var(--brand-700)' : 'var(--brand-300)', borderRadius: '6px 6px 0 0', minHeight: 40 }}/>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{b.t}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Famille & contacts</SubLabel>
          {[
            { n: 'M. Patrick Hounsou', r: 'Père', t: '+229 95 12 34 56', s: 'WhatsApp · lu' },
            { n: 'Mme Adèle Hounsou', r: 'Mère', t: '+229 97 88 12 30', s: 'SMS · lu' },
            { n: 'Mathieu Hounsou', r: 'Frère · CM1', t: '—', s: 'Même école' },
          ].map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <Avatar name={p.n} size="sm"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.n}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.r} · {p.t}</div>
              </div>
              <Badge variant="success" size="sm" dot>{p.s.split(' · ')[1] || p.s}</Badge>
            </div>
          ))}
        </Card>

        <Card>
          <SubLabel>Suivi médical</SubLabel>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6 }}>
            <strong style={{ color: 'var(--warning-700)' }}>Asthme léger</strong> · Ventoline en cas de besoin (infirmerie).
            <br/>Vaccination à jour · contrôle annuel oct. 2026.
          </div>
        </Card>

        <Card style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={16} color="var(--brand-700)" style={{ marginTop: 2 }}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-900)', marginBottom: 4 }}>Recommandation IA</div>
              <p style={{ fontSize: 12, color: 'var(--brand-800)', margin: 0, lineHeight: 1.5 }}>
                Aïcha excelle en sciences et arts. Profil "scientifique créatif" — suggestion : orientation 2nde D
                (sciences expérimentales).
              </p>
              <Button variant="soft" size="sm" style={{ marginTop: 10, background: '#fff', color: 'var(--brand-700)' }}>Discuter orientation</Button>
            </div>
          </div>
        </Card>

        <Card>
          <SubLabel>Activités récentes</SubLabel>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            <div>• DST Math · 16,5/20 · <span className="mono">2h</span></div>
            <div>• Présence confirmée · <span className="mono">8h00</span></div>
            <div>• Paiement T2 reçu · <span className="mono">hier</span></div>
            <div>• Badge "Top 5" obtenu · <span className="mono">3j</span></div>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 2 · BULLETIN TRIMESTRIEL (Print-ready) ─────────────────
const Bulletin = () => (
  <div style={{ width: 794, minHeight: 1123, padding: 48, background: '#fff', color: '#0F172A', fontFamily: 'var(--font-body)', position: 'relative', boxShadow: 'var(--shadow-lg)' }}>
    {/* Header */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 18, borderBottom: '2px solid var(--brand-700)', marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <Logo size={56}/>
        <div>
          <div className="display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Cours Bénin Excellence</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Cotonou · Akpakpa · Code MEMP BJ-COT-0142</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Tél +229 21 30 12 12 · contact@cbe.bj</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="display" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <span data-period="trimestre">Bulletin du 2ᵉ trimestre</span>
          <span data-period="semestre">Bulletin du 1ˢᵉ semestre</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Année 2025 — 2026 · édité le 5 mai 2026</div>
        <div className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
          <span data-period="trimestre">Réf. BJ-2026-T2-A0142</span>
          <span data-period="semestre">Réf. BJ-2026-S1-A0142</span>
        </div>
      </div>
    </div>

    {/* Student card */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: 14, background: 'var(--brand-50)', borderRadius: 10, marginBottom: 20, gap: 16 }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Élève</div>
        <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>HOUNSOU Aïcha</div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>née le 12/03/2012</div>
      </div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Classe</div>
        <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>3ᵉ A · 26 élèves</div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Prof. principal : M. Adjavon</div>
      </div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Matricule</div>
        <div className="mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>BJ-2026-A0142</div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Statut : régulier · boursière</div>
      </div>
    </div>

    {/* Grades table */}
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 20 }}>
      <thead>
        <tr style={{ background: 'var(--neutral-900)', color: '#fff' }}>
          {['Matière', 'Coef.', 'Moy. T1', 'Moy. T2', 'Moy. classe', 'Min · Max', 'Appréciation'].map(h => (
            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[
          { s: 'Mathématiques', c: 4, t1: 15.2, t2: 16.5, cm: 12.8, mn: 7, mx: 18, a: 'Excellents résultats. Continuer.' },
          { s: 'Français', c: 4, t1: 14.0, t2: 13.0, cm: 13.5, mn: 8, mx: 17, a: 'Légère baisse. Soigner l\'expression.' },
          { s: 'Anglais', c: 2, t1: 15.0, t2: 15.0, cm: 13.2, mn: 9, mx: 17, a: 'Régulière et appliquée.' },
          { s: 'Histoire-Géographie', c: 3, t1: 14.2, t2: 14.5, cm: 13.0, mn: 8, mx: 16, a: 'Bonne participation orale.' },
          { s: 'SVT', c: 3, t1: 15.5, t2: 17.0, cm: 14.1, mn: 9, mx: 18, a: 'Élève brillante en biologie.' },
          { s: 'Physique-Chimie', c: 3, t1: 14.5, t2: 15.5, cm: 12.6, mn: 7, mx: 17, a: 'Très satisfaisant.' },
          { s: 'EPS', c: 1, t1: 14.0, t2: 14.0, cm: 13.8, mn: 10, mx: 17, a: 'Sérieuse et engagée.' },
          { s: 'Arts plastiques', c: 1, t1: 15.0, t2: 17.5, cm: 14.5, mn: 12, mx: 18, a: 'Talent évident.' },
        ].map((r, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--neutral-200)' }}>
            <td style={{ padding: '9px 10px', fontWeight: 600 }}>{r.s}</td>
            <td style={{ padding: '9px 10px' }} className="tabular">{r.c}</td>
            <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }} className="tabular">{r.t1.toFixed(2).replace('.', ',')}</td>
            <td style={{ padding: '9px 10px', fontWeight: 700, color: r.t2 >= 14 ? 'var(--success-700)' : r.t2 < 10 ? 'var(--danger-700)' : 'var(--text-primary)' }} className="tabular">{r.t2.toFixed(2).replace('.', ',')}</td>
            <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }} className="tabular">{r.cm.toFixed(2).replace('.', ',')}</td>
            <td style={{ padding: '9px 10px', color: 'var(--text-tertiary)', fontSize: 10 }} className="tabular">{r.mn}—{r.mx}</td>
            <td style={{ padding: '9px 10px', fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{r.a}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ background: 'var(--brand-50)' }}>
          <td style={{ padding: '12px 10px', fontWeight: 800 }}>MOYENNE GÉNÉRALE</td>
          <td style={{ padding: '12px 10px' }} className="tabular"><strong>21</strong></td>
          <td style={{ padding: '12px 10px' }} className="tabular"><strong>14,2</strong></td>
          <td style={{ padding: '12px 10px', fontSize: 16, color: 'var(--brand-800)' }} className="tabular"><strong>14,8</strong></td>
          <td style={{ padding: '12px 10px' }} className="tabular"><strong>13,2</strong></td>
          <td colSpan={2} style={{ padding: '12px 10px', textAlign: 'right' }}>Rang : <strong style={{ fontSize: 14 }}>4 / 26</strong></td>
        </tr>
      </tfoot>
    </table>

    {/* Discipline + appreciation */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 20 }}>
      <div style={{ padding: 14, border: '1px solid var(--neutral-200)', borderRadius: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vie scolaire</div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Absences : <strong>2 demi-journées</strong> (justifiées)<br/>
          Retards : <strong>0</strong><br/>
          Sanctions : <strong>aucune</strong><br/>
          Encouragements : <strong style={{ color: 'var(--success-700)' }}>Tableau d'honneur</strong>
        </div>
      </div>
      <div style={{ padding: 14, border: '1px solid var(--neutral-200)', borderRadius: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Appréciation du conseil de classe</div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.65, fontStyle: 'italic' }}>
          <span data-period="trimestre">Trimestre très satisfaisant.</span><span data-period="semestre">Semestre très satisfaisant.</span> Aïcha confirme son potentiel scientifique avec d'excellents résultats en mathématiques,
          SVT et physique. Elle doit consolider l'expression écrite en français. <strong>Félicitations du conseil de classe.</strong>
        </div>
      </div>
    </div>

    {/* Signatures */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 32 }}>
      {[
        { l: 'Le professeur principal', n: 'M. Paul Adjavon' },
        { l: 'La Directrice', n: 'Mme Marie Akpovi' },
        { l: 'Le parent / tuteur', n: 'M. Patrick Hounsou' },
      ].map(s => (
        <div key={s.l} style={{ paddingTop: 24, borderTop: '1px solid var(--neutral-300)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.l}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{s.n}</div>
        </div>
      ))}
    </div>

    {/* Footer */}
    <div style={{ position: 'absolute', bottom: 20, left: 48, right: 48, paddingTop: 12, borderTop: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-tertiary)' }}>
      <span>EduPilot v2.0 · document authentique · vérifiable sur edupilot.bj/v/BJ-2026-T2-A0142</span>
      <span className="mono">QR · #A0142-T2</span>
    </div>
  </div>
);

// ─── 3 · CONSEIL DE CLASSE ──────────────────────────────────
const ClassCouncil = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 3 }))}>
    <PageTitle title="Conseil de classe · 3ᵉ A" sub="Jeudi 7 mai · 16h00 · salle des professeurs · 16 enseignants attendus"
      breadcrumb={['Pédagogie', 'Conseils de classe', '3ᵉ A · T2']}>
      <Button variant="secondary" icon="download">Bulletins ZIP</Button>
      <Button icon="check">Clôturer le conseil</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Bulletins prêts" value="22/26" icon="cards" variant="brand"/>
      <MetricCard label="Tableau d'honneur" value="6" icon="trophy" variant="success"/>
      <MetricCard label="Encouragements" value="4" icon="sparkle" variant="info"/>
      <MetricCard label="Avertissements" value="2" icon="warning" variant="warning"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Élèves · validation bulletins</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip active>Tous</Chip>
            <Chip count={6}>Honneur</Chip>
            <Chip count={4}>Encour.</Chip>
            <Chip count={2}>Avert.</Chip>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--surface-sunken)' }}>
            {['Élève', 'Moy.', 'Rang', 'Décision', 'Statut'].map(h => (
              <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              { n: 'Marie Bossou', m: 18.0, r: 1, d: 'Tableau d\'honneur', dv: 'success', s: 'Validé', sv: 'success' },
              { n: 'Yvette Adissi', m: 16.5, r: 2, d: 'Tableau d\'honneur', dv: 'success', s: 'Validé', sv: 'success' },
              { n: 'Aïcha Hounsou', m: 14.8, r: 4, d: 'Encouragements', dv: 'info', s: 'En discussion', sv: 'warning' },
              { n: 'Fatou Adjavon', m: 14.6, r: 5, d: 'Encouragements', dv: 'info', s: 'Validé', sv: 'success' },
              { n: 'Mathieu Sossou', m: 13.4, r: 11, d: 'Aucune', dv: 'neutral', s: 'Validé', sv: 'success' },
              { n: 'Pierre Akin', m: 12.8, r: 14, d: 'Aucune', dv: 'neutral', s: 'À saisir', sv: 'neutral' },
              { n: 'Serge Padonou', m: 10.5, r: 22, d: 'Avertissement travail', dv: 'warning', s: 'En discussion', sv: 'warning' },
              { n: 'Koffi Dossou', m: 11.0, r: 21, d: 'Avertissement conduite', dv: 'danger', s: 'En discussion', sv: 'warning' },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={r.n} size="sm"/>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.n}</span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span className="display tabular" style={{ fontSize: 14, fontWeight: 700, color: r.m >= 14 ? 'var(--success-700)' : r.m < 10 ? 'var(--danger-700)' : 'var(--text-primary)' }}>{r.m.toFixed(1).replace('.', ',')}</span>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>{r.r}</td>
                <td style={{ padding: '12px 14px' }}><Badge variant={r.dv} size="sm">{r.d}</Badge></td>
                <td style={{ padding: '12px 14px' }}>
                  {r.sv === 'success' && <Badge variant="success" size="sm" icon="check">{r.s}</Badge>}
                  {r.sv === 'warning' && <Badge variant="warning" size="sm" dot>{r.s}</Badge>}
                  {r.sv === 'neutral' && <Badge variant="neutral" size="sm">{r.s}</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Participants · 14 / 16 confirmés</SubLabel>
          <div style={{ display: 'flex', marginTop: 8, flexWrap: 'wrap', gap: 0 }}>
            {['M. Adjavon', 'Mme Bio', 'M. Dossou', 'Mme Hounsou', 'Mme Akin', 'M. Coffi', 'Mme Bossou', 'M. Padonou'].map((n, i) => (
              <div key={i} style={{ marginLeft: i ? -8 : 0, boxShadow: '0 0 0 2px var(--surface-card)', borderRadius: '50%' }}>
                <Avatar name={n} size="sm" status={i < 6 ? 'online' : 'away'}/>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10 }}>2 enseignants en attente de confirmation</div>
        </Card>

        <Card>
          <SubLabel>Statistiques classe · T2</SubLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 8 }}>
            {[
              { l: 'Moyenne', v: '14,2', c: 'brand' },
              { l: 'Médiane', v: '14,0', c: 'info' },
              { l: '% ≥ 14', v: '54%', c: 'success' },
              { l: '% < 10', v: '15%', c: 'warning' },
            ].map(s => (
              <div key={s.l} style={{ padding: 10, background: `var(--${s.c}-50)`, borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: `var(--${s.c}-800)`, fontWeight: 600 }}>{s.l}</div>
                <div className="display tabular" style={{ fontSize: 22, fontWeight: 700, color: `var(--${s.c}-800)`, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SubLabel>Décisions en attente · 4</SubLabel>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>Aïcha Hounsou · Encouragements à confirmer après vote</div>
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>Pierre Akin · décision à saisir</div>
            <div style={{ padding: '8px 0' }}>Koffi Dossou · entretien parents recommandé</div>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 4 · INSCRIPTION / RÉINSCRIPTION (Long form) ────────────
const Inscription = () => (
  <DashShell role="SECRÉTAIRE" user="Mme Bio" nav={directorNav.map((n, i) => ({ ...n, active: i === 2 }))}>
    <PageTitle title="Nouvelle inscription" sub="Année 2026-2027 · pré-inscription en ligne · vérification documents"
      breadcrumb={['Élèves', 'Inscriptions', 'Nouveau dossier']}>
      <Button variant="ghost">Annuler</Button>
      <Button variant="secondary">Enregistrer brouillon</Button>
      <Button icon="check">Finaliser</Button>
    </PageTitle>

    {/* Stepper */}
    <Card padding={20} style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {['Identité élève', 'Famille', 'Cursus & classe', 'Documents', 'Paiement initial'].map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 15,
                background: i < 2 ? 'var(--success-600)' : i === 2 ? 'var(--brand-700)' : 'var(--neutral-200)',
                color: i <= 2 ? '#fff' : 'var(--text-tertiary)',
                display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
              }}>{i < 2 ? <Icon name="check" size={14} strokeWidth={3}/> : i + 1}</div>
              <span style={{ fontSize: 12, fontWeight: i === 2 ? 700 : 500, color: i === 2 ? 'var(--brand-800)' : i < 2 ? 'var(--success-700)' : 'var(--text-tertiary)' }}>{s}</span>
            </div>
            {i < 4 && <div style={{ flex: 1, height: 2, background: i < 2 ? 'var(--success-300)' : 'var(--neutral-200)', margin: '0 12px' }}/>}
          </React.Fragment>
        ))}
      </div>
    </Card>

    {/* Form: étape 3 */}
    <Card padding={28}>
      <h3 className="display" style={{ fontSize: 18, margin: '0 0 6px' }}>Cursus & affectation</h3>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 22px' }}>Sélectionnez la classe d'affectation et le parcours pédagogique.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
        <Input label="École précédente" icon="school" value="EPP Akpakpa centre"/>
        <Input label="Dernier niveau validé" value="CM2 (moyenne 13,4)"/>
        <Input label="Classe demandée" value="6ᵉ B"/>
        <Input label="Date d'admission" icon="calendar" value="2 septembre 2026"/>
      </div>

      <SubLabel>Options pédagogiques</SubLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8, marginBottom: 22 }}>
        {[
          { l: 'Anglais renforcé', sub: '4h / semaine', active: true },
          { l: 'Allemand LV2', sub: '2h / semaine', active: false },
          { l: 'Espagnol LV2', sub: '2h / semaine', active: false },
          { l: 'Cantine', sub: '+ 35 000 FCFA / trim.', active: true },
          { l: 'Transport scolaire', sub: '+ 45 000 FCFA / trim.', active: false },
          { l: 'Soutien scolaire', sub: 'Vendredi 16h', active: false },
        ].map((o, i) => (
          <label key={i} style={{
            padding: 14, borderRadius: 12,
            border: o.active ? '1.5px solid var(--brand-600)' : '1px solid var(--border-default)',
            background: o.active ? 'var(--brand-50)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
              border: o.active ? 0 : '1.5px solid var(--border-strong)',
              background: o.active ? 'var(--brand-600)' : 'transparent',
              display: 'grid', placeItems: 'center',
            }}>{o.active && <Icon name="check" size={11} color="#fff" strokeWidth={3}/>}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{o.l}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{o.sub}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Cost summary */}
      <div style={{ padding: 16, background: 'var(--brand-50)', borderRadius: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 12 }}>
        {[
          { l: 'Scolarité 6ᵉ', v: '350 000' },
          { l: 'Anglais renforcé', v: '+ 40 000' },
          { l: 'Cantine T1', v: '+ 35 000' },
          { l: 'Total annuel', v: '1 305 000', strong: true },
        ].map((s, i) => (
          <div key={i} style={{ borderLeft: i === 3 ? '1px solid var(--brand-300)' : 0, paddingLeft: i === 3 ? 14 : 0 }}>
            <div style={{ fontSize: 10, color: 'var(--brand-700)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
            <div className="display tabular" style={{ fontSize: s.strong ? 22 : 18, fontWeight: 700, color: 'var(--brand-900)', marginTop: 4 }}>{s.v}<span style={{ fontSize: 10, color: 'var(--brand-700)', marginLeft: 4 }}>FCFA</span></div>
          </div>
        ))}
      </div>
    </Card>
  </DashShell>
);

Object.assign(window, { StudentProfile, Bulletin, ClassCouncil, Inscription });
