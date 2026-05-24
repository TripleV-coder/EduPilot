// EduPilot — System: Settings, RBAC, Import, Audit, Analytics, States, Modals, Cmd-K

// ─── 1 · SETTINGS ──────────────────────────────────────────
const SettingsPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: false }))}>
    <PageTitle title="Paramètres" sub="Configuration de l'établissement, branding, conformité"
      breadcrumb={['Paramètres']}/>

    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14 }}>
      <Card padding={10}>
        {[
          { c: 'Compte', items: [{ l: 'Profil', a: false }, { l: 'Sécurité · MFA', a: false }, { l: 'Notifications', a: false }] },
          { c: 'Établissement', items: [{ l: 'Identité & branding', a: true }, { l: 'Année scolaire', a: false }, { l: 'Cycles & classes', a: false }, { l: 'Matières & coeffs', a: false }] },
          { c: 'Équipe & accès', items: [{ l: 'Utilisateurs · 62', a: false }, { l: 'Rôles & permissions', a: false }, { l: 'Invitations', a: false }] },
          { c: 'Intégrations', items: [{ l: 'Mobile Money', a: false }, { l: 'SMS · WhatsApp', a: false }, { l: 'Comptabilité', a: false }] },
          { c: 'Conformité', items: [{ l: 'MEMP', a: false }, { l: 'RGPD · données', a: false }, { l: 'Audit log', a: false }] },
        ].map(cat => (
          <div key={cat.c} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '8px 8px 4px' }}>{cat.c}</div>
            {cat.items.map(it => (
              <button key={it.l} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px', borderRadius: 8, border: 0,
                background: it.a ? 'var(--brand-50)' : 'transparent',
                color: it.a ? 'var(--brand-800)' : 'var(--text-primary)',
                fontSize: 13, fontWeight: it.a ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{it.l}</button>
            ))}
          </div>
        ))}
      </Card>

      <div>
        <Card padding={28}>
          <h3 className="display" style={{ fontSize: 20, margin: '0 0 22px', letterSpacing: '-0.02em' }}>Identité & branding</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32, marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Nom officiel" value="Cours Bénin Excellence"/>
              <Input label="Sigle" value="CBE"/>
              <Input label="Devise / slogan" value="L'excellence éducative au cœur du Bénin"/>
              <Input label="Code MEMP" value="BJ-COT-0142"/>
              <Input label="Domaine email" value="cbe.bj"/>
            </div>
            <div>
              <SubLabel>Logo · 256 × 256 minimum</SubLabel>
              <div style={{ marginTop: 8, padding: 24, border: '2px dashed var(--border-default)', borderRadius: 12, textAlign: 'center', background: 'var(--surface-sunken)' }}>
                <Logo size={80}/>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12 }}>logo-cbe.png · 320×320 · 28 KB</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center' }}>
                  <Button size="sm" variant="secondary">Remplacer</Button>
                  <Button size="sm" variant="ghost">Supprimer</Button>
                </div>
              </div>
            </div>
          </div>

          <SubLabel>Couleur primaire (parents/élèves verront cette couleur)</SubLabel>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {[
              { c: 'var(--brand-700)', l: 'Bleu', active: true },
              { c: 'var(--success-700)', l: 'Vert' },
              { c: 'var(--warning-600)', l: 'Ambre' },
              { c: 'var(--danger-700)', l: 'Rouge' },
              { c: 'var(--accent-600)', l: 'Indigo' },
            ].map(c => (
              <button key={c.l} style={{
                width: 48, height: 48, borderRadius: 12,
                background: c.c, border: c.active ? '3px solid var(--text-primary)' : '1px solid var(--border-default)',
                cursor: 'pointer', position: 'relative',
              }}>
                {c.active && <Icon name="check" size={18} color="#fff" style={{ position: 'absolute', inset: 0, margin: 'auto' }}/>}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost">Annuler</Button>
            <Button>Enregistrer</Button>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 2 · RBAC / RÔLES ──────────────────────────────────────
const RBACPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: false }))}>
    <PageTitle title="Rôles & permissions" sub="6 rôles · 62 utilisateurs · contrôle d'accès fin"
      breadcrumb={['Paramètres', 'Équipe & accès', 'Rôles']}>
      <Button icon="plus">Nouveau rôle</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>
      <Card padding={8}>
        {[
          { r: 'Directeur · Directrice', n: 2, c: 'brand', active: true },
          { r: 'Enseignant', n: 28, c: 'info' },
          { r: 'Parent', n: 1840, c: 'success' },
          { r: 'Élève', n: 1248, c: 'warning' },
          { r: 'Administratif', n: 6, c: 'neutral' },
          { r: 'Super Admin', n: 1, c: 'danger' },
        ].map((r, i) => (
          <button key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 12px', borderRadius: 10, border: 0,
            background: r.active ? `var(--${r.c}-50)` : 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            borderLeft: r.active ? `3px solid var(--${r.c}-700)` : '3px solid transparent',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--${r.c}-500)` }}/>
            <span style={{ flex: 1, fontSize: 13, fontWeight: r.active ? 700 : 500 }}>{r.r}</span>
            <span className="tabular" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.n}</span>
          </button>
        ))}
      </Card>

      <Card padding={0}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="display" style={{ fontSize: 18, margin: 0 }}>Directeur · Directrice</h3>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Accès complet à l'établissement · pas d'accès cross-école</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--surface-sunken)' }}>
            {['Module', 'Lire', 'Créer', 'Modifier', 'Supprimer'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              { m: 'Élèves & dossiers', p: [1, 1, 1, 1] },
              { m: 'Notes & bulletins', p: [1, 1, 1, 0] },
              { m: 'Présences', p: [1, 1, 1, 0] },
              { m: 'Finance & paiements', p: [1, 1, 1, 1] },
              { m: 'Santé · infirmerie', p: [1, 0, 0, 0] },
              { m: 'Communication SMS', p: [1, 1, 1, 0] },
              { m: 'Paramètres établissement', p: [1, 1, 1, 0] },
              { m: 'Audit log', p: [1, 0, 0, 0] },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.m}</td>
                {r.p.map((v, j) => (
                  <td key={j} style={{ padding: '10px 16px' }}>
                    <span style={{
                      display: 'inline-flex', width: 28, height: 18, borderRadius: 9,
                      background: v ? 'var(--success-600)' : 'var(--neutral-200)',
                      position: 'relative',
                    }}>
                      <span style={{ position: 'absolute', top: 2, left: v ? 12 : 2, width: 14, height: 14, borderRadius: 7, background: '#fff' }}/>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 18, background: 'var(--brand-50)', borderTop: '1px solid var(--brand-200)', fontSize: 12, color: 'var(--brand-800)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon name="info" size={14}/>
          Les directeurs peuvent voir l'audit log mais pas le modifier · changement de rôle = log obligatoire.
        </div>
      </Card>
    </div>
  </DashShell>
);

// ─── 3 · AUDIT LOG ─────────────────────────────────────────
const AuditPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: false }))}>
    <PageTitle title="Journal d'audit" sub="Toutes les actions critiques · conforme MEMP · 90 jours en accès direct"
      breadcrumb={['Paramètres', 'Conformité', 'Audit']}>
      <Button variant="secondary" icon="download">Export CSV</Button>
    </PageTitle>

    <FilterBar>
      <Chip active>Tous</Chip>
      <Chip count={48}>Notes</Chip>
      <Chip count={32}>Finance</Chip>
      <Chip count={18}>Permissions</Chip>
      <Chip count={6}>Auth</Chip>
      <div style={{ flex: 1 }}/>
      <Input icon="search" placeholder="Acteur, ressource…" style={{ maxWidth: 240 }}/>
    </FilterBar>

    <Card padding={0}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ background: 'var(--surface-sunken)' }}>
          {['Horodatage', 'Acteur', 'Action', 'Ressource', 'IP', 'Détail'].map(h => (
            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {[
            { t: '2026-05-05 14:32:18', a: 'M. Adjavon', ac: 'note.update', r: 'eleve/A0142/note/dst-math-2', ip: '197.149.x.x', d: '14,5 → 16,5', sev: 'warning' },
            { t: '2026-05-05 14:30:02', a: 'M. Adjavon', ac: 'note.create', r: 'eleve/A0142/note/dst-math-2', ip: '197.149.x.x', d: 'note initiale 14,5', sev: 'info' },
            { t: '2026-05-05 14:15:44', a: 'Mme Bio', ac: 'paiement.encaisser', r: 'famille/Hounsou/T2', ip: '197.149.x.x', d: '125 000 FCFA · Flutterwave', sev: 'success' },
            { t: '2026-05-05 11:22:01', a: 'Mme Akpovi', ac: 'role.update', r: 'user/p.bio@cbe.bj', ip: '197.149.x.x', d: 'enseignant → comptable', sev: 'danger' },
            { t: '2026-05-05 10:45:33', a: 'Mme Sossou', ac: 'incident.create', r: 'eleve/M0241/incident', ip: '197.149.x.x', d: 'chute infirmerie', sev: 'warning' },
            { t: '2026-05-05 09:18:20', a: 'M. Coffi', ac: 'login.success', r: 'auth/login', ip: '197.149.x.x', d: 'MFA SMS · 5G', sev: 'info' },
            { t: '2026-05-05 08:42:11', a: 'Mme Akpovi', ac: 'export.csv', r: 'recouvrement-t2.csv', ip: '197.149.x.x', d: '14 lignes · 1.2 KB', sev: 'info' },
            { t: '2026-05-04 23:01:00', a: 'Système', ac: 'sms.bulk', r: 'parents/retard-t2', ip: '—', d: '14 SMS envoyés · 13 livrés', sev: 'success' },
            { t: '2026-05-04 18:30:44', a: 'Inconnu', ac: 'login.failed', r: 'auth/login', ip: '105.66.x.x', d: '3 tentatives · email m.akpovi', sev: 'danger' },
          ].map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '11px 16px', color: 'var(--text-tertiary)', fontSize: 11 }} className="mono">{r.t}</td>
              <td style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={r.a} size="xs"/><span style={{ fontWeight: 600 }}>{r.a}</span>
              </td>
              <td style={{ padding: '11px 16px' }}><span className="mono" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `var(--${r.sev}-50)`, color: `var(--${r.sev}-800)` }}>{r.ac}</span></td>
              <td style={{ padding: '11px 16px', color: 'var(--text-secondary)' }} className="mono">{r.r}</td>
              <td style={{ padding: '11px 16px', color: 'var(--text-tertiary)' }} className="mono">{r.ip}</td>
              <td style={{ padding: '11px 16px' }}>{r.d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </DashShell>
);

// ─── 4 · IMPORT CSV WIZARD ─────────────────────────────────
const ImportPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 2 }))}>
    <PageTitle title="Importer des élèves · CSV" sub="Étape 2 / 3 · vérification & mapping des colonnes"
      breadcrumb={['Élèves', 'Import']}/>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>eleves_2026_septembre.xlsx</h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>1 248 lignes détectées · 14 colonnes</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Badge variant="success" size="sm" icon="check">12 mappées</Badge>
            <Badge variant="warning" size="sm" icon="warning">2 à vérifier</Badge>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--surface-sunken)' }}>
            {['Colonne Excel', '→', 'Champ EduPilot', 'Aperçu (3 premières)', 'Statut'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              { c: 'NOM_PRENOM', m: 'eleve.fullName', p: 'HOUNSOU Aïcha · SOSSOU Mathieu · BOSSOU Marie', s: 'ok' },
              { c: 'DATE_NAIS', m: 'eleve.birthDate', p: '12/03/2012 · 04/07/2011 · 21/01/2013', s: 'ok' },
              { c: 'CLASSE_2025', m: 'eleve.classe', p: '3ᵉ A · CM1 · CE2-A', s: 'ok' },
              { c: 'PARENT_TEL', m: 'parent.telephone', p: '+229 95 12 34 56 · +229 97 88 12 30 · …', s: 'ok' },
              { c: 'PARENT_EMAIL', m: 'parent.email', p: '(vide) · (vide) · (vide)', s: 'warn', note: '78% vides' },
              { c: 'OBS_GENERALES', m: '— ignorée —', p: 'Boursière · Frère même école · …', s: 'skip' },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '11px 14px' }} className="mono">{r.c}</td>
                <td style={{ padding: '11px 14px', color: 'var(--text-tertiary)' }}>→</td>
                <td style={{ padding: '11px 14px', fontWeight: 600 }}>{r.m}</td>
                <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--text-secondary)' }}>{r.p}</td>
                <td style={{ padding: '11px 14px' }}>
                  {r.s === 'ok' && <Badge variant="success" size="sm" icon="check">OK</Badge>}
                  {r.s === 'warn' && <Badge variant="warning" size="sm">{r.note}</Badge>}
                  {r.s === 'skip' && <Badge variant="neutral" size="sm">Ignorée</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Validations automatiques</SubLabel>
          <div style={{ marginTop: 10 }}>
            {[
              { l: 'Doublons (nom + date naissance)', v: '0 détecté', c: 'success' },
              { l: 'Format date valide', v: '1 248 / 1 248', c: 'success' },
              { l: 'Téléphone format Bénin', v: '1 224 / 1 248', c: 'warning' },
              { l: 'Classe existante', v: '1 248 / 1 248', c: 'success' },
              { l: 'Âge cohérent / niveau', v: '1 240 / 1 248', c: 'warning' },
            ].map((v, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 0, fontSize: 12 }}>
                <span>{v.l}</span>
                <span style={{ fontWeight: 700, color: `var(--${v.c}-700)` }} className="tabular">{v.v}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ background: 'var(--brand-50)' }}>
          <SubLabel>Prêt à importer</SubLabel>
          <div className="display tabular" style={{ fontSize: 32, fontWeight: 700, color: 'var(--brand-800)', marginTop: 6 }}>1 224</div>
          <div style={{ fontSize: 12, color: 'var(--brand-800)' }}>élèves prêts · 24 nécessitent une vérification manuelle</div>
          <Button full size="lg" style={{ marginTop: 14, background: 'var(--gradient-cta)' }} iconRight="arrowRight">Lancer l'import</Button>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 5 · ANALYTICS BI BUILDER ──────────────────────────────
const AnalyticsPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 12 }))}>
    <PageTitle title="Analytics BI" sub="Tableau de bord personnalisé · 8 widgets actifs · mis à jour il y a 2 minutes"
      breadcrumb={['Analytics']}>
      <Button variant="secondary" icon="filter">Période · trim. 2</Button>
      <Button variant="secondary" icon="download">PDF rapport</Button>
      <Button icon="plus">Widget</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12, gridAutoRows: 'minmax(140px, auto)' }}>
      <MetricCard label="Élèves actifs" value="1 248" trend={4.2} icon="users" variant="brand"
        style={{ gridColumn: 'span 3' }}/>
      <MetricCard label="Recouvrement" value="82" unit="%" trend={6.1} icon="money" variant="success"
        style={{ gridColumn: 'span 3' }}/>
      <MetricCard label="Présence" value="92,4" unit="%" trend={-1.3} icon="check" variant="info"
        style={{ gridColumn: 'span 3' }}/>
      <MetricCard label="Net Promoter" value="74" trend={8} icon="trophy" variant="brand"
        style={{ gridColumn: 'span 3' }}/>

      <Card style={{ gridColumn: 'span 8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
          <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Encaissements vs facturation · 12 mois</h3>
          <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--brand-700)' }}/>Encaissé</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--brand-300)' }}/>Facturé</div>
          </div>
        </div>
        <BarChart/>
      </Card>
      <Card style={{ gridColumn: 'span 4' }}>
        <SubLabel>Mix de paiements</SubLabel>
        <div style={{ position: 'relative', width: 160, height: 160, margin: '14px auto' }}>
          <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--brand-600)" strokeWidth="6" strokeDasharray="42 88" strokeDashoffset="0"/>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--info-600)" strokeWidth="6" strokeDasharray="23 88" strokeDashoffset="-42"/>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--success-600)" strokeWidth="6" strokeDasharray="13 88" strokeDashoffset="-65"/>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--warning-500)" strokeWidth="6" strokeDasharray="10 88" strokeDashoffset="-78"/>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
            <div>
              <div className="display tabular" style={{ fontSize: 20, fontWeight: 700 }}>248,5</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>M FCFA</div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { c: 'brand', l: 'Mobile Money', v: '48%' },
            { c: 'info', l: 'Flutterwave', v: '26%' },
            { c: 'success', l: 'Paystack', v: '14%' },
            { c: 'warning', l: 'Virement', v: '8%' },
          ].map(d => (
            <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: `var(--${d.c}-600)` }}/>
              <span style={{ flex: 1 }}>{d.l}</span>
              <span className="tabular" style={{ fontWeight: 700 }}>{d.v}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ gridColumn: 'span 6' }}>
        <SubLabel>Top 5 matières · moyennes T2</SubLabel>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { s: 'Arts plastiques', v: 16.2 },
            { s: 'EPS', v: 15.4 },
            { s: 'SVT', v: 14.8 },
            { s: 'Mathématiques', v: 13.6 },
            { s: 'Français', v: 13.2 },
          ].map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 50px', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{m.s}</span>
              <div style={{ height: 8, background: 'var(--neutral-200)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (m.v / 20 * 100) + '%', background: 'var(--brand-700)' }}/>
              </div>
              <span className="display tabular" style={{ fontSize: 14, fontWeight: 700, textAlign: 'right' }}>{m.v.toFixed(1).replace('.', ',')}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ gridColumn: 'span 6', background: 'linear-gradient(135deg, var(--brand-800), var(--accent-600))', color: '#fff', border: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <Icon name="sparkle" size={18}/>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85 }}>Top insight IA · semaine</span>
        </div>
        <p className="display" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.35, margin: 0 }}>
          Les classes ayant changé de manuel français cette année affichent +1,8 pts en moyenne au T2.
        </p>
        <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6, marginTop: 12 }}>
          Recommandation : étendre le changement à 4ᵉ et 5ᵉ pour septembre 2026.
        </p>
        <Button variant="soft" size="sm" style={{ background: '#fff', color: 'var(--brand-800)', marginTop: 8 }}>Voir l'analyse complète</Button>
      </Card>
    </div>
  </DashShell>
);

// ─── 6 · STATES (Empty, Loading, Error) ─────────────────────
const StatesPage = () => (
  <div style={{ width: 1280, padding: 32, background: 'var(--surface-page)' }}>
    <h1 className="display" style={{ fontSize: 28, margin: '0 0 20px', fontWeight: 700, letterSpacing: '-0.025em' }}>États · empty / loading / error</h1>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {/* Empty */}
      <Card padding={40} style={{ textAlign: 'center', minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: 'var(--brand-50)', display: 'grid', placeItems: 'center', marginBottom: 20 }}>
          <Icon name="users" size={36} color="var(--brand-700)" strokeWidth={1.5}/>
        </div>
        <h3 className="display" style={{ fontSize: 18, margin: '0 0 8px' }}>Aucun élève pour le moment</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 280, margin: '0 0 20px', lineHeight: 1.55 }}>
          L'année scolaire n'a pas démarré. Importez votre liste pour préparer la rentrée.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon="plus">Importer Excel</Button>
          <Button variant="secondary">Voir modèle</Button>
        </div>
      </Card>

      {/* Loading */}
      <Card padding={20} style={{ minHeight: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Spinner size={14}/>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Chargement des données…</span>
        </div>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--neutral-200)', animation: 'eduPulse 1.4s infinite' }}/>
            <div style={{ flex: 1 }}>
              <div style={{ height: 10, width: '60%', background: 'var(--neutral-200)', borderRadius: 5, animation: 'eduPulse 1.4s infinite' }}/>
              <div style={{ height: 8, width: '40%', background: 'var(--neutral-200)', borderRadius: 4, marginTop: 6, animation: 'eduPulse 1.4s infinite' }}/>
            </div>
            <div style={{ width: 40, height: 18, background: 'var(--neutral-200)', borderRadius: 9, animation: 'eduPulse 1.4s infinite' }}/>
          </div>
        ))}
      </Card>

      {/* Error */}
      <Card padding={40} style={{ textAlign: 'center', minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--danger-50)', border: '1px solid var(--danger-200)' }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: 'var(--danger-100)', display: 'grid', placeItems: 'center', marginBottom: 20 }}>
          <Icon name="warning" size={36} color="var(--danger-700)"/>
        </div>
        <h3 className="display" style={{ fontSize: 18, margin: '0 0 8px', color: 'var(--danger-900)' }}>Connexion perdue</h3>
        <p style={{ fontSize: 13, color: 'var(--danger-800)', maxWidth: 280, margin: '0 0 20px', lineHeight: 1.55 }}>
          Vos modifications sont sauvegardées localement. Synchronisation dès que le réseau revient.
        </p>
        <Badge variant="warning" size="sm" icon="clock">Réessai dans 8s</Badge>
        <div style={{ marginTop: 18, fontSize: 11, color: 'var(--danger-800)' }} className="mono">err.network · 0x504</div>
      </Card>
    </div>

    <h2 className="display" style={{ fontSize: 20, margin: '32px 0 16px', fontWeight: 700 }}>Overlays & micro-interactions</h2>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Confirm modal */}
      <div style={{ minHeight: 380, position: 'relative', background: 'var(--neutral-300)', borderRadius: 'var(--radius-card)', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)' }}/>
        <div style={{ position: 'relative', background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: 28, width: 380, boxShadow: 'var(--shadow-overlay)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--danger-50)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
            <Icon name="warning" size={22} color="var(--danger-600)"/>
          </div>
          <h3 className="display" style={{ fontSize: 18, margin: '0 0 6px' }}>Supprimer l'élève ?</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.55 }}>
            Aïcha Hounsou sera retirée définitivement. Notes, présences et finance restent archivés 10 ans (MEMP).
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary">Annuler</Button>
            <Button variant="danger" icon="x">Supprimer</Button>
          </div>
        </div>
      </div>

      {/* Command Palette */}
      <div style={{ minHeight: 380, position: 'relative', background: 'var(--neutral-300)', borderRadius: 'var(--radius-card)', overflow: 'hidden', display: 'grid', placeItems: 'start center', paddingTop: 60 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }}/>
        <div style={{ position: 'relative', background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', width: 460, boxShadow: 'var(--shadow-overlay)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-subtle)' }}>
            <Icon name="search" size={16} color="var(--text-tertiary)"/>
            <input style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 14, fontFamily: 'inherit', color: 'var(--text-primary)' }} placeholder="Rechercher… (⌘K)" defaultValue="aïcha"/>
            <span className="mono" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-sunken)', color: 'var(--text-tertiary)' }}>ESC</span>
          </div>
          <div style={{ padding: '8px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', paddingLeft: 18 }}>Élèves</div>
          {[
            { i: 'users', l: 'Aïcha Hounsou · 3ᵉ A · matricule A0142', s: '⏎' },
            { i: 'users', l: 'Aïssa Coffi · 5ᵉ B · matricule C0871', s: '' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: i === 0 ? 'var(--brand-50)' : 'transparent' }}>
              <Icon name={r.i} size={14} color={i === 0 ? 'var(--brand-700)' : 'var(--text-tertiary)'}/>
              <span style={{ flex: 1, fontSize: 13, fontWeight: i === 0 ? 700 : 500 }}>{r.l}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.s}</span>
            </div>
          ))}
          <div style={{ padding: '8px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', paddingLeft: 18 }}>Actions rapides</div>
          {[
            { i: 'pencil', l: 'Saisir une note pour Aïcha', s: '' },
            { i: 'sms', l: 'Envoyer un SMS aux parents Hounsou', s: '' },
            { i: 'download', l: 'Télécharger bulletin T2 d\'Aïcha', s: '' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px' }}>
              <Icon name={r.i} size={14} color="var(--text-tertiary)"/>
              <span style={{ flex: 1, fontSize: 13 }}>{r.l}</span>
            </div>
          ))}
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 14, fontSize: 10, color: 'var(--text-tertiary)' }} className="mono">
            <span>↑↓ naviguer</span><span>⏎ ouvrir</span><span>⌘K basculer</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, {
  SettingsPage, RBACPage, AuditPage, ImportPage, AnalyticsPage, StatesPage,
});
