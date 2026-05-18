// EduPilot — Onboarding wizard + Notification Center (intelligent)

// ─── 1 · ONBOARDING WIZARD (5 étapes) ──────────────────────
const OnboardingShell = ({ step, title, sub, children }) => {
  const steps = [
    { n: 1, t: 'Établissement' },
    { n: 2, t: 'Classes & cycles' },
    { n: 3, t: 'Import élèves' },
    { n: 4, t: 'Équipe & rôles' },
    { n: 5, t: 'Paiement & lancement' },
  ];
  return (
    <div style={{ width: 1280, height: 800, display: 'flex', background: 'var(--surface-page)', overflow: 'hidden' }}>
      {/* Side rail */}
      <aside style={{ width: 320, padding: '40px 32px', background: 'linear-gradient(180deg, var(--brand-700), var(--accent-600))', color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <Logo size={32}/>
          <span className="display" style={{ fontSize: 18, fontWeight: 700 }}>EduPilot</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 18 }}>Mise en route · 5 étapes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {steps.map(s => {
            const done = s.n < step, current = s.n === step;
            return (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 12, background: current ? 'rgba(255,255,255,0.14)' : 'transparent' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                  background: done ? 'rgba(255,255,255,0.95)' : current ? '#fff' : 'rgba(255,255,255,0.12)',
                  display: 'grid', placeItems: 'center',
                  color: done || current ? 'var(--brand-700)' : '#fff',
                  fontWeight: 700, fontSize: 12,
                }}>{done ? <Icon name="check" size={14} strokeWidth={3}/> : s.n}</div>
                <span style={{ fontSize: 13, fontWeight: current ? 700 : 500, opacity: done ? 0.7 : 1 }}>{s.t}</span>
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ padding: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12, lineHeight: 1.55 }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>Besoin d'aide ?</strong>
          Un conseiller dédié vous accompagne pendant 30 jours. Appelez le +229 21 30 12 12 ou écrivez à help@edupilot.bj.
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ padding: '20px 40px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }} className="mono">Étape {step} / 5</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Progression</span>
            <div style={{ width: 180, height: 6, background: 'var(--neutral-200)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: (step / 5 * 100) + '%', background: 'var(--gradient-cta)' }}/>
            </div>
            <span className="tabular" style={{ fontSize: 12, fontWeight: 700 }}>{Math.round(step / 5 * 100)}%</span>
          </div>
        </header>

        <main style={{ flex: 1, padding: '32px 48px', overflow: 'hidden' }}>
          <h1 className="display" style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-0.025em' }}>{title}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 28px', lineHeight: 1.55, maxWidth: 640 }}>{sub}</p>
          {children}
        </main>

        <footer style={{ padding: '18px 40px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-card)' }}>
          <Button variant="ghost" icon="chevron" style={{ visibility: step > 1 ? 'visible' : 'hidden' }}>Précédent</Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost">Reprendre plus tard</Button>
            <Button iconRight="arrowRight" style={{ background: 'var(--gradient-cta)' }}>
              {step === 5 ? 'Lancer EduPilot' : 'Étape suivante'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const OnboardingStep1 = () => (
  <OnboardingShell step={1} title="Parlons de votre établissement"
    sub="Quelques infos pour configurer EduPilot à votre image. Tout est modifiable après.">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 720 }}>
      <Input label="Nom officiel" icon="school" value="Cours Bénin Excellence" style={{ gridColumn: 'span 2' }}/>
      <Input label="Sigle / nom court" value="CBE"/>
      <Input label="Code MEMP" value="BJ-COT-0142" icon="cards"/>
      <Input label="Type d'établissement" value="Privé · primaire + secondaire"/>
      <Input label="Langue d'enseignement" value="Français + anglais"/>
      <Input label="Ville" icon="users" value="Cotonou"/>
      <Input label="Adresse" value="Akpakpa · rue 7.412"/>
      <Input label="Année scolaire" icon="calendar" value="2025 — 2026" style={{ gridColumn: 'span 2' }}/>
    </div>
    <div style={{ marginTop: 28, padding: 18, background: 'var(--brand-50)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 12, maxWidth: 720 }}>
      <Icon name="sparkle" size={18} color="var(--brand-700)"/>
      <div style={{ fontSize: 13, color: 'var(--brand-900)', lineHeight: 1.55 }}>
        <strong>Détection automatique :</strong> on a trouvé votre logo sur excellence.bj.
        Vous pouvez l'utiliser ou en uploader un nouveau plus tard dans les paramètres.
      </div>
    </div>
  </OnboardingShell>
);

const OnboardingStep2 = () => (
  <OnboardingShell step={2} title="Vos classes & cycles"
    sub="Définissez la structure pédagogique. Vous pouvez partir d'un modèle MEMP standard.">
    <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
      <Chip active>Modèle MEMP standard</Chip>
      <Chip>Personnalisé</Chip>
      <Chip>Importer Excel</Chip>
    </div>
    <Card padding={0}>
      <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>3 cycles · 13 niveaux · 28 classes</h3>
        <Button variant="ghost" size="sm" icon="plus">Ajouter</Button>
      </div>
      {[
        { c: 'Primaire', l: 'CI · CP · CE1 · CE2 · CM1 · CM2', n: 12, color: 'success' },
        { c: 'Collège', l: '6ᵉ · 5ᵉ · 4ᵉ · 3ᵉ', n: 10, color: 'info' },
        { c: 'Lycée', l: '2nde · 1ʳᵉ · Tle (séries A · C · D)', n: 6, color: 'warning' },
      ].map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
          <div style={{ width: 8, height: 40, borderRadius: 4, background: `var(--${c.color}-500)` }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{c.c}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.l}</div>
          </div>
          <span className="display tabular" style={{ fontSize: 22, fontWeight: 700 }}>{c.n}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>classes</span>
          <Button variant="ghost" size="sm" icon="pencil"/>
        </div>
      ))}
    </Card>
    <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {[
        { l: 'Effectif moyen par classe', v: '32' },
        { l: 'Matières définies', v: '24' },
        { l: 'Trimestres par an', v: '3' },
      ].map((s, i) => (
        <Card key={i} padding={14}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
          <div className="display tabular" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{s.v}</div>
        </Card>
      ))}
    </div>
  </OnboardingShell>
);

const OnboardingStep3 = () => (
  <OnboardingShell step={3} title="Importez vos élèves"
    sub="Glissez un fichier Excel ou CSV. EduPilot détecte automatiquement les colonnes — pas de mise en forme requise.">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Drop zone */}
      <div style={{
        padding: 32, borderRadius: 'var(--radius-card)',
        border: '2px dashed var(--brand-400)',
        background: 'var(--brand-50)', textAlign: 'center', minHeight: 240,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
      }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--brand-100)', display: 'grid', placeItems: 'center' }}>
          <Icon name="download" size={28} color="var(--brand-700)" style={{ transform: 'rotate(180deg)' }}/>
        </div>
        <div className="display" style={{ fontSize: 18, fontWeight: 700 }}>Glissez votre fichier ici</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>.xlsx · .csv · jusqu'à 50 MB · 10 000 lignes max</div>
        <Button variant="secondary" size="sm">Parcourir mon ordinateur</Button>
      </div>

      {/* Mapping preview */}
      <Card padding={0}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Aperçu · eleves_2026.xlsx</span>
          <Badge variant="success" size="sm" icon="check">1 248 lignes</Badge>
        </div>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'var(--surface-sunken)' }}>
            {['Colonne Excel', 'Détecté comme'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              { c: 'NOM_PRENOM', m: 'Nom + Prénom', ok: true },
              { c: 'DATE_NAIS', m: 'Date de naissance', ok: true },
              { c: 'CLASSE_2025', m: 'Classe', ok: true },
              { c: 'PARENT_TEL', m: 'Téléphone parent', ok: true },
              { c: 'OBS', m: 'Non mappé — ignorer ?', ok: false },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 12px' }} className="mono">{r.c}</td>
                <td style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name={r.ok ? 'check' : 'warning'} size={12} color={r.ok ? 'var(--success-600)' : 'var(--warning-600)'}/>
                  <span style={{ fontWeight: 600 }}>{r.m}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 12, background: 'var(--success-50)', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--success-800)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="sparkle" size={14}/> 0 doublon détecté · 4 photos manquantes (optionnel)
        </div>
      </Card>
    </div>
    <div style={{ marginTop: 18, padding: 14, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Icon name="info" size={16} color="var(--brand-700)"/>
      Pas de fichier ? <a style={{ color: 'var(--brand-700)', fontWeight: 700, cursor: 'pointer' }}>Téléchargez notre modèle Excel pré-rempli</a> ou demandez à notre équipe de faire l'import pour vous (gratuit).
    </div>
  </OnboardingShell>
);

const OnboardingStep4 = () => (
  <OnboardingShell step={4} title="Votre équipe pédagogique"
    sub="Ajoutez enseignants et personnel. Chacun reçoit un email d'invitation avec un rôle précis.">
    <Card padding={0}>
      <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>6 membres invités</span>
        <Button size="sm" icon="plus">Inviter</Button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ background: 'var(--surface-sunken)' }}>
          {['Personne', 'Email', 'Rôle', 'Statut'].map(h => (
            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {[
            { n: 'Marie Akpovi', e: 'm.akpovi@cbe.bj', r: 'Directrice', s: 'You', v: 'brand' },
            { n: 'Paul Adjavon', e: 'p.adjavon@cbe.bj', r: 'Enseignant · Math', s: 'Acceptée', v: 'success' },
            { n: 'Sylvie Sossou', e: 'sylvie@cbe.bj', r: 'Infirmière', s: 'Acceptée', v: 'success' },
            { n: 'Patrick Bio', e: 'p.bio@cbe.bj', r: 'Comptable', s: 'En attente', v: 'warning' },
            { n: 'Claire Hounsou', e: 'c.hounsou@cbe.bj', r: 'Enseignante · Français', s: 'En attente', v: 'warning' },
            { n: 'Joseph Coffi', e: 'j.coffi@cbe.bj', r: 'Surveillant général', s: 'Erreur email', v: 'danger' },
          ].map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={r.n} size="sm"/>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.n}</span>
              </td>
              <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }} className="mono">{r.e}</td>
              <td style={{ padding: '12px 16px' }}><Badge variant="neutral" size="sm">{r.r}</Badge></td>
              <td style={{ padding: '12px 16px' }}><Badge variant={r.v} size="sm" dot={r.v === 'warning'}>{r.s}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
    <div style={{ marginTop: 18, fontSize: 12, color: 'var(--text-tertiary)' }}>
      Astuce : importez en bulk via Excel (Étape 3) puis affectez les rôles ici.
    </div>
  </OnboardingShell>
);

const OnboardingStep5 = () => (
  <OnboardingShell step={5} title="Vérifions tout ensemble"
    sub="Une dernière vue avant le grand jour. Le paiement déclenche votre essai 14 jours gratuit.">
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
      <Card padding={0}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Récapitulatif</h3>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { l: 'Établissement', v: 'Cours Bénin Excellence · Cotonou', icon: 'school' },
            { l: 'Structure pédagogique', v: '3 cycles · 28 classes · 24 matières', icon: 'book' },
            { l: 'Élèves importés', v: '1 248 élèves · 0 doublon · 4 photos manquantes', icon: 'users' },
            { l: 'Équipe', v: '6 membres invités · 2 acceptés · 1 à reprovisionner', icon: 'pencil' },
            { l: 'Année scolaire', v: '2025 — 2026 · 3 trimestres', icon: 'calendar' },
          ].map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, paddingBottom: i < 4 ? 14 : 0, borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-50)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={it.icon} size={16} color="var(--brand-700)"/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{it.l}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{it.v}</div>
              </div>
              <Icon name="check" size={16} color="var(--success-600)"/>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={0} style={{ background: 'linear-gradient(180deg, var(--brand-50), var(--accent-50, #EEF2FF))', borderColor: 'var(--brand-200)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--brand-200)' }}>
          <Badge variant="brand" icon="sparkle" size="sm">14 jours gratuits</Badge>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Forfait Professionnel</div>
          <div className="display tabular" style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.025em', marginTop: 4 }}>129 000<span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, marginLeft: 6 }}>FCFA / mois</span></div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>200 à 1 500 élèves · facturation annuelle</div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--brand-200)' }}>
            {['Tout EduPilot débloqué', 'Mobile Money inclus', 'IA insights + SMS illimité', 'Support 24/7'].map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Icon name="check" size={13} color="var(--success-600)"/>{f}
              </div>
            ))}
          </div>

          <Button full size="lg" iconRight="arrowRight" style={{ marginTop: 20, background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)' }}>
            Démarrer l'essai
          </Button>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
            Aucune carte requise · facturation après 14 jours · annulation 1 clic
          </p>
        </div>
      </Card>
    </div>
  </OnboardingShell>
);

