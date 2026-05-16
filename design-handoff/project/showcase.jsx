// EduPilot — Design System Showcase artboard
// Renders tokens (color, type, spacing, radius), foundation components, and
// edu-business components on a single tall artboard for review.

const Section = ({ title, eyebrow, children, gap = 20 }) => (
  <div style={{ marginBottom: 40 }}>
    <div style={{ marginBottom: 18 }}>
      {eyebrow && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand-700)', marginBottom: 6 }}>{eyebrow}</div>}
      <h2 className="display" style={{ fontSize: 28, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>{title}</h2>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>
  </div>
);

const SubLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{children}</div>
);

// ── Color swatches ──
const ColorRamp = ({ name, varName, label }) => {
  const tints = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>--{varName}-*</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
        {tints.map(t => (
          <div key={t} style={{
            aspectRatio: '1', borderRadius: 8,
            background: `var(--${varName}-${t})`,
            border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'flex-end', padding: 6,
            fontSize: 9, fontWeight: 600,
            color: t >= 500 ? 'rgba(255,255,255,0.9)' : 'var(--neutral-700)',
            fontVariantNumeric: 'tabular-nums',
          }}>{t}</div>
        ))}
      </div>
    </div>
  );
};

// ── Type sample ──
const TypeRow = ({ size, label, sample, family, weight = 600 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '90px 80px 1fr', gap: 16, alignItems: 'baseline', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
    <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
    <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{size}</span>
    <span style={{ fontFamily: family, fontSize: parseInt(size), fontWeight: weight, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{sample}</span>
  </div>
);

// ── Spacing ──
const SpaceTile = ({ value, name }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <div style={{ width: 64, height: 64, background: 'var(--surface-sunken)', borderRadius: 8, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: value, height: value, background: 'var(--brand-700)', borderRadius: 2 }}/>
    </div>
    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
    <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{value}px</div>
  </div>
);

// ── Radius ──
const RadiusTile = ({ name, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <div style={{ width: 60, height: 60, background: 'var(--brand-700)', borderRadius: value }}/>
    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
    <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{value}</div>
  </div>
);

// ── Shadow tile ──
const ShadowTile = ({ name, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
    <div style={{ width: 90, height: 60, background: 'var(--surface-card)', borderRadius: 12, boxShadow: value }}/>
    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
  </div>
);

// ── Showcase artboard ──
const Showcase = () => {
  return (
    <div style={{
      width: 1100, padding: '40px 44px', background: 'var(--surface-page)',
      color: 'var(--text-primary)', minHeight: 100,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, paddingBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Logo size={36}/>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand-700)' }}>Design System v2 · 2026</div>
            </div>
          </div>
          <h1 className="display" style={{ fontSize: 56, margin: 0, lineHeight: 0.95, letterSpacing: '-0.04em' }}>
            EduPilot <span style={{ color: 'var(--brand-700)' }}>—</span> chaud, précis, intelligent.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 720, marginTop: 16, lineHeight: 1.55 }}>
            Un système conçu pour l'éducation africaine. <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Je connais ton rôle, je sais ce qui compte aujourd'hui, je t'aide à agir vite.</span> EN/FR · WCAG AA · Dark mode · Mobile-first.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
          <span>Tokens · Foundation · Edu</span>
          <span className="mono">v2.0.0-alpha</span>
        </div>
      </div>

      {/* Colors */}
      <Section eyebrow="Étape 1 / Tokens" title="Couleurs sémantiques">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          <ColorRamp varName="brand" label="Brand · marque institutionnelle"/>
          <ColorRamp varName="success" label="Success · réussite, paiement"/>
          <ColorRamp varName="info" label="Info · cours, neutre"/>
          <ColorRamp varName="warning" label="Warning · vigilance, retard"/>
          <ColorRamp varName="danger" label="Danger · incident, urgent"/>
          <ColorRamp varName="neutral" label="Neutral · structure, secondaire"/>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, padding: 16, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          <Icon name="info" size={16} color="var(--brand-700)" style={{ marginTop: 2 }}/>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Sémantique non-négociable.</strong> Vert = progrès / paiement OK. Bleu = info / cours. Ambre = vigilance. Rouge = critique. Une couleur ne décore jamais — elle informe.
          </div>
        </div>
      </Section>

      {/* Typography */}
      <Section eyebrow="Étape 1 / Tokens" title="Typographie">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <SubLabel>Display · Bricolage Grotesque</SubLabel>
            <TypeRow label="4xl" size="48px" family="var(--font-display)" weight={700} sample="L'année avance bien."/>
            <TypeRow label="3xl" size="36px" family="var(--font-display)" weight={700} sample="Bonjour Mme Sossou."/>
            <TypeRow label="2xl" size="28px" family="var(--font-display)" weight={600} sample="Carnet de notes — 4ᵉ B"/>
            <TypeRow label="xl"  size="22px" family="var(--font-display)" weight={600} sample="Bulletin trimestriel"/>
          </div>
          <div>
            <SubLabel>Body · Plus Jakarta Sans</SubLabel>
            <TypeRow label="lg"   size="18px" family="var(--font-body)" weight={500} sample="Paiement de scolarité confirmé."/>
            <TypeRow label="md"   size="16px" family="var(--font-body)" weight={500} sample="3 absences cette semaine"/>
            <TypeRow label="base" size="14px" family="var(--font-body)" weight={400} sample="Mathématiques · 14h00 · Salle 207"/>
            <TypeRow label="sm"   size="13px" family="var(--font-body)" weight={400} sample="Modifié il y a 4 minutes par M. Adjavon"/>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <Card style={{ flex: 1 }}>
            <SubLabel>Tabular numerals (chiffres alignés)</SubLabel>
            <div style={{ display: 'flex', gap: 32, alignItems: 'baseline' }}>
              <div>
                <div className="display tabular" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>14,75</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Moyenne classe</div>
              </div>
              <div>
                <div className="display tabular" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>248 500</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>FCFA encaissés</div>
              </div>
              <div>
                <div className="display tabular" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>92,4<span style={{ fontSize: '0.55em', color: 'var(--text-tertiary)' }}>%</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Présence semaine</div>
              </div>
            </div>
          </Card>
        </div>
      </Section>

      {/* Spacing + Radius + Shadows */}
      <Section eyebrow="Étape 1 / Tokens" title="Espacement, rayons, ombres">
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 24 }}>
          <Card>
            <SubLabel>Spacing · 4px base</SubLabel>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <SpaceTile name="space-2" value={8}/>
              <SpaceTile name="space-3" value={12}/>
              <SpaceTile name="space-4" value={16}/>
              <SpaceTile name="space-6" value={24}/>
              <SpaceTile name="space-8" value={32}/>
              <SpaceTile name="space-12" value={48}/>
            </div>
          </Card>
          <Card>
            <SubLabel>Radius</SubLabel>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between' }}>
              <RadiusTile name="md" value={10}/>
              <RadiusTile name="lg" value={14}/>
              <RadiusTile name="xl" value={20}/>
              <RadiusTile name="2xl" value={28}/>
            </div>
          </Card>
          <Card>
            <SubLabel>Shadows</SubLabel>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <ShadowTile name="sm" value="var(--shadow-sm)"/>
              <ShadowTile name="md" value="var(--shadow-md)"/>
              <ShadowTile name="lg" value="var(--shadow-lg)"/>
              <ShadowTile name="pop" value="var(--shadow-pop)"/>
            </div>
          </Card>
        </div>
      </Section>

      {/* Buttons */}
      <Section eyebrow="Étape 2 / Foundation" title="Boutons">
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, auto)', gap: 18, alignItems: 'center', justifyContent: 'flex-start' }}>
            <SubLabel>Primary</SubLabel>
            <Button size="sm">Enregistrer</Button>
            <Button size="md" icon="check">Valider l'appel</Button>
            <Button size="lg" icon="plus">Ajouter une note</Button>
            <Button loading>Loading…</Button>

            <SubLabel>Secondary</SubLabel>
            <Button variant="secondary" size="sm">Annuler</Button>
            <Button variant="secondary" size="md" icon="download">Exporter CSV</Button>
            <Button variant="secondary" size="lg" iconRight="arrowRight">Voir bulletin</Button>
            <Button variant="secondary" disabled>Bloqué</Button>

            <SubLabel>Soft / Ghost</SubLabel>
            <Button variant="soft" size="sm" icon="sparkle">IA</Button>
            <Button variant="ghost" size="md" icon="filter">Filtrer</Button>
            <Button variant="ghost" size="md" icon="settings">Paramètres</Button>
            <Button variant="danger" size="md" icon="x">Supprimer</Button>
          </div>
        </Card>
      </Section>

      {/* Badges */}
      <Section eyebrow="Étape 2 / Foundation" title="Badges & statuts">
        <Card>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge variant="success" icon="check">Payé</Badge>
            <Badge variant="success" dot>En ligne</Badge>
            <Badge variant="warning" icon="clock">3 jours restants</Badge>
            <Badge variant="warning">Retard</Badge>
            <Badge variant="danger" icon="warning">Absent</Badge>
            <Badge variant="danger" dot>Action requise</Badge>
            <Badge variant="info" icon="book">Cours en direct</Badge>
            <Badge variant="brand">Bourse</Badge>
            <Badge variant="neutral">Brouillon</Badge>
            <Badge variant="success" size="sm">+0,8 pts</Badge>
            <Badge variant="danger" size="sm">−2,1 pts</Badge>
          </div>
        </Card>
      </Section>

      {/* Inputs */}
      <Section eyebrow="Étape 2 / Foundation" title="Champs de saisie">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Input label="Nom de l'élève" icon="users" value="Aïcha Hounsou"/>
          <Input label="Téléphone parent" icon="sms" value="+229 95 12 34 56" helper="SMS automatique activé"/>
          <Input label="Note /20" icon="pencil" error="Note obligatoire"/>
          <Input label="Recherche" icon="search" placeholder="Élève, classe, matière…"/>
          <Input label="Date de naissance" icon="calendar" value="14 / 03 / 2012"/>
          <Input label="Frais scolarité" icon="money" value="125 000 FCFA"/>
        </div>
      </Section>

      {/* Avatars + Progress */}
      <Section eyebrow="Étape 2 / Foundation" title="Avatars · Progress">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
          <Card>
            <SubLabel>Avatars · 4 tailles · états</SubLabel>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
              <Avatar name="Aïcha Hounsou" size="xs"/>
              <Avatar name="Mathieu Sossou" size="sm" status="online"/>
              <Avatar name="Fatou Adjavon" size="md" status="away"/>
              <Avatar name="Koffi Dossou" size="lg" status="busy"/>
              <Avatar name="Bénin Excellence" size="xl"/>
            </div>
            <SubLabel>Stack · classe</SubLabel>
            <div style={{ display: 'flex' }}>
              {['Aïcha H', 'Mathieu S', 'Fatou A', 'Koffi D', 'Marie B'].map((n, i) => (
                <div key={i} style={{ marginLeft: i ? -10 : 0, boxShadow: '0 0 0 2px var(--surface-card)', borderRadius: '50%' }}>
                  <Avatar name={n} size="md"/>
                </div>
              ))}
              <div style={{ marginLeft: -10, width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-card)', boxShadow: '0 0 0 2px var(--surface-card), inset 0 0 0 1px var(--border-default)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>+27</div>
            </div>
          </Card>
          <Card>
            <SubLabel>Progress</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Progress label="Trimestre 2" sublabel="68%" value={68} variant="brand"/>
              <Progress label="Paiements collectés" sublabel="92%" value={92} variant="success"/>
              <Progress label="Élèves à risque" sublabel="14%" value={14} variant="warning"/>
              <Progress label="Incidents non traités" sublabel="3%" value={3} variant="danger"/>
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 18, alignItems: 'center' }}>
              <RingProgress value={68} size={62} variant="brand">
                <span className="display tabular" style={{ fontSize: 14, fontWeight: 700 }}>68%</span>
              </RingProgress>
              <RingProgress value={92} size={62} variant="success">
                <span className="display tabular" style={{ fontSize: 14, fontWeight: 700 }}>92%</span>
              </RingProgress>
              <RingProgress value={14} size={62} variant="warning">
                <span className="display tabular" style={{ fontSize: 14, fontWeight: 700 }}>14%</span>
              </RingProgress>
              <RingProgress value={3} size={62} variant="danger">
                <span className="display tabular" style={{ fontSize: 14, fontWeight: 700 }}>3%</span>
              </RingProgress>
            </div>
          </Card>
        </div>
      </Section>

      {/* Toasts */}
      <Section eyebrow="Étape 2 / Foundation" title="Toasts & notifications">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Toast variant="success" title="Paiement Flutterwave reçu" body="Aïcha Hounsou — 125 000 FCFA · Trimestre 2." action="Voir reçu"/>
          <Toast variant="warning" title="3 absences cette semaine" body="Koffi Dossou (4ᵉ B). SMS parent envoyé." action="Contacter parent"/>
          <Toast variant="danger" title="Incident infirmerie" body="Marie B. — chute, suivi médical en cours."/>
          <Toast variant="info" title="Insight IA" body="Les notes en math chutent depuis 2 semaines en CM2-A."/>
        </div>
      </Section>

      {/* Edu metric cards */}
      <Section eyebrow="Étape 3 / Edu Components" title="MetricCard · KPIs sémantiques">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          <MetricCard label="Élèves actifs" value="1 248" trend={4.2} trendLabel="vs trim. 1" icon="users" variant="brand"/>
          <MetricCard label="Recouvrement" value="82" unit="%" trend={6.1} trendLabel="vs trim. 1" icon="money" variant="success"/>
          <MetricCard label="Présence" value="92,4" unit="%" trend={-1.3} trendLabel="vs sem. dern." icon="check" variant="info"/>
          <MetricCard label="Élèves à risque" value="38" trend={12} trendLabel="cette semaine" icon="warning" variant="warning"/>
          <MetricCard label="Incidents" value="2" trend={-50} trendLabel="vs sem. dern." icon="danger" variant="danger"/>
        </div>
      </Section>

      {/* Notification items */}
      <Section eyebrow="Étape 3 / Edu Components" title="NotificationItem · 6 variants">
        <Card padding={8}>
          <NotifItem type="urgent" priority="P0" title="Incident infirmerie — Marie Bossou (CE2-A)" body="Chute dans la cour à 10h45. Infirmière sur place. Parent notifié par SMS."
            time="il y a 4 min" sender="Mme Akpovi" actions={['Voir dossier', 'Contacter parent']}/>
          <NotifItem type="warning" title="3 absences cette semaine — Koffi Dossou (4ᵉ B)"
            body="Regroupement automatique de 3 alertes individuelles."
            time="il y a 1 h" actions={['Voir détail']}/>
          <NotifItem type="success" title="Paiement reçu via Paystack" body="Aïcha Hounsou — 125 000 FCFA · Trimestre 2 confirmé." time="il y a 2 h"/>
          <NotifItem type="info" title="Conseil de classe demain à 16h00" body="6ᵉ A — bulletins à valider avant 14h." time="hier, 18:30"/>
          <NotifItem type="reminder" title="Saisie des notes : DST math" body="62 / 84 notes saisies. Échéance vendredi 17h." time="hier"/>
          <NotifItem type="sms" title="SMS envoyé à 24 parents" body="Rappel paiement échéance 1ʳᵉ tranche. 18 lus, 6 en attente." time="14h12" sender="Système"/>
        </Card>
      </Section>

      {/* Footer signoff */}
      <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)' }}>
        <span>EduPilot Design System — pilotée par les rôles, alignée sur le terrain béninois.</span>
        <span className="mono">tokens.css · components.jsx</span>
      </div>
    </div>
  );
};

// ─── Logo ────────────────────────────────────────────────────
const Logo = ({ size = 32, mono }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.28, background: mono ? 'var(--text-primary)' : 'var(--brand-800)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
      <path d="M3 8 L12 4 L21 8 L12 12 Z" fill="rgba(255,255,255,0.95)"/>
      <path d="M6 11 V 16 C 6 18, 9 19.5, 12 19.5 C 15 19.5, 18 18, 18 16 V 11" stroke="rgba(255,255,255,0.95)" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      <circle cx="20.5" cy="10" r="1" fill="var(--brand-300)"/>
    </svg>
  </div>
);

Object.assign(window, { Showcase, Logo });
