// EduPilot — Valeur ajoutée v2 · sprint final
// 1. Cellule d'écoute & bien-être (signalement anonyme, suivi psy)
// 2. Notifications vocales multilingues (Fon, Yoruba, Bariba — parents non-alphabétisés)
// 3. Comptabilité OHADA & Caisse (recettes/dépenses, plan SYSCOHADA, export DGI)
// 4. Benchmark national MEMP (positionnement, comparatifs anonymisés)
// 5. Wallet école Mobile Money (MTN, Moov, Celtiis · rapprochement auto)
// 6. Cagnotte / pot commun de classe (sorties scolaires, fournitures partagées)

// ─── helpers locaux ─────────────────────────────────────────
const KPI = ({ label, value, unit, hint, c = 'brand', big }) => (
  <div style={{
    padding: big ? 20 : 16, borderRadius: 14,
    background: `var(--${c}-50)`, border: `1px solid var(--${c}-200)`,
  }}>
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: `var(--${c}-700)` }}>{label}</div>
    <div className="display tabular" style={{ fontSize: big ? 38 : 28, fontWeight: 800, color: `var(--${c}-900)`, marginTop: 4, lineHeight: 1 }}>
      {value}{unit && <span style={{ fontSize: big ? 14 : 12, fontWeight: 600, color: `var(--${c}-700)`, marginLeft: 4 }}>{unit}</span>}
    </div>
    {hint && <div style={{ fontSize: 11, color: `var(--${c}-800)`, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
  </div>
);

const VABox = ({ title, sub, children, right }) => (
  <Card padding={0} style={{ marginBottom: 14 }}>
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <h3 className="display" style={{ fontSize: 16, margin: 0 }}>{title}</h3>
        {sub && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>{sub}</p>}
      </div>
      {right}
    </div>
    {children}
  </Card>
);

// ═══ 1 · CELLULE D'ÉCOUTE & BIEN-ÊTRE ═══════════════════════
const WellbeingPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="Cellule d'écoute & bien-être"
      sub="Climat scolaire · signalements anonymes · suivi psychologique · prévention harcèlement"
      breadcrumb={['Vie scolaire', 'Bien-être & cellule d\'écoute']}>
      <Badge variant="success" icon="check">Conforme protocole MEMP 2024</Badge>
      <Button variant="secondary" icon="download">Rapport climat</Button>
      <Button icon="plus">Nouveau dossier</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <KPI label="Signalements actifs" value="7" hint="3 anonymes · 4 nominatifs" c="warning"/>
      <KPI label="Dossiers psy en cours" value="24" hint="14 suivi régulier · 10 ponctuel" c="brand"/>
      <KPI label="Climat scolaire" value="7,4" unit="/10" hint="Pulse anonyme · 942 réponses" c="success"/>
      <KPI label="Audiences cette sem." value="18" hint="12 individuelles · 6 collectives" c="info"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <VABox title="Signalements récents · cellule d'écoute" sub="Tous chiffrés bout-en-bout · accès restreint au psychologue + direction"
          right={<Chip active>Tous · 7</Chip>}>
          {[
            { tag: 'ANONYME', name: 'Élève · 4ᵉ B', sub: 'Harcèlement répété par camarade · pendant la récré', cat: 'Harcèlement', when: 'Il y a 2h', sev: 'danger', sevL: 'P0 · urgent' },
            { tag: 'PARENT', name: 'Famille Dossou', sub: 'Mon fils ne veut plus venir le mercredi', cat: 'Anxiété scolaire', when: 'Hier', sev: 'warning', sevL: 'P1' },
            { tag: 'ENSEIGNANT', name: 'Mme Bossou · CE2-A', sub: 'Marie B. dessine sans cesse des images sombres', cat: 'Signal faible', when: 'Hier', sev: 'warning', sevL: 'P1' },
            { tag: 'ANONYME', name: 'Élève · 3ᵉ A', sub: 'Difficultés à la maison · violence verbale du beau-père', cat: 'Protection enfance', when: '2 jours', sev: 'danger', sevL: 'P0 · CPS prévenu' },
            { tag: 'AUTO·IA', name: '6ᵉ C · cluster', sub: 'Chute de présence collective · 4 élèves même quartier', cat: 'Décrochage groupe', when: '3 jours', sev: 'info', sevL: 'P2' },
            { tag: 'NOMINATIF', name: 'Pierre Akin · 4ᵉ B', sub: 'Idées noires évoquées au journal intime (lu par maman)', cat: 'Risque vital', when: '4 jours', sev: 'danger', sevL: 'P0 · suivi actif' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '88px 1fr auto', gap: 14, padding: '14px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0, alignItems: 'center', background: r.sev === 'danger' ? 'var(--danger-50)' : 'transparent' }}>
              <Badge variant={r.tag === 'ANONYME' ? 'neutral' : r.tag === 'AUTO·IA' ? 'brand' : 'info'} size="sm">{r.tag}</Badge>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 6 }}>· {r.cat}</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>"{r.sub}"</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.when}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <Badge variant={r.sev} size="sm" dot={r.sev === 'danger'}>{r.sevL}</Badge>
                <Button variant="ghost" size="sm" iconRight="arrowRight">Dossier</Button>
              </div>
            </div>
          ))}
        </VABox>

        <Card padding={20}>
          <SubLabel>Climat scolaire · pulse anonyme hebdomadaire</SubLabel>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, height: 130, gap: 8 }}>
            {[
              { w: 'S1', v: 6.8 }, { w: 'S2', v: 7.0 }, { w: 'S3', v: 6.4 },
              { w: 'S4', v: 6.9 }, { w: 'S5', v: 7.2 }, { w: 'S6', v: 7.1 },
              { w: 'S7', v: 7.4 }, { w: 'S8', v: 7.4, now: true },
            ].map(b => (
              <div key={b.w} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div className="tabular" style={{ fontSize: 11, fontWeight: 700, color: b.now ? 'var(--success-700)' : 'var(--text-secondary)' }}>{b.v}</div>
                <div style={{ width: '100%', maxWidth: 36, height: `${b.v * 12}px`, borderRadius: 6, background: b.now ? 'var(--success-600)' : 'var(--success-200)' }}/>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{b.w}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            {[
              { l: 'Je me sens en sécurité', v: '88%', c: 'success' },
              { l: 'J\'ai un ami proche', v: '92%', c: 'success' },
              { l: 'Un adulte m\'écoute', v: '74%', c: 'warning' },
              { l: 'Témoin harcèlement', v: '12%', c: 'danger' },
            ].map(s => (
              <div key={s.l}>
                <div className="display tabular" style={{ fontSize: 22, fontWeight: 800, color: `var(--${s.c}-700)` }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card padding={20} style={{ background: 'linear-gradient(135deg, var(--brand-700), var(--accent-600))', color: '#fff', border: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.8 }}>Bouton SOS · accès élève</div>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, lineHeight: 1.2 }}>"Je veux parler à quelqu'un"</div>
          <p style={{ fontSize: 12, opacity: 0.9, marginTop: 10, lineHeight: 1.6 }}>
            Bouton permanent dans l'app élève · ouvre un canal direct chiffré avec le psychologue. Anonyme par défaut, le jeune décide à quel moment se nommer.
          </p>
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,255,255,0.12)', borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>📊 142 utilisations en 30 jours</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>→ 38 conversations courtes · 12 prises en charge · 92 simple écoute</div>
          </div>
        </Card>

        <Card padding={0}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Agenda psychologue · cette semaine</h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Mme Sodjinou · 18h disponibles · 14 réservées</p>
          </div>
          {[
            { d: 'Lun', t: '09:00', n: 'Aïcha H.', cat: 'Suivi régulier', c: 'brand' },
            { d: 'Lun', t: '14:00', n: 'Famille Dossou', cat: 'Entretien parents', c: 'info' },
            { d: 'Mar', t: '10:30', n: 'Anonyme · 3ᵉ A', cat: 'Première écoute', c: 'warning' },
            { d: 'Mer', t: '11:00', n: 'Atelier 6ᵉ', cat: 'Groupe · estime de soi', c: 'success' },
            { d: 'Jeu', t: '15:00', n: 'Pierre Akin', cat: 'Suivi P0', c: 'danger' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 12, padding: '10px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>{r.d}</div>
                <div className="tabular" style={{ fontSize: 13, fontWeight: 700 }}>{r.t}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{r.n}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.cat}</div>
              </div>
              <Badge variant={r.c} size="sm" dot={r.c === 'danger'}>{r.c === 'danger' ? 'P0' : 'OK'}</Badge>
            </div>
          ))}
        </Card>

        <Card padding={16} style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Icon name="sparkle" size={18} color="var(--brand-700)" style={{ marginTop: 2 }}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-900)' }}>Détection IA · signaux faibles</div>
              <p style={{ fontSize: 12, color: 'var(--brand-800)', margin: '4px 0 0', lineHeight: 1.55 }}>
                Croisement absences + chute notes + commentaires enseignants → alerte si pattern de décrochage. Modèle entraîné sur 8 000 trajectoires anonymisées.
              </p>
              <div style={{ fontSize: 11, color: 'var(--brand-700)', marginTop: 8, fontWeight: 600 }}>3 alertes IA en attente de validation →</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ═══ 2 · NOTIFICATIONS VOCALES MULTILINGUES ═════════════════
const VoiceNotifsPage = () => {
  const [lang, setLang] = React.useState('fon');
  const langs = [
    { k: 'fr', t: 'Français', sub: '54% des parents', flag: '🇫🇷' },
    { k: 'fon', t: 'Fɔngbè', sub: '32% des parents · sud BJ', flag: '🇧🇯' },
    { k: 'yor', t: 'Yorùbá', sub: '8% · plateau d\'Abomey', flag: '🇧🇯' },
    { k: 'bar', t: 'Bariba', sub: '4% · nord BJ', flag: '🇧🇯' },
    { k: 'din', t: 'Dendi', sub: '2% · Borgou', flag: '🇧🇯' },
  ];
  const samples = {
    fr: 'Bonjour Patrick. Le paiement de la scolarité d\'Aïcha en classe de 3ème A arrive à échéance le 11 mai. Le montant est de 125 000 francs CFA.',
    fon: 'A do gbɛ, Patrick. Aïcha tɔn azɔ̌ akwɛ́ ɖò 3ème A mɛ ɔ́, é jɛ ná sú ɖò azǎn 11 gɔ́ mɛ tɔn. Akwɛ́ ɔ́ nyí akwɛ́ FCFA 125 000.',
    yor: 'E kàárọ̀ Patrick. Owó ilé-ìwé Aïcha ní kíláàsì 3ème A ní láti san ní ọjọ́ 11 oṣù karùn-ún. Iye náà jẹ́ FCFA 125 000.',
    bar: 'Ǹ wʊ́n yɛ́n Patrick. Aïcha tʊn yɛ́rʊ ku 3ème A bɛɛ, sɔ́ nan kpɛnɛ ɛ́ ndi 11 mai. Sɔ́ wɛn nan tɛn 125 000 FCFA.',
    din: 'Mate fonda Patrick. Aïcha boŋo 3ème A ra, a ga ba zaaru 11 mai. Yenga ga ti FCFA 125 000.',
  };
  return (
    <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
      <PageTitle title="Notifications vocales multilingues"
        sub="Atteindre les 38% de parents qui ne lisent pas couramment le français · Fɔn · Yorùbá · Bariba · Dendi"
        breadcrumb={['Communication', 'Canaux', 'Vocal multilingue']}>
        <Badge variant="brand" icon="sparkle">Différenciateur EduPilot</Badge>
        <Button variant="secondary" icon="settings">Voix & narrateurs</Button>
        <Button icon="plus">Diffuser un message vocal</Button>
      </PageTitle>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <KPI label="Parents touchés ce mois" value="1 728" unit="/1 842" hint="93,8% · +24 pts vs SMS seul" c="success"/>
        <KPI label="Taux d'écoute" value="84" unit="%" hint="Message écouté jusqu'au bout" c="brand"/>
        <KPI label="Langues actives" value="5" hint="Synthèse IA + 12 narrateurs natifs" c="info"/>
        <KPI label="Coût / appel" value="18" unit="FCFA" hint="vs SMS · même portée" c="warning"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
        {/* Compose pane */}
        <Card padding={20}>
          <SubLabel>Composer · message vocal</SubLabel>

          <div style={{ marginTop: 12, marginBottom: 6, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>Modèle</div>
          <select style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid var(--border-default)', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface-card)' }}>
            <option>Rappel échéance scolarité (auto J-7)</option>
            <option>Absence enfant · le jour même</option>
            <option>Convocation conseil parents</option>
            <option>Bulletin disponible · à venir chercher</option>
            <option>Annonce libre</option>
          </select>

          <div style={{ marginTop: 14, marginBottom: 6, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>Texte original (français)</div>
          <textarea style={{ width: '100%', minHeight: 70, borderRadius: 10, border: '1px solid var(--border-default)', padding: 10, fontSize: 12, fontFamily: 'inherit', lineHeight: 1.55, background: 'var(--surface-card)', resize: 'vertical' }}
            defaultValue={samples.fr}/>

          <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 8 }}>Langues à diffuser · sélection multiple</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {langs.map(l => {
              const active = lang === l.k;
              return (
                <button key={l.k} onClick={() => setLang(l.k)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                  border: active ? '2px solid var(--brand-600)' : '1px solid var(--border-default)',
                  background: active ? 'var(--brand-50)' : 'var(--surface-card)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  <span style={{ fontSize: 20 }}>{l.flag}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--brand-900)' : 'var(--text-primary)' }}>{l.t}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{l.sub}</div>
                  </div>
                  {active && <Icon name="check" size={14} color="var(--brand-700)"/>}
                </button>
              );
            })}
          </div>

          <Button full style={{ marginTop: 14 }} icon="sparkle">Générer & diffuser à 1 842 parents</Button>
        </Card>

        {/* Preview pane */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card padding={20}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <SubLabel>Aperçu · {langs.find(l => l.k === lang).t}</SubLabel>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Traduit par modèle Naija-IA · validé par narrateur natif</div>
              </div>
              <Badge variant="success" size="sm" icon="check">Naturel · 4,7/5</Badge>
            </div>

            {/* faux audio player */}
            <div style={{ marginTop: 14, padding: 16, borderRadius: 14, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <button style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--brand-600)', border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <div style={{ flex: 1 }}>
                  {/* waveform fake */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 28 }}>
                    {Array.from({ length: 60 }).map((_, i) => {
                      const h = 4 + Math.abs(Math.sin(i * 0.7) + Math.cos(i * 0.31)) * 14;
                      const played = i < 18;
                      return <div key={i} style={{ flex: 1, height: h, borderRadius: 2, background: played ? 'var(--brand-600)' : 'var(--neutral-300)' }}/>;
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'mono' }}>
                    <span className="tabular">0:08</span><span className="tabular">0:28</span>
                  </div>
                </div>
                <Icon name="download" size={16} color="var(--text-tertiary)"/>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: 'var(--text-primary)', fontStyle: 'italic' }}>"{samples[lang]}"</p>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>
                Narrateur : <strong>Désiré Ahouangonou</strong> · voix masculine adulte · accent Cotonou.
                <a href="#" style={{ color: 'var(--brand-600)', marginLeft: 6 }}>Changer de voix</a>
              </div>
            </div>
          </Card>

          <Card padding={0}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="display" style={{ fontSize: 15, margin: 0 }}>Portée comparée · même message</h3>
              <Badge variant="brand" size="sm">+24 pts vocal vs SMS</Badge>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { l: 'Vocal multilingue', v: '94%', sub: 'Compris par tous les parents · 18 FCFA', c: 'success', w: '94%' },
                { l: 'WhatsApp', v: '88%', sub: 'Texte FR · 1 842 abonnés · 12 FCFA', c: 'brand', w: '88%' },
                { l: 'SMS texte', v: '70%', sub: 'Texte FR · 1 840 numéros · 25 FCFA', c: 'info', w: '70%' },
                { l: 'Email', v: '32%', sub: '1 240 emails · gratuit', c: 'warning', w: '32%' },
              ].map(c => (
                <div key={c.l} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 130 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c.l}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{c.sub}</div>
                  </div>
                  <div style={{ flex: 1, height: 10, background: 'var(--neutral-200)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: c.w, background: `var(--${c.c}-600)`, borderRadius: 5 }}/>
                  </div>
                  <span className="tabular display" style={{ width: 48, textAlign: 'right', fontSize: 16, fontWeight: 800, color: `var(--${c.c}-700)` }}>{c.v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding={16} style={{ background: 'var(--success-50)', border: '1px solid var(--success-200)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <Icon name="sparkle" size={18} color="var(--success-700)" style={{ marginTop: 2 }}/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success-900)' }}>Impact mesuré sur le recouvrement</div>
                <p style={{ fontSize: 12, color: 'var(--success-800)', margin: '4px 0 0', lineHeight: 1.6 }}>
                  Depuis l'activation des rappels vocaux en Fɔn, le taux de paiement à l'échéance est passé de <strong>71% → 88%</strong> chez les familles dont la maman ne lit pas le français.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashShell>
  );
};

// ═══ 3 · COMPTABILITÉ OHADA & CAISSE ════════════════════════
const AccountingPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="Comptabilité OHADA · exercice 2025-2026"
      sub="Plan SYSCOHADA révisé · clôture mensuelle · export DGI · réviseur Cabinet Aïvodji"
      breadcrumb={['Administration', 'Finance', 'Comptabilité']}>
      <Badge variant="success" icon="check">Conforme SYSCOHADA</Badge>
      <Button variant="secondary" icon="download">Export DGI · iTAS</Button>
      <Button icon="plus">Nouvelle écriture</Button>
    </PageTitle>

    {/* Soldes 3 sources */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <KPI label="Caisse · espèces" value="2,8" unit="M FCFA" hint="Pointé hier 18h · écart 0" c="warning"/>
      <KPI label="Banque · Ecobank" value="48,2" unit="M FCFA" hint="Compte 0341 · rapproché" c="brand"/>
      <KPI label="Mobile Money" value="6,4" unit="M FCFA" hint="MTN · Moov · Celtiis" c="success"/>
      <KPI label="Résultat exercice" value="+18,4" unit="M FCFA" hint="Marge nette 8,2% · vs +5,1% N-1" c="success" big/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <VABox title="Journal des opérations · mai 2026" sub="186 écritures · dernière saisie il y a 14 min · auto-équilibré"
          right={<><Chip active>Tous</Chip><Chip count={84}>Recettes</Chip><Chip count={102}>Dépenses</Chip></>}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: 'var(--surface-sunken)' }}>
              {['Date', 'N° pièce', 'Compte SYSCOHADA', 'Libellé', 'Débit', 'Crédit'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Débit' || h === 'Crédit' ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                { d: '14/05', p: 'FAC-2024', c: '70611 · Scolarité élèves', l: 'Aïcha Hounsou · trim. 2', deb: '', cre: '125 000' },
                { d: '14/05', p: 'BNK-882', c: '52100 · Banque Ecobank', l: 'Encaissement Flutterwave · A0142', deb: '125 000', cre: '' },
                { d: '14/05', p: 'PAI-066', c: '64100 · Salaires enseignants', l: 'Salaire juin · M. Adjavon', deb: '380 000', cre: '' },
                { d: '14/05', p: 'PAI-066', c: '57000 · Caisse', l: 'Décaissement espèces', deb: '', cre: '380 000' },
                { d: '13/05', p: 'FAC-2019', c: '70612 · Cantine', l: 'Repas 18 enfants · Famille Dossou', deb: '', cre: '54 000' },
                { d: '13/05', p: 'MOM-444', c: '52400 · MoMo MTN', l: 'Encaissement +229 97 11 22 33', deb: '54 000', cre: '' },
                { d: '12/05', p: 'CHR-201', c: '60400 · Fournitures', l: 'Achat papier rame · Librairie SOFIB', deb: '142 500', cre: '' },
                { d: '12/05', p: 'CHR-201', c: '57000 · Caisse', l: 'Sortie espèces', deb: '', cre: '142 500' },
              ].map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'mono', fontSize: 11, color: 'var(--text-tertiary)' }}>{r.d}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'mono', fontSize: 11, color: 'var(--brand-700)', fontWeight: 600 }}>{r.p}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11 }}>
                    <span className="mono" style={{ fontWeight: 700, marginRight: 4 }}>{r.c.split(' · ')[0]}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{r.c.split(' · ')[1]}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{r.l}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }} className="tabular">
                    {r.deb && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger-700)' }}>{r.deb}</span>}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }} className="tabular">
                    {r.cre && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success-700)' }}>{r.cre}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface-sunken)', borderTop: '2px solid var(--brand-600)' }}>
                <td colSpan={4} style={{ padding: '12px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Totaux période</td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }} className="tabular display">
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger-700)' }}>284,2 M</span>
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }} className="tabular display">
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--success-700)' }}>284,2 M</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </VABox>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card padding={0}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="display" style={{ fontSize: 15, margin: 0 }}>Postes principaux · charges</h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Cumul exercice · 224,8 M FCFA</p>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { c: '641', l: 'Salaires enseignants', v: 124, pct: 55, col: 'brand' },
              { c: '642', l: 'Charges sociales CNSS', v: 28, pct: 12, col: 'info' },
              { c: '604', l: 'Fournitures pédago', v: 18, pct: 8, col: 'warning' },
              { c: '622', l: 'Entretien locaux', v: 22, pct: 10, col: 'success' },
              { c: '626', l: 'Téléphone / internet', v: 6, pct: 3, col: 'danger' },
              { c: 'autre', l: 'Autres charges', v: 27, pct: 12, col: 'neutral' },
            ].map(p => (
              <div key={p.c}>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
                  <span className="mono" style={{ width: 40, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>{p.c}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{p.l}</span>
                  <span className="tabular display" style={{ fontSize: 13, fontWeight: 700 }}>{p.v} M</span>
                </div>
                <div style={{ height: 6, background: 'var(--neutral-100)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.pct}%`, background: `var(--${p.col === 'neutral' ? 'neutral-500' : `${p.col}-600`})`, borderRadius: 3 }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={16} style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
          <SubLabel>Échéances DGI · à venir</SubLabel>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { l: 'Déclaration TVA · mai', d: '15 juin', s: 'warning' },
              { l: 'Acompte IS · trim 2', d: '15 juin', s: 'warning' },
              { l: 'CNSS · cotisations mai', d: '30 mai', s: 'danger' },
              { l: 'Patente municipale', d: '31 juil.', s: 'info' },
            ].map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: i ? '1px solid var(--brand-200)' : 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: `var(--${e.s}-600)` }}/>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--brand-900)' }}>{e.l}</span>
                <Badge variant={e.s} size="sm">{e.d}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={16}>
          <SubLabel>Réviseur comptable</SubLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Avatar name="Cabinet Aïvodji" size="md"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Cabinet Aïvodji & Associés</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Mission audit · ord. exp. comp. Bénin</div>
            </div>
            <Badge variant="success" size="sm" dot>Live</Badge>
          </div>
          <Button variant="secondary" size="sm" full style={{ marginTop: 12 }} icon="sms">Envoyer le journal</Button>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ═══ 4 · BENCHMARK NATIONAL MEMP ════════════════════════════
const BenchmarkPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="Benchmark national · MEMP open data"
      sub="Positionnement de votre établissement parmi 4 280 collèges du Bénin · anonymisé"
      breadcrumb={['Analytics', 'Benchmark']}>
      <Badge variant="brand" size="sm">Données MEMP 2024-2025</Badge>
      <Button variant="secondary" icon="download">Rapport conseil d'administration</Button>
    </PageTitle>

    {/* Rang hero */}
    <Card style={{ background: 'linear-gradient(135deg, var(--brand-800), var(--accent-600))', color: '#fff', border: 0, marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, alignItems: 'center' }}>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>Classement national · BEPC 2024</div>
          <div className="display tabular" style={{ fontSize: 72, fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.04em', marginTop: 8 }}>187<span style={{ fontSize: 24, fontWeight: 700, opacity: 0.8 }}> ᵉ</span></div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>sur 4 280 collèges du Bénin</div>
          <div style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            <Icon name="arrowUp" size={12}/> +42 places vs 2023
          </div>
        </div>
        <div style={{ padding: 24, borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>Rang département · Littoral</div>
          <div className="display tabular" style={{ fontSize: 72, fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.04em', marginTop: 8 }}>12<span style={{ fontSize: 24, fontWeight: 700, opacity: 0.8 }}> ᵉ</span></div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>sur 184 collèges</div>
          <div style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            🏅 Top 7% département
          </div>
        </div>
        <div style={{ padding: 24, borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>Groupe pair · 28 collèges similaires</div>
          <div className="display tabular" style={{ fontSize: 72, fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.04em', marginTop: 8 }}>4<span style={{ fontSize: 24, fontWeight: 700, opacity: 0.8 }}> ᵉ</span></div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>Privés Cotonou · 800-1500 él.</div>
          <div style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            🥉 Podium attendu en 2026
          </div>
        </div>
      </div>
    </Card>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
      <VABox title="Comparatif détaillé · vous vs moyennes nationales"
        sub="Sources MEMP · DEC · OCDE Education at a Glance 2024">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--surface-sunken)' }}>
            {['Indicateur', 'Vous', 'Pair', 'Département', 'National', 'Position'].map((h, i) => (
              <th key={h} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              { l: 'Taux de réussite BEPC', v: '78%', p: '72%', d: '68%', n: '62%', vNum: 78, c: 'success', good: true },
              { l: 'Mention Bien et +', v: '24%', p: '18%', d: '15%', n: '11%', vNum: 24, c: 'success', good: true },
              { l: 'Taux d\'abandon', v: '3,2%', p: '4,1%', d: '5,8%', n: '7,4%', vNum: 3.2, c: 'success', good: true, inverse: true },
              { l: 'Parité filles/garçons', v: '52%', p: '48%', d: '46%', n: '42%', vNum: 52, c: 'success', good: true },
              { l: 'Heures cours / sem.', v: '28h', p: '30h', d: '29h', n: '27h', vNum: 28, c: 'warning', good: false },
              { l: 'Ratio élèves / prof', v: '22', p: '28', d: '34', n: '42', vNum: 22, c: 'success', good: true, inverse: true },
              { l: 'Présence enseignants', v: '94%', p: '88%', d: '82%', n: '78%', vNum: 94, c: 'success', good: true },
              { l: 'Accès Wi-Fi école', v: 'Oui', p: '64%', d: '32%', n: '18%', vNum: 100, c: 'success', good: true },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 12 }}>{r.l}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', background: 'var(--brand-50)' }}><span className="display tabular" style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-800)' }}>{r.v}</span></td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }} className="tabular">{r.p}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }} className="tabular">{r.d}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }} className="tabular">{r.n}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                  <Badge variant={r.c} size="sm" icon={r.good ? 'check' : 'warning'}>{r.good ? 'Au-dessus' : 'À combler'}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </VABox>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card padding={20} style={{ background: 'var(--success-50)', border: '1px solid var(--success-200)' }}>
          <SubLabel>Vos points forts · à mettre en avant</SubLabel>
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Taux de réussite BEPC > moyenne nationale +16 pts',
              'Ratio élèves/prof exceptionnel (22 vs national 42)',
              'Parité filles/garçons supérieure à l\'OMD',
              'Couverture Wi-Fi 100% (rare au Bénin)',
            ].map((t, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--success-900)', lineHeight: 1.5 }}>
                <Icon name="check" size={14} color="var(--success-700)" style={{ marginTop: 2, flexShrink: 0 }}/>{t}
              </li>
            ))}
          </ul>
        </Card>

        <Card padding={20} style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-200)' }}>
          <SubLabel>Axes d'amélioration prioritaires</SubLabel>
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Heures de cours : −2h/sem vs pair · revoir EDT',
              'Maths · moyenne 11,8 vs pair 12,9 (−1,1 pt)',
              'Activités sportives extra : 1 vs 2,3 chez pair',
            ].map((t, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--warning-900)', lineHeight: 1.5 }}>
                <Icon name="warning" size={14} color="var(--warning-700)" style={{ marginTop: 2, flexShrink: 0 }}/>{t}
              </li>
            ))}
          </ul>
        </Card>

        <Card padding={16} style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Icon name="sparkle" size={18} color="var(--brand-700)" style={{ marginTop: 2, flexShrink: 0 }}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-900)' }}>Plan d'action recommandé</div>
              <p style={{ fontSize: 12, color: 'var(--brand-800)', margin: '4px 0 0', lineHeight: 1.55 }}>
                Pour atteindre le <strong>top 100 national d'ici 2027</strong>, l'IA recommande : (1) +30min math/sem, (2) tutorat pairs P2/P3, (3) club sport mensuel obligatoire.
              </p>
              <Button size="sm" style={{ marginTop: 10 }} icon="arrowRight">Lancer le plan IA</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ═══ 5 · WALLET ÉCOLE MOBILE MONEY ══════════════════════════
const WalletPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="Wallet école · Mobile Money & banques"
      sub="MTN · Moov · Celtiis · Ecobank · BoA · rapprochement temps réel · KYC validé Flutterwave"
      breadcrumb={['Finance', 'Wallet & banques']}>
      <Badge variant="success" icon="check">KYC validé · BCEAO</Badge>
      <Button variant="secondary" icon="download">Relevé multibanque</Button>
      <Button icon="plus">Décaissement</Button>
    </PageTitle>

    {/* Wallet hero card */}
    <Card style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E40AF 100%)', color: '#fff', border: 0, marginBottom: 14, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 24, position: 'relative' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(59,130,246,0.15)' }}/>
        <div style={{ position: 'absolute', bottom: -60, right: 80, width: 140, height: 140, borderRadius: '50%', background: 'rgba(99,102,241,0.15)' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.7 }}>Solde global consolidé</div>
            <div className="display tabular" style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', marginTop: 8 }}>57,4 <span style={{ fontSize: 22, opacity: 0.7 }}>M FCFA</span></div>
            <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Disponible</div>
                <div className="tabular" style={{ fontSize: 18, fontWeight: 700, color: '#34D399' }}>54,2 M</div>
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Bloqué · paie</div>
                <div className="tabular" style={{ fontSize: 18, fontWeight: 700, color: '#FBBF24' }}>3,2 M</div>
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Entrants 24h</div>
                <div className="tabular" style={{ fontSize: 18, fontWeight: 700, color: '#60A5FA' }}>+8,4 M</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)' }} icon="sms">Envoyer SMS recouv.</Button>
            <Button size="sm" style={{ background: '#fff', color: 'var(--brand-800)' }} icon="money">Décaisser</Button>
          </div>
        </div>

        {/* Source breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.15)', position: 'relative' }}>
          {[
            { n: 'Ecobank', acc: 'CPT 0341', bal: '48,2 M', icon: '🏦', c: '#60A5FA' },
            { n: 'MTN MoMo', acc: '+229 21 30 12 12', bal: '4,2 M', icon: '📱', c: '#FBBF24' },
            { n: 'Moov Money', acc: '+229 95 80 12 12', bal: '1,8 M', icon: '📲', c: '#60A5FA' },
            { n: 'Celtiis Cash', acc: '+229 51 00 12 12', bal: '0,4 M', icon: '💳', c: '#34D399' },
            { n: 'Caisse', acc: 'Espèces siège', bal: '2,8 M', icon: '💰', c: '#A78BFA' },
          ].map(s => (
            <div key={s.n}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{s.n}</div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>{s.acc}</div>
              <div className="tabular display" style={{ fontSize: 18, fontWeight: 700, color: s.c, marginTop: 4 }}>{s.bal}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>

    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
      <VABox title="Transactions en direct · auto-rapprochement"
        sub="Webhooks MTN/Moov · réconcilié avec inscriptions · zéro saisie manuelle"
        right={<Badge variant="success" size="sm" dot>Live · 14 min</Badge>}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {[
              { t: '14:32', src: 'MTN', mom: '+229 97 11 22 33', name: 'Famille Hounsou', ref: 'TRX-MTN-882104', amt: '+125 000', match: '✓ Aïcha · trim. 2', c: 'success' },
              { t: '14:28', src: 'MoMo', mom: '+229 95 80 14 41', name: 'Famille Dossou', ref: 'TRX-MOV-441998', amt: '+95 000', match: '✓ Mathieu · trim. 2', c: 'success' },
              { t: '14:22', src: 'Ecobank', mom: 'Virement', name: 'État · subv. MEMP', ref: 'VIR-ECO-12041', amt: '+4 800 000', match: '✓ Subvention 2025-T2', c: 'success' },
              { t: '14:14', src: 'Celtiis', mom: '+229 51 88 91 02', name: 'Inconnu', ref: 'TRX-CEL-009', amt: '+50 000', match: '⚠ À rapprocher manuellement', c: 'warning' },
              { t: '13:58', src: 'MTN', mom: 'Décaissement', name: 'Librairie SOFIB', ref: 'DEC-MTN-7720', amt: '−142 500', match: '✓ Achat fournitures · CHR-201', c: 'info' },
              { t: '13:42', src: 'MoMo', mom: '+229 97 44 31 02', name: 'Famille Akin', ref: 'TRX-MOV-441812', amt: '+62 500', match: '✓ Pierre · trim. 2 · acompte 50%', c: 'success' },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
                <td style={{ padding: '12px 14px', width: 56 }}>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.t}</div>
                  <Badge variant={r.src === 'MTN' ? 'warning' : r.src === 'MoMo' ? 'info' : r.src === 'Ecobank' ? 'brand' : r.src === 'Celtiis' ? 'success' : 'neutral'} size="sm">{r.src}</Badge>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.mom} · {r.ref}</div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 11, color: `var(--${r.c}-700)` }}>{r.match}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                  <span className="display tabular" style={{ fontSize: 15, fontWeight: 800, color: r.amt.startsWith('+') ? 'var(--success-700)' : 'var(--danger-700)' }}>{r.amt}</span>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>FCFA</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </VABox>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Décaissements programmés · 48h</SubLabel>
          <div style={{ marginTop: 10 }}>
            {[
              { l: 'Paie enseignants · juin', v: '22,4 M', d: 'Auto · 25 mai · 06:00', c: 'brand' },
              { l: 'CNSS · cotisations mai', v: '3,8 M', d: 'Auto · 30 mai · 09:00', c: 'warning' },
              { l: 'Loyer extension nord', v: '850 k', d: 'Manuel · 28 mai', c: 'info' },
              { l: 'Fournisseur cantine ATAB', v: '1,2 M', d: 'En attente validation', c: 'danger' },
            ].map((d, i) => (
              <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{d.l}</span>
                  <span className="tabular display" style={{ fontSize: 14, fontWeight: 700, color: `var(--${d.c}-700)` }}>{d.v}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{d.d}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SubLabel>Frais Mobile Money économisés · 12 mois</SubLabel>
          <div className="display tabular" style={{ fontSize: 36, fontWeight: 800, color: 'var(--success-700)', marginTop: 6 }}>−2,4 <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>M FCFA</span></div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
            Tarif négocié EduPilot avec MTN : <strong>0,8%</strong> au lieu de 1,5% standard. Économies redirigées vers le fonds bourses.
          </p>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ═══ 6 · CAGNOTTE / POT COMMUN CLASSE ═══════════════════════
const CagnottePage = () => (
  <DashShell role="PARENT" user="Patrick Hounsou" nav={[
    { icon: 'home', label: 'Accueil' },
    { icon: 'users', label: 'Mes enfants' },
    { icon: 'money', label: 'Paiements' },
    { icon: 'sparkle', label: 'Cagnottes', count: 2, active: true },
    { icon: 'sms', label: 'Messagerie' },
  ]}>
    <PageTitle title="Cagnottes & pots communs"
      sub="Sorties scolaires · fournitures partagées · cadeaux profs · 100% transparent">
      <Badge variant="success" icon="check">2 cagnottes en cours</Badge>
      <Button icon="plus">Créer une cagnotte</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {[
        {
          title: 'Sortie pédagogique Ouidah · Route des Esclaves',
          sub: 'Aïcha · 3ᵉ A · vendredi 14 juin', target: 350000, raised: 246000, n: 22, total: 28,
          contrib: 12500, paid: true, days: 18, host: 'Mme Bossou · prof histoire',
          c: 'brand',
        },
        {
          title: 'Pot commun cadeau · Mme Akin · départ retraite',
          sub: 'Toute la promotion CM2 · 12 juillet', target: 80000, raised: 71500, n: 38, total: 42,
          contrib: 2000, paid: true, days: 32, host: 'Bureau des parents CM2',
          c: 'warning',
        },
      ].map((c, i) => (
        <Card key={i} padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <Badge variant={c.c} size="sm">J−{c.days}</Badge>
            <h3 className="display" style={{ fontSize: 17, fontWeight: 700, margin: '8px 0 4px', lineHeight: 1.3 }}>{c.title}</h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>{c.sub} · organisé par {c.host}</p>
          </div>

          <div style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="display tabular" style={{ fontSize: 26, fontWeight: 800, color: `var(--${c.c}-700)` }}>{(c.raised / 1000).toLocaleString('fr-FR').replace(',', ' ')}<span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}> k</span></span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>sur {(c.target / 1000).toLocaleString('fr-FR').replace(',', ' ')}k FCFA</span>
            </div>
            <div style={{ height: 10, background: 'var(--neutral-100)', borderRadius: 5, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${(c.raised / c.target) * 100}%`, background: `var(--${c.c}-600)`, borderRadius: 5 }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span><strong style={{ color: `var(--${c.c}-700)`, fontSize: 13 }}>{c.n}</strong>/{c.total} familles ont participé</span>
              <span><strong>{Math.round((c.raised / c.target) * 100)}%</strong> atteint</span>
            </div>

            {/* Avatars participants */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, marginBottom: 14 }}>
              {['AH', 'MS', 'FA', 'MB', 'PA', 'KD'].map((n, j) => (
                <div key={j} style={{
                  width: 28, height: 28, borderRadius: '50%', background: `var(--${c.c}-600)`,
                  border: '2px solid var(--surface-card)', color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'grid', placeItems: 'center', marginLeft: j ? -8 : 0,
                }}>{n}</div>
              ))}
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-sunken)', border: '2px solid var(--surface-card)', color: 'var(--text-secondary)', fontSize: 9, fontWeight: 700, display: 'grid', placeItems: 'center', marginLeft: -8 }}>+{c.n - 6}</div>
            </div>

            <div style={{ padding: 12, borderRadius: 10, background: c.paid ? 'var(--success-50)' : 'var(--brand-50)', border: `1px solid var(--${c.paid ? 'success' : 'brand'}-200)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: `var(--${c.paid ? 'success' : 'brand'}-700)`, fontWeight: 700 }}>Votre participation</div>
                  <div className="display tabular" style={{ fontSize: 18, fontWeight: 700, color: `var(--${c.paid ? 'success' : 'brand'}-900)`, marginTop: 2 }}>{c.contrib.toLocaleString('fr-FR').replace(',', ' ')} FCFA</div>
                </div>
                {c.paid
                  ? <Badge variant="success" icon="check">Payé · {c.c === 'brand' ? '08 mai' : '12 mai'}</Badge>
                  : <Button size="sm" icon="money">Payer</Button>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <Button variant="ghost" size="sm" full icon="sms">Messagerie groupe</Button>
              <Button variant="ghost" size="sm" full iconRight="arrowRight">Détails</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>

    <Card padding={18} style={{ marginTop: 14, background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--brand-600)', display: 'grid', placeItems: 'center' }}>
          <Icon name="sparkle" size={24} color="#fff"/>
        </div>
        <div>
          <h3 className="display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-900)', margin: 0 }}>100% transparent · 100% reversé</h3>
          <p style={{ fontSize: 12, color: 'var(--brand-800)', margin: '4px 0 0', lineHeight: 1.55 }}>
            Chaque centime payé apparaît dans le journal public de la cagnotte. EduPilot ne prélève rien sur les cagnottes. À la clôture, le solde est viré au compte de l'école avec reçu détaillé.
          </p>
        </div>
        <Button variant="secondary" size="sm" iconRight="arrowRight">Comment ça marche</Button>
      </div>
    </Card>
  </DashShell>
);

Object.assign(window, {
  WellbeingPage, VoiceNotifsPage, AccountingPage, BenchmarkPage, WalletPage, CagnottePage,
});