// ─── 2 · NOTIFICATION CENTER (Intelligent) ──────────────────
const notifCats = [
  { k: 'all', l: 'Tout', n: 87, c: 'neutral' },
  { k: 'p0', l: 'Urgent · P0', n: 2, c: 'danger' },
  { k: 'finance', l: 'Finance', n: 14, c: 'warning' },
  { k: 'academic', l: 'Pédagogie', n: 23, c: 'info' },
  { k: 'attendance', l: 'Présences', n: 18, c: 'warning' },
  { k: 'health', l: 'Santé', n: 5, c: 'danger' },
  { k: 'ia', l: 'Insights IA', n: 9, c: 'brand' },
  { k: 'comm', l: 'SMS / Email', n: 16, c: 'success' },
];

const NotifGroup = ({ title, time, count, items }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '6px 14px', marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{title}</div>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{count} · {time}</span>
    </div>
    <Card padding={6}>
      {items.map((it, i) => <NotifItem key={i} {...it}/>)}
    </Card>
  </div>
);

const NotifCenter = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" nav={directorNav.map((n, i) => ({ ...n, active: i === 13 }))}>
    <PageTitle title="Centre de notifications" sub="87 messages · 2 urgents · regroupés et priorisés par l'IA"
      breadcrumb={['Communication', 'Notifications']}>
      <Button variant="ghost" icon="settings">Préférences</Button>
      <Button variant="secondary" icon="check">Tout marquer lu</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: '220px 1.5fr 1fr', gap: 14, height: 'calc(100% - 100px)' }}>
      {/* Categories sidebar */}
      <Card padding={10}>
        <SubLabel>Filtrer</SubLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
          {notifCats.map((c, i) => (
            <button key={c.k} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 8, border: 0, background: i === 0 ? 'var(--brand-50)' : 'transparent',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--brand-800)' : 'var(--text-secondary)' }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: `var(--${c.c}-500)` }}/>
                {c.l}
              </span>
              <span className="tabular" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)' }}>{c.n}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          <SubLabel>Canal</SubLabel>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" defaultChecked/>App</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" defaultChecked/>Email</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" defaultChecked/>SMS · 94% lus</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox"/>WhatsApp</label>
          </div>
        </div>
      </Card>

      {/* Main feed */}
      <div style={{ overflow: 'auto', paddingRight: 4 }}>
        <NotifGroup title="🔴 Action requise · maintenant" time="il y a < 1h" count={2} items={[
          { type: 'urgent', priority: 'P0', title: 'Chute infirmerie — Marie Bossou (CE2-A)', body: 'Suivi médical en cours. Parent injoignable.', time: '4 min', sender: 'Mme Sossou', actions: ['Voir', 'SMS parent', 'Appel'] },
          { type: 'urgent', priority: 'P0', title: '14 paiements en retard +30j', body: 'Cumul de 8,4M FCFA sur 4ᵉ B et 3ᵉ A.', time: '32 min', actions: ['Relance bulk'] },
        ]}/>

        <NotifGroup title="🤖 Insights IA" time="2h" count={3} items={[
          { type: 'info', title: 'Décrochage détecté · 3 élèves en 3ᵉ A · math', body: 'Régression > 1,5 pts sur 2 semaines. Recommandation : soutien vendredi.', time: '1h', sender: 'EduPilot AI', actions: ['Voir les 3', 'Générer soutien'] },
          { type: 'success', title: 'Tendance positive · CM2-A · français', body: 'Moyenne classe +2,1 pts depuis le changement de manuel.', time: '2h', sender: 'EduPilot AI' },
          { type: 'reminder', title: 'Suggestion : conseil de classe 4ᵉ B', body: '24 bulletins prêts à valider. Le jeudi 7 mai semble libre pour 14 enseignants sur 16.', time: '2h', actions: ['Programmer'] },
        ]}/>

        <NotifGroup title="📅 Aujourd'hui" time="aujourd'hui" count={6} items={[
          { type: 'warning', title: '3 absences cette semaine — Koffi Dossou', body: 'Regroupement automatique. SMS parent prévu dans 2h.', time: '3h', actions: ['Justifier', 'Annuler SMS'] },
          { type: 'success', title: '12 paiements reçus via Flutterwave', body: '1 542 000 FCFA encaissés · trimestre 2.', time: '5h' },
          { type: 'info', title: 'Conseil de classe 6ᵉ A demain 16h00', body: '24 bulletins à valider avant 14h.', time: '6h' },
          { type: 'sms', title: 'SMS envoyé à 24 parents', body: 'Rappel paiement T2. 18 lus, 6 en attente.', time: '8h' },
          { type: 'reminder', title: 'Saisie DST Math · échéance vendredi 17h', body: '62/84 notes saisies sur 3ᵉ A et 4ᵉ B.', time: '10h' },
          { type: 'info', title: 'Nouveau commentaire de M. Adjavon', body: 'Sur le bulletin d\'Aïcha Hounsou.', time: '11h' },
        ]}/>

        <NotifGroup title="📆 Cette semaine" time="il y a 1-6 jours" count={12} items={[
          { type: 'info', title: 'Réunion parents 6ᵉ-CM1 · samedi 9h00', body: 'Salle des fêtes · 142 inscriptions confirmées.', time: '2j' },
          { type: 'success', title: 'Bulletin Aïcha Hounsou validé', body: 'Par M. Adjavon · prêt à diffusion.', time: '3j' },
          { type: 'warning', title: 'Sortie pédagogique CE2 reportée', body: 'Météo défavorable. Reprogrammée mardi prochain.', time: '4j' },
        ]}/>
      </div>

      {/* Right preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card padding={0}>
          <div style={{ padding: '14px 18px', background: 'var(--danger-50)', borderBottom: '1px solid var(--danger-200)' }}>
            <Badge variant="danger" size="sm">URGENT · P0</Badge>
            <h3 className="display" style={{ fontSize: 16, margin: '8px 0 0', lineHeight: 1.3 }}>Chute infirmerie — Marie Bossou</h3>
            <p style={{ fontSize: 11, color: 'var(--danger-800)', margin: '4px 0 0' }}>CE2-A · il y a 4 minutes</p>
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
              Marie est tombée pendant la récréation. Genou écorché, désinfecté. Mme Sossou recommande une surveillance 24h. Le père (M. Bossou, +229 95 12 34 56) n'a pas répondu à l'appel.
            </div>
            <SubLabel>Timeline</SubLabel>
            <div style={{ marginTop: 8, position: 'relative', paddingLeft: 14, borderLeft: '2px solid var(--border-subtle)' }}>
              {[
                { t: '10:45', e: 'Incident enregistré', c: 'danger' },
                { t: '10:47', e: 'Premier soin · pansement', c: 'warning' },
                { t: '10:52', e: 'Appel parent (sans réponse)', c: 'neutral' },
                { t: '10:54', e: 'SMS envoyé · accusé livré', c: 'info' },
              ].map((e, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: 10 }}>
                  <span style={{ position: 'absolute', left: -19, top: 4, width: 8, height: 8, borderRadius: 4, background: `var(--${e.c}-500)`, boxShadow: '0 0 0 3px var(--surface-card)' }}/>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{e.t}</div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{e.e}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
              <Button size="sm" icon="sms">Rappeler</Button>
              <Button variant="secondary" size="sm" icon="check">Marquer résolu</Button>
            </div>
          </div>
        </Card>

        <Card>
          <SubLabel>Règles automatiques</SubLabel>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 8 }}>
            <div style={{ padding: 10, background: 'var(--surface-sunken)', borderRadius: 8, marginBottom: 8 }}>
              <Icon name="sparkle" size={11} color="var(--brand-700)" style={{ marginRight: 6 }}/>
              <strong>Regroupement IA :</strong> 3 alertes "absence" du même élève deviennent 1 notification P1 + SMS auto.
            </div>
            <div style={{ padding: 10, background: 'var(--surface-sunken)', borderRadius: 8 }}>
              <Icon name="bell" size={11} color="var(--brand-700)" style={{ marginRight: 6 }}/>
              <strong>Heures silencieuses :</strong> 20h00 → 7h00 (sauf P0).
            </div>
          </div>
          <Button variant="ghost" size="sm" iconRight="arrowRight" style={{ marginTop: 8, marginLeft: -8 }}>Configurer</Button>
        </Card>
      </div>
    </div>
  </DashShell>
);

Object.assign(window, {
  OnboardingStep1, OnboardingStep2, OnboardingStep3, OnboardingStep4, OnboardingStep5,
  NotifCenter,
});
