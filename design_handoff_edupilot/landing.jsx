// EduPilot — Landing page (marketing scroll)

const LandingNav = () => (
  <header style={{
    position: 'sticky', top: 0, zIndex: 50,
    height: 68, padding: '0 40px', background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex', alignItems: 'center', gap: 32,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Logo size={32}/>
      <span className="display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>EduPilot</span>
    </div>
    <nav style={{ display: 'flex', gap: 22, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
      {['Plateforme', 'Solutions', 'Tarifs', 'Explorateur', 'Témoignages'].map(l => (
        <a key={l} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>{l}</a>
      ))}
    </nav>
    <div style={{ flex: 1 }}/>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>FR · EN</span>
      <Button variant="ghost" size="sm">Connexion</Button>
      <Button size="sm" iconRight="arrowRight">Demander une démo</Button>
    </div>
  </header>
);

const Hero = () => (
  <section style={{ position: 'relative', padding: '80px 40px 100px', textAlign: 'center', overflow: 'hidden' }}>
    {/* Background gradient */}
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: 'radial-gradient(60% 50% at 50% 0%, rgba(37,99,235,0.10), transparent 70%)',
    }}/>
    <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 14px', borderRadius: 'var(--radius-pill)',
        background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
        fontSize: 12, fontWeight: 600, color: 'var(--brand-700)', marginBottom: 24,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--brand-600)', animation: 'eduPulse 1.6s infinite' }}/>
        Plateforme nº 1 au Bénin · 18 240 élèves formés
      </div>
      <h1 className="display" style={{
        fontSize: 72, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.04em',
        margin: '0 0 24px', color: 'var(--text-primary)',
      }}>
        L'ERP éducatif pensé pour <br/>
        <span style={{ background: 'var(--gradient-cta)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          l'Afrique de l'Ouest.
        </span>
      </h1>
      <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--text-secondary)', maxWidth: 620, margin: '0 auto 36px' }}>
        Notes, présences, finances, communication parents — un seul outil, qui marche en zone faible connexion,
        avec SMS de secours et paiements mobile money.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 56 }}>
        <Button size="lg" iconRight="arrowRight" style={{ background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)' }}>
          Démarrer gratuitement
        </Button>
        <Button variant="secondary" size="lg" icon="sparkle">Voir une démo · 2 min</Button>
      </div>
      <div style={{ paddingTop: 32, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 18 }}>
          Plus de 24 établissements nous font confiance
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, opacity: 0.65, alignItems: 'center' }}>
          {['CESM', 'LNB', 'EPEB', 'Excellence', 'Bénin · Édu', 'Lumière'].map(n => (
            <div key={n} className="display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-secondary)' }}>{n}</div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const ProductScreenshot = () => (
  <section style={{ padding: '0 40px 80px', position: 'relative' }}>
    <div style={{
      maxWidth: 1100, margin: '0 auto',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden', boxShadow: 'var(--shadow-overlay)',
      border: '1px solid var(--border-subtle)',
      background: 'var(--surface-card)',
    }}>
      {/* Window chrome */}
      <div style={{
        height: 36, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--neutral-100)', borderBottom: '1px solid var(--border-subtle)',
      }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map(c => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }}/>)}
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>app.edupilot.bj/dashboard</div>
      </div>
      {/* Mini director dashboard preview */}
      <div style={{ height: 520, padding: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, gridAutoRows: 'min-content' }}>
        <MetricCard label="Élèves actifs" value="1 248" trend={4.2} icon="users" variant="brand"/>
        <MetricCard label="Recouvrement" value="82%" trend={6.1} icon="money" variant="success"/>
        <MetricCard label="Présence" value="92,4%" trend={-1.3} icon="check" variant="info"/>
        <MetricCard label="Incidents" value="2" trend={-50} icon="warning" variant="warning"/>
        <Card style={{ gridColumn: 'span 3' }}>
          <SubLabel>Recouvrement T2 · objectif 95%</SubLabel>
          <BarChart/>
        </Card>
        <Card>
          <SubLabel>Insight IA</SubLabel>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, marginTop: 6 }}>
            3 élèves de 3ᵉ A en décrochage en algèbre.
          </div>
          <Button variant="soft" size="sm" style={{ marginTop: 10 }}>Voir →</Button>
        </Card>
      </div>
    </div>
    {/* Floating proof */}
    <div style={{ maxWidth: 1100, margin: '24px auto 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {[
        { v: '+ 38%', l: 'de recouvrement à T+90j' },
        { v: '6 h', l: 'gagnées / sem. par enseignant' },
        { v: '94%', l: 'des parents lisent les SMS' },
        { v: '< 200 ms', l: 'temps de réponse moyen' },
      ].map(s => (
        <Card key={s.l}>
          <div className="display tabular" style={{ fontSize: 30, fontWeight: 700, color: 'var(--brand-700)', letterSpacing: '-0.03em' }}>{s.v}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{s.l}</div>
        </Card>
      ))}
    </div>
  </section>
);

