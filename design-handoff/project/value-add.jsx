// EduPilot — Valeur ajoutée :
// 1. Config académique (trim/sem)  2. WhatsApp Business  3. PWA offline
// 4. QR badge  5. Concours nationaux  6. Bourses  7. Clubs
// 8. RH enseignants  9. Alumni

// ─── 1 · CONFIG ANNÉE ACADÉMIQUE ───────────────────────────
const AcademicConfig = () => {
  const [system, setSystem] = React.useState('trimestre');
  return (
    <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
      <PageTitle title="Année académique · 2025-2026"
        sub="Définissez votre découpage, les vacances, les dates clés. Tout l'app s'adapte automatiquement."
        breadcrumb={['Paramètres', 'Établissement', 'Année académique']}>
        <Button variant="secondary" icon="download">Calendrier MEMP</Button>
        <Button icon="check">Valider la configuration</Button>
      </PageTitle>

      {/* System toggle */}
      <Card padding={24} style={{ marginBottom: 14 }}>
        <h3 className="display" style={{ fontSize: 18, margin: '0 0 6px' }}>Système de découpage</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px' }}>Bulletins, moyennes, conseils de classe et finances s'adapteront à ce choix.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { k: 'trimestre', t: '3 trimestres', sub: 'Système standard MEMP — par défaut', detail: 'T1 (oct-déc) · T2 (jan-mars) · T3 (avr-juil) · 3 bulletins par an', icon: 'cards' },
            { k: 'semestre', t: '2 semestres', sub: 'Système universitaire / lycées techniques', detail: 'S1 (sep-jan) · S2 (fév-juin) · 2 bulletins + contrôle continu', icon: 'book' },
          ].map(opt => {
            const active = system === opt.k;
            return (
              <button key={opt.k} onClick={() => setSystem(opt.k)} style={{
                padding: 20, borderRadius: 14, textAlign: 'left',
                border: active ? '2px solid var(--brand-600)' : '1px solid var(--border-default)',
                background: active ? 'var(--brand-50)' : 'var(--surface-card)',
                cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
              }}>
                {active && <Badge variant="brand" size="sm" icon="check" style={{ position: 'absolute', top: 14, right: 14 }}>Choisi</Badge>}
                <div style={{ width: 44, height: 44, borderRadius: 12, background: active ? 'var(--brand-600)' : 'var(--surface-sunken)', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                  <Icon name={opt.icon} size={20} color={active ? '#fff' : 'var(--brand-700)'}/>
                </div>
                <div className="display" style={{ fontSize: 20, fontWeight: 700, color: active ? 'var(--brand-900)' : 'var(--text-primary)' }}>{opt.t}</div>
                <div style={{ fontSize: 12, color: active ? 'var(--brand-800)' : 'var(--text-tertiary)', marginTop: 4 }}>{opt.sub}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.55 }}>{opt.detail}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        {/* Periods config */}
        <Card padding={0}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>{system === 'trimestre' ? '3 trimestres' : '2 semestres'} · dates</h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Modifiez si nécessaire · pré-rempli depuis calendrier MEMP</p>
          </div>
          {(system === 'trimestre' ? [
            { p: 'Trimestre 1', start: '02 sept. 2025', end: '20 déc. 2025', conseil: '15-19 déc.', bulletin: '22 déc.', c: 'brand' },
            { p: 'Trimestre 2', start: '06 jan. 2026', end: '03 avr. 2026', conseil: '30 mars-3 avr.', bulletin: '08 avr.', c: 'info' },
            { p: 'Trimestre 3', start: '21 avr. 2026', end: '17 juil. 2026', conseil: '13-17 juil.', bulletin: '20 juil.', c: 'success' },
          ] : [
            { p: 'Semestre 1', start: '02 sept. 2025', end: '30 jan. 2026', conseil: '26-30 jan.', bulletin: '02 fév.', c: 'brand' },
            { p: 'Semestre 2', start: '02 fév. 2026', end: '17 juil. 2026', conseil: '13-17 juil.', bulletin: '20 juil.', c: 'success' },
          ]).map((p, i) => (
            <div key={i} style={{ padding: '16px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 6, height: 36, borderRadius: 3, background: `var(--${p.c}-600)` }}/>
                <div className="display" style={{ fontSize: 16, fontWeight: 700, color: `var(--${p.c}-900)` }}>{p.p}</div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {Math.round((new Date(2026, 5, 1) - new Date(2025, 8, 1)) / (1000*60*60*24*7) / (system === 'trimestre' ? 3 : 2))} semaines de cours</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginLeft: 18 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Début</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{p.start}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fin</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{p.end}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conseil de classe</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{p.conseil}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bulletin remis</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, color: 'var(--success-700)' }}>{p.bulletin}</div>
                </div>
              </div>
            </div>
          ))}
        </Card>

        {/* Vacations */}
        <Card padding={0}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Vacances & jours fériés</h3>
            <Button variant="ghost" size="sm" icon="plus"/>
          </div>
          {[
            { l: 'Toussaint', d: '27 oct → 03 nov', t: 'Vacances', c: 'info' },
            { l: 'Fête nationale', d: '01 août', t: 'Férié', c: 'warning' },
            { l: 'Noël', d: '22 déc → 05 jan', t: 'Vacances', c: 'info' },
            { l: 'Carnaval / Pâques', d: '06 → 20 avr', t: 'Vacances', c: 'info' },
            { l: 'Fête du travail', d: '01 mai', t: 'Férié', c: 'warning' },
            { l: 'Ascension', d: '14 mai', t: 'Férié', c: 'warning' },
            { l: 'Tabaski (Aïd-el-Kébir)', d: '06 juin · variable', t: 'Férié', c: 'warning' },
            { l: 'Grandes vacances', d: '20 juil → 02 sept', t: 'Vacances', c: 'success' },
          ].map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: `var(--${v.c}-500)` }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{v.l}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{v.d}</div>
              </div>
              <Badge variant={v.t === 'Férié' ? 'warning' : 'info'} size="sm">{v.t}</Badge>
            </div>
          ))}
        </Card>
      </div>

      <Card padding={18} style={{ marginTop: 14, background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Icon name="sparkle" size={18} color="var(--brand-700)" style={{ marginTop: 2, flexShrink: 0 }}/>
          <div style={{ fontSize: 13, color: 'var(--brand-900)', lineHeight: 1.6 }}>
            <strong>Impact du changement :</strong> en passant de trimestre à semestre (ou inverse),
            EduPilot recalcule automatiquement les moyennes, regénère le calendrier conseils, met à jour
            les échéances de paiement et notifie les enseignants. Aucune donnée perdue · backup créé.
          </div>
        </div>
      </Card>
    </DashShell>
  );
};

// ─── 2 · WHATSAPP BUSINESS ──────────────────────────────────
const WhatsAppPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="WhatsApp Business · canal #1 au Bénin"
      sub="Activé · numéro vérifié +229 21 30 12 12 · 1 842 parents abonnés"
      breadcrumb={['Communication', 'Canaux', 'WhatsApp Business']}>
      <Badge variant="success" icon="check">Vérifié META</Badge>
      <Button variant="secondary" icon="settings">Paramètres</Button>
      <Button icon="sparkle">Diffuser un message</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Parents abonnés" value="1 842" trend={12} icon="users" variant="success"/>
      <MetricCard label="Taux de lecture" value="98" unit="%" trend={4} icon="check" variant="success"/>
      <MetricCard label="Messages / sem." value="3 240" trend={18} icon="sms" variant="brand"/>
      <MetricCard label="Coût / msg" value="12" unit="FCFA" trend={-30} icon="money" variant="info"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Modèles WhatsApp validés META · 12 actifs</h3>
        </div>
        {[
          { t: 'Rappel paiement scolarité', sub: 'Auto · 7j avant échéance · 96% lecture', count: 287, c: 'warning' },
          { t: 'Notification absence enfant', sub: 'Auto · le jour même · 98% lecture', count: 142, c: 'danger' },
          { t: 'Confirmation paiement reçu', sub: 'Auto · instantané', count: 184, c: 'success' },
          { t: 'Bulletin trimestriel disponible', sub: 'Auto · fin de trimestre', count: 1248, c: 'brand' },
          { t: 'Invitation conseil parents-prof', sub: 'Manuel · ciblé par classe', count: 28, c: 'info' },
        ].map((t, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px auto', gap: 14, padding: '14px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0, alignItems: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `var(--${t.c}-50)`, display: 'grid', placeItems: 'center' }}>
              <Icon name="sms" size={16} color={`var(--${t.c}-700)`}/>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t.t}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.sub}</div>
            </div>
            <span className="tabular" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{t.count} env.</span>
            <Button variant="ghost" size="sm">Éditer</Button>
          </div>
        ))}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Faux phone preview */}
        <Card padding={0} style={{ background: '#075E54', color: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name="CBE School" size="sm"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Cours Bénin Excellence ✓</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>en ligne · compte vérifié</div>
            </div>
          </div>
          <div style={{ background: '#E5DDD5', padding: 14, minHeight: 240, color: '#111' }}>
            <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: '#fff', padding: '8px 12px', borderRadius: 12, borderTopLeftRadius: 2, fontSize: 12, lineHeight: 1.55, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 11, color: 'var(--brand-700)', fontWeight: 700, marginBottom: 4 }}>📚 Cours Bénin Excellence</div>
              Bonjour Patrick, le paiement de scolarité d'<strong>Aïcha</strong> (3ᵉ A) arrive à échéance le <strong>11 mai</strong>.
              <br/><br/>Montant : <strong>125 000 FCFA</strong>
              <br/>Mode : MTN · Moov · carte
              <br/><br/>👉 Payez en 30 sec :<br/><span style={{ color: '#007AFF' }}>edupilot.bj/p/A0142</span>
              <div style={{ fontSize: 10, color: '#888', textAlign: 'right', marginTop: 6 }}>14:32 ✓✓</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <div style={{ maxWidth: '70%', background: '#DCF8C6', padding: '8px 12px', borderRadius: 12, borderTopRightRadius: 2, fontSize: 12, lineHeight: 1.55, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                Payé ! Merci 🙏
                <div style={{ fontSize: 10, color: '#888', textAlign: 'right', marginTop: 4 }}>14:34 ✓✓</div>
              </div>
            </div>
            <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: '#fff', padding: '8px 12px', borderRadius: 12, borderTopLeftRadius: 2, fontSize: 12, lineHeight: 1.55, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--brand-700)', fontWeight: 700, marginBottom: 4 }}>📚 Cours Bénin Excellence</div>
              ✅ Paiement reçu — reçu Flutterwave #FLW-882104. Merci !
              <div style={{ fontSize: 10, color: '#888', textAlign: 'right', marginTop: 4 }}>14:34 ✓✓</div>
            </div>
          </div>
        </Card>
        <Card>
          <SubLabel>Comparaison canaux · semaine</SubLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {[
              { l: 'WhatsApp', v: '98%', sub: '1 842 abonnés · 12 FCFA/msg', c: 'success' },
              { l: 'SMS', v: '94%', sub: '1 840 numéros · 25 FCFA/msg', c: 'brand' },
              { l: 'Email', v: '32%', sub: '1 240 emails · gratuit', c: 'info' },
              { l: 'App push', v: '88%', sub: '982 installations · gratuit', c: 'success' },
            ].map(c => (
              <div key={c.l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 60, fontSize: 12, fontWeight: 700 }}>{c.l}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 6, background: 'var(--neutral-200)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: c.v, background: `var(--${c.c}-600)` }}/>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.sub}</div>
                </div>
                <span className="tabular" style={{ fontSize: 13, fontWeight: 700, color: `var(--${c.c}-700)`, width: 40, textAlign: 'right' }}>{c.v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 3 · MODE HORS-LIGNE / PWA ─────────────────────────────
const OfflinePage = () => (
  <DashShell role="ENSEIGNANT" user="Paul Adjavon" nav={[
    { icon: 'home', label: 'Mes classes' },
    { icon: 'pencil', label: 'Saisie notes', count: 3, active: true },
    { icon: 'check', label: 'Appel' },
    { icon: 'calendar', label: 'EDT' },
    { icon: 'bell', label: 'Notifications' },
  ]}>
    {/* Offline banner */}
    <div style={{
      padding: '10px 20px', background: 'var(--warning-50)',
      border: '1px solid var(--warning-200)', borderRadius: 'var(--radius-md)',
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
    }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--warning-600)', display: 'grid', placeItems: 'center' }}>
        <Icon name="warning" size={14} color="#fff"/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning-900)' }}>Mode hors-ligne actif · réseau perdu il y a 12 min</div>
        <div style={{ fontSize: 11, color: 'var(--warning-800)' }}>Tes saisies sont enregistrées localement. Synchronisation automatique au retour.</div>
      </div>
      <Badge variant="warning" icon="clock">4 changements en attente</Badge>
      <Button variant="ghost" size="sm" icon="check">Forcer sync</Button>
    </div>

    <PageTitle title="Saisie de notes · 3ᵉ A" sub="DST Mathématiques · 24/26 saisies · ✓ enregistré en local"/>

    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Notes saisies aujourd'hui</span>
          <Badge variant="warning" size="sm" icon="clock">Sync en attente</Badge>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {[
              { n: 'Aïcha Hounsou', g: '16,5', t: 'sync-pending' },
              { n: 'Mathieu Sossou', g: '13,0', t: 'sync-pending' },
              { n: 'Fatou Adjavon', g: '14,75', t: 'sync-pending' },
              { n: 'Marie Bossou', g: '17,5', t: 'sync-pending' },
              { n: 'Pierre Akin', g: '12,0', t: 'editing' },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
                <td style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={r.n} size="xs"/><span style={{ fontWeight: 500 }}>{r.n}</span>
                </td>
                <td style={{ padding: '12px 18px' }} className="tabular">
                  <span style={{ fontSize: 14, fontWeight: 700, color: r.t === 'editing' ? 'var(--brand-700)' : 'var(--text-primary)' }}>{r.g}</span>
                </td>
                <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                  {r.t === 'sync-pending' && <Badge variant="warning" size="sm"><Icon name="clock" size={10}/>{' '}Local</Badge>}
                  {r.t === 'editing' && <Badge variant="brand" size="sm" dot>En édition</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>État de la synchronisation</SubLabel>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Dernière sync</span><span className="mono" style={{ fontWeight: 600 }}>10:32 (il y a 12 min)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Données disponibles offline</span><span style={{ color: 'var(--success-700)', fontWeight: 700 }}>2 480 élèves</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Changements en attente</span><span style={{ color: 'var(--warning-700)', fontWeight: 700 }}>4 notes</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Espace utilisé</span><span className="mono" style={{ fontWeight: 600 }}>42 MB / 500 MB</span>
            </div>
          </div>
          <div style={{ height: 6, background: 'var(--neutral-200)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '8.4%', background: 'var(--brand-600)' }}/>
          </div>
        </Card>

        <Card style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Icon name="sparkle" size={18} color="var(--brand-700)" style={{ marginTop: 2 }}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-900)' }}>PWA installable</div>
              <p style={{ fontSize: 12, color: 'var(--brand-800)', margin: '4px 0 0', lineHeight: 1.55 }}>
                Installe EduPilot comme une vraie app : icône bureau, lancement instantané, fonctionne sans wifi. Pas besoin de Play Store.
              </p>
              <Button size="sm" style={{ marginTop: 10 }} icon="download">Installer EduPilot</Button>
            </div>
          </div>
        </Card>

        <Card>
          <SubLabel>Fonctionnalités offline-first</SubLabel>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['Saisie notes', true], ['Faire l\'appel', true], ['Consultation dossier élève', true],
              ['Cahier de liaison · lecture', true], ['Cahier de liaison · écriture', true],
              ['Paiement Mobile Money', false], ['SMS sortants', false],
            ].map(([f, ok]) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name={ok ? 'check' : 'x'} size={12} color={ok ? 'var(--success-600)' : 'var(--text-tertiary)'}/>
                <span style={{ color: ok ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{f}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 4 · QR BADGE & CONTRÔLE D'ACCÈS ───────────────────────
const QRBadgePage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="QR Badge & contrôle d'accès"
      sub="1 248 badges actifs · 6 points de scan · 3 142 passages aujourd'hui"
      breadcrumb={['Vie scolaire', 'Contrôle accès']}>
      <Button variant="secondary" icon="download">Régénérer badges classe</Button>
      <Button icon="plus">Nouveau point de scan</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Passages · matin" value="1 198" trend={2} icon="users" variant="brand"/>
      <MetricCard label="Retards entrée" value="42" trend={-15} icon="warning" variant="warning"/>
      <MetricCard label="Repas cantine" value="847" icon="cards" variant="info"/>
      <MetricCard label="Sorties non autorisées" value="0" icon="check" variant="success"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
      {/* Badge preview */}
      <Card padding={20}>
        <SubLabel>Aperçu badge · Aïcha Hounsou</SubLabel>
        <div style={{
          marginTop: 14, padding: 18,
          background: 'linear-gradient(160deg, var(--brand-800), var(--accent-600))',
          borderRadius: 20, color: '#fff', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>
            <Logo size={18}/> Cours Bénin Excellence
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
            <Avatar name="Aïcha Hounsou" size="lg" style={{ width: 64, height: 64, boxShadow: '0 0 0 3px rgba(255,255,255,0.3)' }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Élève · 3ᵉ A</div>
              <div className="display" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1, marginTop: 4 }}>Aïcha<br/>HOUNSOU</div>
              <div className="mono" style={{ fontSize: 11, opacity: 0.85, marginTop: 6 }}>BJ-2026-A0142</div>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: 10, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Faux QR */}
            <div style={{ width: 64, height: 64, background: 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50%/8px 8px, repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50%/4px 4px', borderRadius: 6, boxShadow: 'inset 0 0 0 3px #fff', flexShrink: 0 }}/>
            <div style={{ fontSize: 10, color: '#0F172A', lineHeight: 1.4 }}>
              <strong>Scan pour identification</strong><br/>
              Cantine · transport · accès école<br/>
              <span className="mono" style={{ opacity: 0.6 }}>Valide jusqu'au 30 juin 2026</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
          <Button variant="secondary" size="sm" full icon="download">Imprimer</Button>
          <Button variant="secondary" size="sm" full icon="cards">Format mobile</Button>
        </div>
      </Card>

      {/* Live scans */}
      <Card padding={0}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Passages en direct</h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>6 points de scan · mise à jour toutes les 3 sec</p>
          </div>
          <Badge variant="success" size="sm" dot>Live</Badge>
        </div>
        <div>
          {[
            { time: '14:32', n: 'Aïcha Hounsou', class: '3ᵉ A', point: 'Cantine', action: 'Repas servi', v: 'success' },
            { time: '14:31', n: 'Mathieu Sossou', class: 'CM1', point: 'Cantine', action: 'Repas servi', v: 'success' },
            { time: '14:28', n: 'Pierre Akin', class: '4ᵉ B', point: 'Portail principal', action: 'Sortie · autorisée', v: 'info' },
            { time: '14:25', n: 'Koffi Dossou', class: '4ᵉ B', point: 'Portail principal', action: 'Tentative sortie · refusée', v: 'danger' },
            { time: '14:22', n: 'Bus #3', class: '14 élèves', point: 'Arrêt Fidjrossè', action: 'Embarquement OK', v: 'brand' },
            { time: '14:15', n: 'Marie Bossou', class: 'CE2-A', point: 'Infirmerie', action: 'Visite enregistrée', v: 'warning' },
            { time: '13:58', n: 'Lucie Houngbedji', class: '3ᵉ A', point: 'Bibliothèque', action: 'Emprunt enregistré', v: 'info' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr auto', gap: 12, padding: '12px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0, alignItems: 'center', background: s.v === 'danger' ? 'var(--danger-50)' : 'transparent' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.time}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.n} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· {s.class}</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.point} · {s.action}</div>
              </div>
              <Badge variant={s.v} size="sm" dot={s.v === 'danger'}>{s.v === 'danger' ? 'Refusé' : 'OK'}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </DashShell>
);

// ─── 5 · CONCOURS NATIONAUX (CEP / BEPC / BAC) ──────────────
const ExamsPrepPage = () => (
  <DashShell role="ÉLÈVE" user="Aïcha Hounsou" nav={directorNav.slice(0, 8).map((n, i) => ({ ...n, active: i === 4 }))}>
    <PageTitle title="Préparation Brevet (BEPC) · 2026"
      sub="Plus que 42 jours · annales corrigées · IA tutrice · planning de révisions"
      breadcrumb={['Examens', 'BEPC 2026']}>
      <Badge variant="warning" icon="flame">Compte à rebours · J-42</Badge>
    </PageTitle>

    {/* Hero countdown */}
    <Card style={{ background: 'linear-gradient(135deg, var(--brand-800), var(--danger-700))', color: '#fff', border: 0, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>Examen blanc · BEPC</div>
          <div className="display tabular" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', marginTop: 4 }}>27 juin</div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>Centre · Collège Notre-Dame de Cotonou</div>
        </div>
        <div style={{ height: 80, width: 1, background: 'rgba(255,255,255,0.25)' }}/>
        <div style={{ display: 'flex', gap: 18 }}>
          {[{ v: '42', l: 'jours' }, { v: '6', l: 'épreuves' }, { v: '92%', l: 'pronostic IA' }, { v: 'Bien', l: 'mention visée' }].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div className="display tabular" style={{ fontSize: 32, fontWeight: 700 }}>{s.v}</div>
              <div style={{ fontSize: 10, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Button size="lg" style={{ background: '#fff', color: 'var(--brand-800)' }} iconRight="arrowRight">Plan de révision IA</Button>
        </div>
      </div>
    </Card>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card padding={0}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Annales · corrigées par l'IA</h3>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>BEPC 2020 → 2024 · disponibles offline · QR scan pour version papier</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {[
                { y: 2024, s: 'Mathématiques', m: 'Faite', score: '15/20', c: 'success' },
                { y: 2024, s: 'Français', m: 'Faite', score: '13/20', c: 'warning' },
                { y: 2024, s: 'SVT', m: 'Faite', score: '17/20', c: 'success' },
                { y: 2023, s: 'Mathématiques', m: 'En cours · 60%', score: '—', c: 'info' },
                { y: 2023, s: 'Histoire-Géo', m: 'Pas commencée', score: '—', c: 'neutral' },
                { y: 2022, s: 'Toutes matières', m: 'Pas commencée', score: '—', c: 'neutral' },
              ].map((a, i) => (
                <tr key={i} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
                  <td style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `var(--${a.c}-50)`, display: 'grid', placeItems: 'center' }}>
                      <span className="display tabular" style={{ fontSize: 12, fontWeight: 700, color: `var(--${a.c}-700)` }}>{a.y}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>BEPC {a.y} · {a.s}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{a.m}</div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    {a.score !== '—' && <span className="display tabular" style={{ fontSize: 14, fontWeight: 700, color: `var(--${a.c}-700)`, marginRight: 12 }}>{a.score}</span>}
                    <Button variant="ghost" size="sm" iconRight="arrowRight">{a.m === 'Faite' ? 'Revoir' : a.m.includes('cours') ? 'Continuer' : 'Démarrer'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={20} color="var(--brand-700)" style={{ marginTop: 2 }}/>
            <div>
              <div className="display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-900)' }}>Ton plan de révision IA · cette semaine</div>
              <div style={{ fontSize: 12, color: 'var(--brand-800)', marginTop: 8, lineHeight: 1.7 }}>
                <strong>Lundi</strong> · Math : équations 2ⁿᵈ degré (45 min)<br/>
                <strong>Mardi</strong> · Français : dissertation (1h)<br/>
                <strong>Mercredi</strong> · Repos cerveau · sport ⚡<br/>
                <strong>Jeudi</strong> · SVT : génétique (30 min)<br/>
                <strong>Vendredi</strong> · Annale BEPC 2023 Math chronométrée (3h)
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <SubLabel>Pronostic mention · BEPC</SubLabel>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span className="display tabular" style={{ fontSize: 38, fontWeight: 800, color: 'var(--success-700)' }}>14,6</span>
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>/ 20</span>
          </div>
          <Badge variant="success" icon="trophy">Mention Bien probable</Badge>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.55 }}>
            Basé sur tes 18 annales · ta progression actuelle · les écarts entre simulation et BEPC réel (typiquement −0,8 pts).
          </p>
        </Card>

        <Card>
          <SubLabel>Points faibles · à travailler</SubLabel>
          <div style={{ marginTop: 8 }}>
            {[
              { s: 'Dissertation française', sub: 'plan, argumentation', v: 11, c: 'warning' },
              { s: 'Géométrie · démonstration', sub: 'chaînage des étapes', v: 12, c: 'warning' },
              { s: 'Anglais · expression écrite', sub: 'vocabulaire B1', v: 13, c: 'info' },
            ].map((p, i) => (
              <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.s}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.sub}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 6 · BOURSES & AIDES ───────────────────────────────────
const ScholarshipsPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="Bourses & aides scolaires" sub="42 boursiers actifs · 8,4M FCFA distribués · 6 demandes en attente"
      breadcrumb={['Administration', 'Bourses']}>
      <Button variant="secondary" icon="download">Rapport MEMP</Button>
      <Button icon="plus">Nouvelle bourse</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Boursiers actifs" value="42" trend={8} icon="trophy" variant="success"/>
      <MetricCard label="Budget alloué" value="8,4" unit="M FCFA" trend={12} icon="money" variant="brand"/>
      <MetricCard label="Dossiers en attente" value="6" icon="clock" variant="warning"/>
      <MetricCard label="Taux de réussite boursiers" value="14,2" unit="/20" trend={2.4} icon="check" variant="success"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)' }}>
          <Chip active>Toutes</Chip>
          <Chip count={18}>État · MEMP</Chip>
          <Chip count={14}>Établissement</Chip>
          <Chip count={6}>Fondation Excellence</Chip>
          <Chip count={4}>Mérite</Chip>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--surface-sunken)' }}>
            {['Élève', 'Type', 'Montant', 'Période', 'Critères', 'État'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              { n: 'Aïcha Hounsou', t: 'État · MEMP', m: '125 000', p: 'Annuelle', c: 'Mérite + revenu', v: 'success', vL: 'Versée' },
              { n: 'Mathieu Sossou', t: 'Établissement', m: '60 000', p: 'Trimestre', c: 'Fratrie 3+', v: 'success', vL: 'Active' },
              { n: 'Pierre Akin', t: 'État · MEMP', m: '125 000', p: 'Annuelle', c: 'Revenu < 40k', v: 'success', vL: 'Versée' },
              { n: 'Serge Padonou', t: 'Fondation', m: '80 000', p: 'Trimestre', c: 'Sciences · top 5', v: 'warning', vL: 'À valider' },
              { n: 'Aminatou Coffi', t: 'Mérite', m: '40 000', p: 'Mensuelle', c: 'Moy. > 16', v: 'success', vL: 'Active' },
              { n: 'Hervé Bio', t: 'État · MEMP', m: '125 000', p: 'Annuelle', c: 'Orphelin', v: 'warning', vL: 'À valider' },
              { n: 'Lucie Houngbedji', t: 'Établissement', m: '50 000', p: 'Annuelle', c: 'Boursière interne', v: 'success', vL: 'Active' },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={r.n} size="sm"/>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.n}</span>
                </td>
                <td style={{ padding: '12px 14px' }}><Badge variant="brand" size="sm">{r.t}</Badge></td>
                <td style={{ padding: '12px 14px' }}><span className="display tabular" style={{ fontSize: 14, fontWeight: 700 }}>{r.m}</span> <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>FCFA</span></td>
                <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{r.p}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 11 }}>{r.c}</td>
                <td style={{ padding: '12px 14px' }}><Badge variant={r.v} size="sm" dot={r.v === 'warning'}>{r.vL}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Répartition par source · 8,4M FCFA</SubLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {[
              { l: 'État (MEMP)', v: 2250, pct: 54, c: 'brand' },
              { l: 'Établissement', v: 840, pct: 20, c: 'success' },
              { l: 'Fondation Excellence', v: 480, pct: 12, c: 'warning' },
              { l: 'Diaspora / Alumni', v: 360, pct: 8, c: 'info' },
              { l: 'Entreprise partenaire', v: 240, pct: 6, c: 'danger' },
            ].map(s => <Progress key={s.l} label={s.l} sublabel={(s.v).toLocaleString('fr-FR') + 'k'} value={s.pct} variant={s.c}/>)}
          </div>
        </Card>
        <Card style={{ background: 'var(--success-50)', border: '1px solid var(--success-200)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Icon name="trophy" size={18} color="var(--success-700)"/>
            <div>
              <div className="display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--success-900)' }}>Impact mesuré</div>
              <p style={{ fontSize: 12, color: 'var(--success-800)', margin: '4px 0 0', lineHeight: 1.55 }}>
                Les 42 boursiers ont une moyenne supérieure de <strong>+1,4 pts</strong> à la moyenne établissement. 86% poursuivent au-delà du BEPC.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 7 · CLUBS & VIE ASSOCIATIVE ────────────────────────────
const ClubsPage = () => (
  <DashShell role="ÉLÈVE" user="Aïcha Hounsou" nav={directorNav.slice(0, 8).map((n, i) => ({ ...n, active: i === 5 }))}>
    <PageTitle title="Clubs & activités · CBE"
      sub="18 clubs actifs · 642 élèves inscrits · inscriptions ouvertes jusqu'au 20 mai">
      <Badge variant="success" icon="check">Tu es dans 2 clubs</Badge>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
      {[
        { n: 'Robotique', cat: 'Sciences', m: 24, prof: 'M. Sossou', day: 'Mer 14h-16h', mine: true, c: 'info', icon: 'sparkle', desc: 'Construction, programmation, compétition régionale. Niveau débutant à confirmé.' },
        { n: 'Théâtre', cat: 'Arts', m: 32, prof: 'Mme Bossou', day: 'Sam 9h-12h', mine: true, c: 'warning', icon: 'users', desc: 'Pièce annuelle pour la fête de fin d\'année. Toutes les classes mélangées.' },
        { n: 'Football', cat: 'Sport', m: 56, prof: 'M. Coffi', day: 'Mer 16h-18h', c: 'success', icon: 'flame', desc: 'Équipe école · championnat inter-établissements. Filles & garçons.' },
        { n: 'Échecs', cat: 'Stratégie', m: 18, prof: 'M. Adjavon', day: 'Ven 16h-17h', c: 'brand', icon: 'trophy', desc: 'Tournois mensuels · classement ELO interne. Tous niveaux.' },
        { n: 'Chorale', cat: 'Arts', m: 28, prof: 'Mme Akin', day: 'Jeu 16h-17h30', c: 'warning', icon: 'sms', desc: 'Cérémonies officielles, concerts. Répertoire local et international.' },
        { n: 'Journal scolaire', cat: 'Médias', m: 14, prof: 'Mme Bio', day: 'Mar 16h-17h', c: 'info', icon: 'pencil', desc: '"Le Phare CBE" · mensuel · interviews, reportages, photos.' },
      ].map((club, i) => (
        <Card key={i} padding={20} style={{
          border: club.mine ? '2px solid var(--success-600)' : '1px solid var(--border-default)',
          background: club.mine ? 'var(--success-50)' : 'var(--surface-card)',
          position: 'relative',
        }}>
          {club.mine && <Badge variant="success" size="sm" icon="check" style={{ position: 'absolute', top: 12, right: 12 }}>Inscrit</Badge>}
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `var(--${club.c}-100)`, display: 'grid', placeItems: 'center', marginBottom: 14 }}>
            <Icon name={club.icon} size={22} color={`var(--${club.c}-700)`}/>
          </div>
          <div className="display" style={{ fontSize: 18, fontWeight: 700 }}>{club.n}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>{club.cat} · {club.m} membres</div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 12px' }}>{club.desc}</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
            <span>🗓 {club.day}</span>
            <span>👨‍🏫 {club.prof}</span>
          </div>
          {club.mine ? <Button variant="secondary" size="sm" full>Voir les activités</Button> : <Button size="sm" full icon="plus">Rejoindre</Button>}
        </Card>
      ))}
    </div>
  </DashShell>
);

// ─── 8 · RH ENSEIGNANTS ─────────────────────────────────────
const TeacherHRPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="Ressources humaines · enseignants"
      sub="62 contrats actifs · 4 absences cette semaine · 2 demandes de congé"
      breadcrumb={['Administration', 'RH', 'Enseignants']}>
      <Button variant="secondary" icon="download">Fiche de paie · juin</Button>
      <Button icon="plus">Recruter</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Enseignants" value="62" trend={5} icon="users" variant="brand"/>
      <MetricCard label="Heures dues / sem." value="1 240" icon="clock" variant="info"/>
      <MetricCard label="Absents aujourd'hui" value="4" icon="warning" variant="warning"/>
      <MetricCard label="Remplacements OK" value="3/4" icon="check" variant="success"/>
      <MetricCard label="Masse salariale · mois" value="22,4" unit="M FCFA" icon="money" variant="brand"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '12px 18px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)' }}>
          <Chip active>Tous · 62</Chip>
          <Chip count={48}>Titulaires</Chip>
          <Chip count={10}>Vacataires</Chip>
          <Chip count={4}>Absents</Chip>
          <Chip count={2}>Congé en cours</Chip>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--surface-sunken)' }}>
            {['Enseignant', 'Matière · classes', 'Contrat', 'Heures', 'État', 'Action'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              { n: 'Paul Adjavon', m: 'Mathématiques · 3ᵉ A, 4ᵉ B, 6ᵉ C', c: 'CDI · titulaire', h: '20/20', s: 'present', sL: 'Présent', v: 'success' },
              { n: 'Sylvie Bio', m: 'Français · 3ᵉ A, 5ᵉ', c: 'CDI · titulaire', h: '18/20', s: 'present', sL: 'Présent', v: 'success' },
              { n: 'Marc Dossou', m: 'Histoire-Géo · 4ᵉ-3ᵉ', c: 'CDD · vacataire', h: '12/15', s: 'absent', sL: 'Maladie · 3j', v: 'danger' },
              { n: 'Claire Hounsou', m: 'SVT · 3ᵉ, 4ᵉ, 5ᵉ', c: 'CDI · titulaire', h: '20/20', s: 'leave', sL: 'Congé maternité', v: 'warning' },
              { n: 'Joseph Coffi', m: 'EPS · tous niveaux', c: 'CDI · titulaire', h: '22/22', s: 'present', sL: 'Présent', v: 'success' },
              { n: 'Marie Bossou', m: 'Arts plastiques', c: 'Vacataire', h: '6/8', s: 'replacement', sL: 'Remplace C. Hounsou', v: 'info' },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={r.n} size="sm" status={r.s === 'present' ? 'online' : r.s === 'absent' ? 'busy' : 'away'}/>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.n}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.c}</div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{r.m}</td>
                <td style={{ padding: '12px 14px' }}><Badge variant="neutral" size="sm">{r.c.split(' ·')[0]}</Badge></td>
                <td style={{ padding: '12px 14px' }} className="tabular">{r.h}</td>
                <td style={{ padding: '12px 14px' }}><Badge variant={r.v} size="sm" dot={r.v !== 'success'}>{r.sL}</Badge></td>
                <td style={{ padding: '12px 14px' }}><Button variant="ghost" size="sm" iconRight="arrowRight">Fiche</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <SubLabel>Demandes de congé · à valider</SubLabel>
          {[
            { n: 'Sylvie Bio', t: '3 jours · convenance personnelle', d: '12-14 mai', remp: 'Pas encore désigné', c: 'warning' },
            { n: 'Marc Dossou', t: '1 semaine · formation', d: '20-26 mai', remp: 'M. Hounsou OK', c: 'success' },
          ].map((r, i) => (
            <div key={i} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Avatar name={r.n} size="sm"/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.n}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.t}</div>
                </div>
                <Badge variant={r.c} size="sm">{r.d}</Badge>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 42 }}>
                Remplacement : <strong style={{ color: r.c === 'success' ? 'var(--success-700)' : 'var(--warning-700)' }}>{r.remp}</strong>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, marginLeft: 42 }}>
                <Button size="sm" icon="check">Approuver</Button>
                <Button size="sm" variant="ghost">Refuser</Button>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <SubLabel>Paie · juin 2026</SubLabel>
          <div className="display tabular" style={{ fontSize: 32, fontWeight: 800, color: 'var(--brand-700)', marginTop: 6 }}>22,4 <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>M FCFA</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>62 fiches générées · à valider avant le 28</div>
          <Button variant="secondary" size="sm" full style={{ marginTop: 12 }} icon="download">Télécharger toutes les fiches</Button>
        </Card>
      </div>
    </div>
  </DashShell>
);

// ─── 9 · ALUMNI ────────────────────────────────────────────
const AlumniPage = () => (
  <DashShell role="DIRECTRICE" user="Mme Akpovi" groups={directorGroups}>
    <PageTitle title="Réseau Alumni · CBE"
      sub="3 248 anciens élèves recensés · 18 promotions · 142 contributeurs actifs"
      breadcrumb={['Communauté', 'Alumni']}>
      <Button variant="secondary" icon="sms">Newsletter trimestrielle</Button>
      <Button icon="plus">Nouvel événement</Button>
    </PageTitle>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
      <MetricCard label="Anciens élèves" value="3 248" trend={6} icon="users" variant="brand"/>
      <MetricCard label="Dons cumulés (5 ans)" value="48" unit="M FCFA" trend={22} icon="money" variant="success"/>
      <MetricCard label="Mentors actifs" value="84" trend={14} icon="sparkle" variant="info"/>
      <MetricCard label="Événements / an" value="6" icon="calendar" variant="warning"/>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
      <Card padding={0}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="display" style={{ fontSize: 16, margin: 0 }}>Alumni en vue · mentors disponibles</h3>
          <Chip active>Tous</Chip>
        </div>
        {[
          { n: 'Dr. Aïssatou Bocco', promo: 'BAC 2008 · D', job: 'Chirurgienne · CNHU-HKM Cotonou', mentor: 'Étudiants D', avatar: 'med' },
          { n: 'Ing. Patrick Tossou', promo: 'BAC 2010 · C', job: 'Tech Lead · Orange Bénin', mentor: 'Sciences & info', avatar: 'tech' },
          { n: 'Me Léa Houngbedji', promo: 'BAC 2005 · A1', job: 'Avocate au barreau', mentor: 'Filière A', avatar: 'law' },
          { n: 'Mme Fatou Bio', promo: 'BAC 2012 · G2', job: 'Directrice Marketing · MTN', mentor: 'Filière G', avatar: 'biz' },
          { n: 'M. Olivier Coffi', promo: 'BAC 2003 · F3', job: 'Entrepreneur · solaire', mentor: 'F1-F4 industrie', avatar: 'energy' },
        ].map((a, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 14, padding: '14px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0, alignItems: 'center' }}>
            <Avatar name={a.n} size="md"/>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{a.n}</div>
              <div style={{ fontSize: 11, color: 'var(--brand-700)', fontWeight: 600 }}>{a.promo}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.job}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <Badge variant="success" size="sm" icon="sparkle">Mentor</Badge>
              <Button variant="ghost" size="sm" iconRight="arrowRight">Connecter</Button>
            </div>
          </div>
        ))}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card style={{ background: 'linear-gradient(135deg, var(--brand-700), var(--accent-600))', color: '#fff', border: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85 }}>Prochain événement</div>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 8, lineHeight: 1.2 }}>Gala des 30 ans CBE</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>Samedi 14 juin 2026 · Hôtel du Lac · 19h</div>
          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.88 }}>248 confirmés · objectif don 5M FCFA pour la bibliothèque</div>
          <Button size="sm" style={{ background: '#fff', color: 'var(--brand-700)', marginTop: 14 }}>Voir le programme</Button>
        </Card>

        <Card>
          <SubLabel>Top promotions actives</SubLabel>
          <div style={{ marginTop: 8 }}>
            {[
              { p: 'Promo 2010', m: 42, don: '6,2M' },
              { p: 'Promo 2015', m: 38, don: '4,8M' },
              { p: 'Promo 2008', m: 31, don: '8,1M' },
              { p: 'Promo 2018', m: 28, don: '2,4M' },
            ].map(p => (
              <div key={p.p} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.p}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 12 }}>{p.m} membres</span>
                <span className="display tabular" style={{ fontSize: 13, fontWeight: 700, color: 'var(--success-700)' }}>{p.don}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SubLabel>Faire un don à l'école</SubLabel>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '6px 0 10px' }}>
            Financez bourses, infrastructure, livres. 100% reversé · reçu fiscal automatique.
          </p>
          <Button full icon="money" style={{ background: 'var(--gradient-cta)' }}>Faire un don</Button>
        </Card>
      </div>
    </div>
  </DashShell>
);

Object.assign(window, {
  AcademicConfig, WhatsAppPage, OfflinePage, QRBadgePage,
  ExamsPrepPage, ScholarshipsPage, ClubsPage, TeacherHRPage, AlumniPage,
});
