// EduPilot — Onboarding par rôle (Teacher, Parent, Student, Super Admin)

// ─── Shell réutilisable (single-page, per-role) ─────────────
const RoleOnboardShell = ({ role, color = 'brand', user, hero, steps, currentStep, mainContent }) => (
  <div style={{ width: 1280, height: 800, display: 'grid', gridTemplateColumns: '380px 1fr', background: 'var(--surface-page)' }}>
    <aside style={{ padding: '40px 32px', background: `linear-gradient(170deg, var(--${color}-700), var(--${color}-900))`, color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <Logo size={28}/>
        <span className="display" style={{ fontSize: 16, fontWeight: 700 }}>EduPilot</span>
        <Badge size="sm" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', marginLeft: 'auto' }}>{role}</Badge>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 14 }}>Bienvenue</div>
      <h1 className="display" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 16px' }}>{hero.title}</h1>
      <p style={{ fontSize: 14, opacity: 0.88, lineHeight: 1.6, margin: '0 0 30px' }}>{hero.sub}</p>

      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 12 }}>Ta checklist · {currentStep}/{steps.length}</div>
        {steps.map((s, i) => {
          const done = i < currentStep - 1, current = i === currentStep - 1;
          return (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', alignItems: 'center', opacity: done ? 0.55 : 1 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 11,
                background: done ? 'rgba(255,255,255,0.85)' : current ? '#fff' : 'rgba(255,255,255,0.18)',
                color: done || current ? `var(--${color}-700)` : '#fff',
                display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{done ? <Icon name="check" size={12} strokeWidth={3}/> : i + 1}</div>
              <span style={{ fontSize: 12, fontWeight: current ? 700 : 500, textDecoration: done ? 'line-through' : 'none' }}>{s}</span>
            </div>
          );
        })}
      </div>
    </aside>

    <main style={{ display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px 36px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={user} size="sm"/>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Bonjour {user.split(' ')[0]} 👋</span>
        </div>
        <Button variant="ghost" size="sm">Passer la visite</Button>
      </header>
      <div style={{ flex: 1, padding: '32px 40px', overflow: 'hidden' }}>{mainContent}</div>
      <footer style={{ padding: '16px 36px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-card)' }}>
        <Button variant="ghost">← Revenir</Button>
        <Button iconRight="arrowRight" style={{ background: 'var(--gradient-cta)' }}>Étape suivante</Button>
      </footer>
    </main>
  </div>
);

// ─── 1 · TEACHER ────────────────────────────────────────────
const TeacherOnboarding = () => (
  <RoleOnboardShell
    role="ENSEIGNANT" color="brand" user="Paul Adjavon"
    hero={{
      title: 'Pour ta première saisie, commence simple.',
      sub: 'On t\'a affecté à 3 classes (3ᵉ A, 4ᵉ B, 6ᵉ C) en mathématiques. Saisis ta première note en 30 secondes — promis.',
    }}
    steps={['Compléter ton profil', 'Saisir ta première note', 'Faire un appel test', 'Configurer tes alertes', 'Découvrir l\'IA pédagogique']}
    currentStep={2}
    mainContent={
      <div>
        <h2 className="display" style={{ fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Saisis ta première note</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 22px' }}>Choisis une classe et un devoir test — on s'occupe du reste.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
          <Card style={{ border: '2px solid var(--brand-600)', background: 'var(--brand-50)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <SubLabel>Sélection</SubLabel>
              <Badge variant="brand" size="sm" icon="check">Choisi</Badge>
            </div>
            <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>3ᵉ A · DST test</div>
            <p style={{ fontSize: 12, color: 'var(--brand-800)', margin: '4px 0 0' }}>26 élèves · note sur 20 · coefficient 3</p>
          </Card>
          <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <SubLabel>Astuces gain de temps</SubLabel>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, lineHeight: 1.5 }}>
              <div>⇥ <strong>Tab</strong> passe à l'élève suivant</div>
              <div>🎙 <strong>Vocal</strong> dicte la note (icône micro)</div>
              <div>🤖 <strong>IA</strong> suggère une note d'après l'historique</div>
            </div>
          </Card>
        </div>

        <Card padding={0}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Saisie · 0/26 enregistrées</span>
            <Button size="sm" variant="ghost" icon="sparkle">Suggestion IA</Button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {[
                { n: 'Aïcha Hounsou', g: '16,5', s: 'editing' },
                { n: 'Mathieu Sossou', g: '—', s: 'pending' },
                { n: 'Fatou Adjavon', g: '—', s: 'pending' },
                { n: 'Marie Bossou', g: '—', s: 'pending' },
              ].map((r, i) => (
                <tr key={i} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
                  <td style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={r.n} size="xs"/><span style={{ fontWeight: 500 }}>{r.n}</span>
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    {r.s === 'editing' ? (
                      <span className="tabular" style={{ display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 12px', background: 'var(--brand-50)', border: '1.5px solid var(--brand-600)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--brand-800)' }}>
                        {r.g}<span style={{ width: 1, height: 14, background: 'var(--brand-700)', marginLeft: 4, animation: 'eduPulse 1s infinite' }}/>
                      </span>
                    ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, padding: 14, background: 'var(--brand-50)', borderRadius: 'var(--radius-md)' }}>
          <Icon name="sparkle" size={16} color="var(--brand-700)" style={{ marginTop: 2 }}/>
          <div style={{ fontSize: 12, color: 'var(--brand-900)', lineHeight: 1.55 }}>
            <strong>Bonus :</strong> dès que tu valides, EduPilot calcule automatiquement la moyenne classe, génère des alertes pour les élèves &lt; 10 et propose un soutien IA si besoin.
          </div>
        </div>
      </div>
    }/>
);

// ─── 2 · PARENT ─────────────────────────────────────────────
const ParentOnboarding = () => (
  <RoleOnboardShell
    role="PARENT" color="success" user="Patrick Hounsou"
    hero={{
      title: 'Suis ton enfant sans rien manquer.',
      sub: 'Lie son compte avec le matricule fourni par l\'école. Reçois notes, absences, paiements en temps réel — par SMS aussi si pas de wifi.',
    }}
    steps={['Lier mon premier enfant', 'Activer les SMS de secours', 'Configurer le paiement Mobile Money', 'Choisir mes préférences alertes', 'Inviter le co-parent']}
    currentStep={1}
    mainContent={
      <div>
        <h2 className="display" style={{ fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Lie ton premier enfant</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 22px' }}>L'école t'a remis un matricule à 7 chiffres + code de vérification (sur le carnet de liaison).</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          <Card>
            <SubLabel>Informations de liaison</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
              <Input label="Code établissement" icon="school" value="CBE-COT"/>
              <Input label="Matricule élève" icon="users" value="BJ-2026-A0142"/>
              <Input label="Code de vérification (6 chiffres)" icon="settings" value="724 891"/>
            </div>
            <div style={{ marginTop: 16, padding: 12, background: 'var(--success-50)', border: '1px solid var(--success-200)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="check" size={16} color="var(--success-700)" style={{ marginTop: 2 }}/>
              <div style={{ fontSize: 12, color: 'var(--success-900)', lineHeight: 1.55 }}>
                <strong>Lien confirmé</strong> · tu es bien le parent d'<strong>Aïcha Hounsou (3ᵉ A)</strong>. Mathieu Hounsou (CM1) a été détecté — l'ajouter aussi ?
              </div>
            </div>
            <Button variant="secondary" size="sm" icon="plus" style={{ marginTop: 12 }}>Ajouter Mathieu</Button>
          </Card>

          <Card style={{ background: 'linear-gradient(135deg, var(--success-50), var(--brand-50))', border: '1px solid var(--success-200)' }}>
            <Avatar name="Aïcha Hounsou" size="lg" style={{ width: 72, height: 72, margin: '0 auto 14px', display: 'block' }}/>
            <div className="display" style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', letterSpacing: '-0.02em' }}>Aïcha Hounsou</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 2 }}>3ᵉ A · née le 12/03/2012</div>

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--success-200)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Moyenne actuelle</div>
                <div className="display tabular" style={{ fontSize: 22, fontWeight: 700, color: 'var(--success-700)', marginTop: 2 }}>14,8</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Présence</div>
                <div className="display tabular" style={{ fontSize: 22, fontWeight: 700, color: 'var(--success-700)', marginTop: 2 }}>96%</div>
              </div>
            </div>
          </Card>
        </div>

        <Card style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Icon name="sms" size={20} color="var(--success-700)"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Activer les SMS de secours</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Reçois les alertes même hors connexion · 94% de lecture en moins de 5 min</div>
            </div>
            <span style={{ display: 'inline-flex', width: 40, height: 22, borderRadius: 11, background: 'var(--success-600)', position: 'relative', cursor: 'pointer' }}>
              <span style={{ position: 'absolute', top: 2, left: 20, width: 18, height: 18, borderRadius: 9, background: '#fff' }}/>
            </span>
          </div>
        </Card>
      </div>
    }/>
);

// ─── 3 · STUDENT ────────────────────────────────────────────
const StudentOnboarding = () => (
  <RoleOnboardShell
    role="ÉLÈVE" color="warning" user="Aïcha Hounsou"
    hero={{
      title: 'Salut Aïcha 👋 prépare-toi à exploser tes scores.',
      sub: 'Une appli rien que pour toi : tes notes, tes devoirs, tes badges, ton classement. Choisis ton avatar et fixe-toi un objectif pour le trimestre.',
    }}
    steps={['Personnaliser mon profil', 'Choisir mon premier objectif', 'Découvrir mes 8 cours', 'Activer les rappels devoirs', 'Premier badge surprise']}
    currentStep={2}
    mainContent={
      <div>
        <h2 className="display" style={{ fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Choisis ton premier objectif du trimestre</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 22px' }}>Un seul à la fois — on suit ta progression et on te débloque un badge quand tu l'atteins.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { icon: 'trophy', l: 'Top 3 de la classe', sub: 'Tu es 4ᵉ. Plus que 0,3 pts.', c: 'warning', selected: true, badge: 'Or' },
            { icon: 'flame', l: '30 jours sans absence', sub: 'Série actuelle : 14 jours', c: 'danger', badge: 'Argent' },
            { icon: 'book', l: 'Lire 5 livres', sub: '3/5 lus · "Une si longue lettre"', c: 'info', badge: 'Argent' },
            { icon: 'check', l: '100% devoirs rendus', sub: '3 devoirs en cours', c: 'success', badge: 'Or' },
            { icon: 'users', l: 'Aider 3 camarades', sub: 'Tutorat math · 1/3', c: 'brand', badge: 'Bronze' },
            { icon: 'sparkle', l: '+1 pt en français', sub: 'Tu es à 13,0/20', c: 'brand', badge: 'Argent' },
          ].map((o, i) => (
            <Card key={i} padding={20} style={{
              border: o.selected ? `2px solid var(--${o.c}-600)` : '1px solid var(--border-default)',
              background: o.selected ? `var(--${o.c}-50)` : 'var(--surface-card)',
              position: 'relative', cursor: 'pointer',
            }}>
              {o.selected && <Badge variant={o.c} size="sm" icon="check" style={{ position: 'absolute', top: 10, right: 10 }}>Choisi</Badge>}
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `var(--${o.c}-100)`, display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                <Icon name={o.icon} size={24} color={`var(--${o.c}-700)`}/>
              </div>
              <div className="display" style={{ fontSize: 16, fontWeight: 700 }}>{o.l}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{o.sub}</div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="trophy" size={11} color={`var(--${o.c}-700)`}/>
                <span style={{ fontSize: 11, fontWeight: 700, color: `var(--${o.c}-800)` }}>Badge {o.badge}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    }/>
);

// ─── 4 · SUPER ADMIN ───────────────────────────────────────
const SuperAdminOnboarding = () => (
  <RoleOnboardShell
    role="SUPER ADMIN" color="danger" user="Marc Dossou"
    hero={{
      title: 'Prends le contrôle de ton réseau d\'établissements.',
      sub: 'Configure SSO, importe tes 8 écoles, définis les standards qualité du réseau. Vue consolidée temps réel dès la fin.',
    }}
    steps={['Vérifier le domaine entreprise', 'Activer SSO Microsoft / Google', 'Importer mes 8 établissements', 'Définir KPIs réseau', 'Inviter mon équipe centrale']}
    currentStep={3}
    mainContent={
      <div>
        <h2 className="display" style={{ fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Importer mes établissements</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 22px' }}>Ajoute-les un à un, ou importe via Excel. Chaque établissement reste indépendant côté pédagogie · données consolidées pour toi.</p>

        <Card padding={0}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>4 / 8 établissements connectés</span>
            <Button size="sm" icon="plus">Ajouter</Button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {[
                { n: 'Excellence Cotonou', loc: 'Cotonou · Akpakpa', stat: 'Synchro · 1 248 élèves', v: 'success' },
                { n: 'Excellence Calavi', loc: 'Abomey-Calavi', stat: 'Synchro · 982 élèves', v: 'success' },
                { n: 'Excellence Porto-Novo', loc: 'Porto-Novo', stat: 'Synchro · 1 140 élèves', v: 'success' },
                { n: 'Excellence Parakou', loc: 'Parakou', stat: 'Import en cours · 64%', v: 'warning' },
                { n: 'Excellence Bohicon', loc: 'Bohicon', stat: 'À configurer', v: 'neutral' },
                { n: 'Excellence Lokossa', loc: 'Lokossa', stat: 'À configurer', v: 'neutral' },
                { n: 'Excellence Natitingou', loc: 'Natitingou', stat: 'À configurer', v: 'neutral' },
                { n: 'Excellence Djougou', loc: 'Djougou', stat: 'À configurer', v: 'neutral' },
              ].map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={s.n} size="sm"/>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.n}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.loc}</div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 18px' }}><Badge variant={s.v} size="sm" dot={s.v === 'warning'}>{s.stat}</Badge></td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    <Button variant="ghost" size="sm" iconRight="arrowRight">{s.v === 'neutral' ? 'Configurer' : 'Détail'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
          {[
            { l: 'Total élèves réseau', v: '3 370', sub: 'des 4 sites actifs' },
            { l: 'Données chiffrées', v: '256-bit', sub: 'AES isolation par site' },
            { l: 'SLA contractuel', v: '99,9%', sub: '< 200ms latence garantie' },
          ].map(s => (
            <Card key={s.l} padding={14}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
              <div className="display tabular" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.sub}</div>
            </Card>
          ))}
        </div>
      </div>
    }/>
);

Object.assign(window, { TeacherOnboarding, ParentOnboarding, StudentOnboarding, SuperAdminOnboarding });