const FeaturesGrid = () => {
  const items = [
    { icon: 'users', t: 'Gestion des élèves', d: 'Import CSV/Excel, dossiers complets, rattachement parent/enfant automatique, photos.', c: 'brand' },
    { icon: 'pencil', t: 'Notes & bulletins', d: 'Saisie rapide, calcul auto des moyennes pondérées, génération PDF bulletins MEMP.', c: 'info' },
    { icon: 'calendar', t: 'Emploi du temps', d: 'Drag & drop par classe / enseignant / salle. Détection des conflits en temps réel.', c: 'warning' },
    { icon: 'money', t: 'Finance · Mobile Money', d: 'Flutterwave + Paystack. Échéanciers, relances SMS, comptabilité simplifiée.', c: 'success' },
    { icon: 'sms', t: 'Communication SMS', d: 'Fallback automatique pour les parents sans smartphone. 94% de taux de lecture.', c: 'brand' },
    { icon: 'chart', t: 'Analytics & BI', d: 'Indicateurs sémantiques, exports PDF/CSV, alertes intelligentes par IA locale.', c: 'info' },
  ];
  return (
    <section style={{ padding: '100px 40px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 56, maxWidth: 700 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand-700)', marginBottom: 12 }}>Fonctionnalités</div>
          <h2 className="display" style={{ fontSize: 48, lineHeight: 1, letterSpacing: '-0.03em', margin: 0, fontWeight: 700 }}>
            Une architecture logicielle <span style={{ color: 'var(--text-tertiary)' }}>sans compromis.</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)' }}>
          {items.map((f, i) => (
            <div key={i} style={{ background: 'var(--surface-card)', padding: 32, cursor: 'crosshair' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `var(--${f.c}-50)`, display: 'grid', placeItems: 'center', marginBottom: 22 }}>
                <Icon name={f.icon} size={18} color={`var(--${f.c}-700)`}/>
              </div>
              <h3 className="display" style={{ fontSize: 17, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.015em' }}>{f.t}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const OnboardingSteps = () => {
  const steps = [
    { n: '01', t: "Configurer l'établissement", d: 'Structures, classes, cycles, paramètres académiques.', cta: 'Paramétrer' },
    { n: '02', t: 'Importer les utilisateurs', d: 'Élèves, enseignants, parents avec rattachement auto.', cta: 'Importer' },
    { n: '03', t: 'Piloter en temps réel', d: 'Performances, finance, assiduité, alertes intelligentes.', cta: 'Ouvrir' },
  ];
  return (
    <section style={{ padding: '100px 40px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand-700)', marginBottom: 12 }}>Mise en route</div>
            <h2 className="display" style={{ fontSize: 40, fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>3 étapes, 2 heures.</h2>
          </div>
          <Button variant="ghost" iconRight="arrowRight">Guide complet</Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {steps.map(s => (
            <Card key={s.n} padding={28}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--brand-700)', fontWeight: 600, marginBottom: 22 }}>{s.n}</div>
              <h3 className="display" style={{ fontSize: 22, margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.t}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '10px 0 22px' }}>{s.d}</p>
              <Button variant="secondary" size="sm" iconRight="arrowRight">{s.cta}</Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

const Pricing = () => {
  const tiers = [
    { k: 'Essentiel', p: '49 000', sub: 'Jusqu\'à 200 élèves', features: ['Gestion élèves & notes', 'Bulletins PDF', 'SMS 500/mois', 'Support email'], cta: 'Démarrer' },
    { k: 'Professionnel', p: '129 000', sub: '200 à 1 500 élèves', popular: true, features: ['Tout Essentiel', 'Mobile Money (Flutter/Paystack)', 'IA insights + analytics BI', 'SMS illimité', 'Support prioritaire 24/7', 'API & exports'], cta: 'Démarrer 14j gratuits' },
    { k: 'Réseau', p: 'Sur devis', sub: 'Multi-établissements', features: ['Vue consolidée illimitée', 'SSO & SCIM', 'Conformité MEMP avancée', 'Account manager dédié', 'SLA 99,9%'], cta: 'Contacter les ventes' },
  ];
  return (
    <section style={{ padding: '100px 40px', background: 'var(--surface-page)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand-700)', marginBottom: 12 }}>Tarifs</div>
          <h2 className="display" style={{ fontSize: 48, fontWeight: 700, margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Un prix juste. Pas de surprise.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 12 }}>Facturé en FCFA, annuellement. −20% vs mensuel.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {tiers.map(t => (
            <Card key={t.k} padding={28} style={{
              border: t.popular ? '2px solid var(--brand-600)' : '1px solid var(--border-subtle)',
              boxShadow: t.popular ? 'var(--shadow-cta)' : 'var(--shadow-sm)',
              position: 'relative',
            }}>
              {t.popular && <Badge variant="brand" style={{ position: 'absolute', top: -12, right: 20 }}>Recommandé</Badge>}
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t.k}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 18 }}>{t.sub}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 18 }}>
                <span className="display tabular" style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em' }}>{t.p}</span>
                {t.p !== 'Sur devis' && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>FCFA / mois</span>}
              </div>
              <Button full size="md" variant={t.popular ? 'primary' : 'secondary'} style={t.popular ? { background: 'var(--gradient-cta)' } : null}>{t.cta}</Button>
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-subtle)' }}>
                {t.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Icon name="check" size={14} color="var(--success-600)" style={{ marginTop: 3 }}/>{f}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

const Testimonials = () => {
  const items = [
    { q: 'Le recouvrement de scolarité a bondi de 38% en un trimestre. Les rappels SMS automatiques font le travail à notre place.', a: 'Mme Akpovi', r: 'Directrice — Cours Bénin Excellence, Cotonou' },
    { q: 'Mes enseignants saisissent les notes depuis leur téléphone, même sans wifi. Les bulletins se génèrent en un clic.', a: 'M. Hounsou', r: 'Proviseur — Lycée Pilote, Porto-Novo' },
    { q: 'En tant que parent, je reçois un SMS dès que mon enfant est absent. Et je paie la scolarité en 30 secondes.', a: 'Mme Bossou', r: 'Parent d\'élève · 2 enfants scolarisés' },
  ];
  return (
    <section style={{ padding: '100px 40px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand-700)', marginBottom: 12 }}>Témoignages</div>
        <h2 className="display" style={{ fontSize: 40, fontWeight: 700, margin: '0 0 40px', letterSpacing: '-0.03em' }}>Ce qu'en disent les utilisateurs.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {items.map((t, i) => (
            <Card key={i} padding={28} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 30, color: 'var(--brand-600)', lineHeight: 1, marginBottom: 18 }}>"</div>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text-primary)', flex: 1, margin: '0 0 22px' }}>{t.q}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 18, borderTop: '1px solid var(--border-subtle)' }}>
                <Avatar name={t.a} size="md"/>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.a}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.r}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

const FAQ = () => {
  const items = [
    { q: 'Faut-il une connexion permanente ?', a: 'Non. EduPilot fonctionne en mode offline-first : saisie de notes, appel, consultation des fiches. Synchronisation automatique dès que vous retrouvez du réseau.' },
    { q: 'Mes données restent au Bénin ?', a: 'Oui. Hébergement local prioritaire, conforme MEMP et RGPD européen. Export complet de vos données à tout moment.' },
    { q: 'Combien coûte la mise en place ?', a: '0 FCFA. Notre équipe importe vos données, forme vos enseignants et vous accompagne pendant 30 jours, sans frais supplémentaires.' },
    { q: 'Quels moyens de paiement supportez-vous ?', a: 'Mobile Money (MTN, Moov), cartes bancaires via Flutterwave & Paystack, virement bancaire, espèces enregistrées par le comptable.' },
  ];
  return (
    <section style={{ padding: '100px 40px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <h2 className="display" style={{ fontSize: 40, fontWeight: 700, textAlign: 'center', margin: '0 0 48px', letterSpacing: '-0.03em' }}>Questions fréquentes</h2>
        <div>
          {items.map((it, i) => (
            <details key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }} open={i === 0}>
              <summary style={{ cursor: 'pointer', padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', listStyle: 'none' }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{it.q}</span>
                <Icon name="plus" size={18} color="var(--text-tertiary)"/>
              </summary>
              <p style={{ paddingBottom: 20, fontSize: 14, lineHeight: 1.65, color: 'var(--text-secondary)', margin: 0 }}>{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

const CTAFooter = () => (
  <section style={{ padding: '80px 40px', background: 'var(--neutral-900)', color: 'var(--neutral-50)' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{
        padding: '56px 48px', borderRadius: 'var(--radius-card)',
        background: 'linear-gradient(135deg, var(--brand-700), var(--accent-600))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32,
        marginBottom: 64,
      }}>
        <div>
          <h2 className="display" style={{ fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: '-0.03em', color: '#fff' }}>Prêt à piloter votre établissement ?</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 10, marginBottom: 0 }}>14 jours d'essai. Pas de carte. Mise en service sous 48h.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button size="lg" style={{ background: '#fff', color: 'var(--brand-700)' }} iconRight="arrowRight">Démarrer</Button>
          <Button variant="ghost" size="lg" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>Parler aux ventes</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Logo size={32}/>
            <span className="display" style={{ fontSize: 18, fontWeight: 700 }}>EduPilot</span>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, maxWidth: 320 }}>L'ERP éducatif intelligent, conçu pour les établissements d'Afrique de l'Ouest.</p>
        </div>
        {[
          { t: 'Produit', l: ['Plateforme', 'Tarifs', 'Explorateur', 'Roadmap'] },
          { t: 'Ressources', l: ['Guide d\'usage', 'API', 'Statut', 'Blog'] },
          { t: 'Société', l: ['À propos', 'Sécurité', 'Conformité MEMP', 'Carrières'] },
          { t: 'Légal', l: ['CGV', 'Confidentialité', 'RGPD', 'Cookies'] },
        ].map(col => (
          <div key={col.t}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 14 }}>{col.t}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.l.map(item => <li key={item} style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', cursor: 'pointer' }}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
        <span>© 2026 EduPilot · Cotonou, Bénin · Hébergé localement.</span>
        <span className="mono">v2.0.0 · build 2026.05.15</span>
      </div>
    </div>
  </section>
);

const Landing = () => (
  <div style={{ width: 1280, background: 'var(--surface-page)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
    <LandingNav/>
    <Hero/>
    <ProductScreenshot/>
    <FeaturesGrid/>
    <OnboardingSteps/>
    <Pricing/>
    <Testimonials/>
    <FAQ/>
    <CTAFooter/>
  </div>
);

Object.assign(window, { Landing });
