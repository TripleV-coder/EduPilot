// EduPilot — Auth flows

const AuthFrame = ({ title, sub, children, side = 'login' }) => (
  <div style={{ width: 1280, height: 800, display: 'grid', gridTemplateColumns: '1fr 1.1fr', background: 'var(--surface-page)' }}>
    {/* Left: form */}
    <div style={{ padding: '48px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--surface-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo size={32}/>
        <span className="display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>EduPilot</span>
      </div>
      <div style={{ maxWidth: 380, width: '100%' }}>
        <h1 className="display" style={{ fontSize: 36, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.025em' }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 32px', lineHeight: 1.55 }}>{sub}</p>
        {children}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)' }}>
        <span>© 2026 EduPilot</span>
        <span>Aide · Confidentialité · CGV</span>
      </div>
    </div>
    {/* Right: brand panel */}
    <div style={{ background: 'linear-gradient(135deg, var(--brand-700), var(--accent-600))', position: 'relative', overflow: 'hidden', padding: 56, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 50% at 80% 20%, rgba(255,255,255,0.18), transparent 60%)' }}/>
      <div style={{ position: 'absolute', top: 40, right: 40, display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, opacity: 0.85 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }}/>
        Tous les systèmes opérationnels
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 18 }}>L'École, simplifiée</div>
        <p className="display" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.025em', margin: '0 0 28px', color: '#fff' }}>
          « Le recouvrement a bondi de 38% en un trimestre. EduPilot fait le travail à notre place. »
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name="Mme Akpovi" size="md"/>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Mme Akpovi</div>
            <div style={{ fontSize: 12, opacity: 0.78 }}>Directrice · Cours Bénin Excellence</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const LoginScreen = () => (
  <AuthFrame title="Bon retour 👋" sub="Connectez-vous avec votre adresse école ou votre numéro de téléphone parent.">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Input label="Email ou téléphone" icon="users" value="m.akpovi@excellence.bj"/>
      <Input label="Mot de passe" icon="settings" type="password" value="••••••••••"/>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <input type="checkbox" defaultChecked/> Rester connecté
        </label>
        <a style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-700)', cursor: 'pointer' }}>Mot de passe oublié ?</a>
      </div>
      <Button size="lg" full iconRight="arrowRight" style={{ marginTop: 8, background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)' }}>Se connecter</Button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0', color: 'var(--text-tertiary)', fontSize: 11 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}/>OU<div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}/>
      </div>
      <Button variant="secondary" size="lg" full>Continuer avec votre code école</Button>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 18 }}>
        Pas de compte ? <a style={{ color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer' }}>Demander un accès</a>
      </p>
    </div>
  </AuthFrame>
);

const RegisterScreen = () => (
  <AuthFrame title="Créez votre établissement" sub="2 minutes. Vos données restent au Bénin. Aucune carte bancaire requise.">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Prénom" value="Marie"/>
        <Input label="Nom" value="Akpovi"/>
      </div>
      <Input label="Établissement" icon="school" value="Cours Bénin Excellence"/>
      <Input label="Email professionnel" icon="sms" value="m.akpovi@excellence.bj"/>
      <Input label="Téléphone (WhatsApp)" icon="sms" value="+229 95 12 34 56"/>
      <div style={{ padding: 12, background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="info" size={16} color="var(--brand-700)" style={{ marginTop: 2 }}/>
        <div style={{ fontSize: 12, color: 'var(--brand-800)', lineHeight: 1.5 }}>
          Un conseiller vous contacte sous 24h pour importer vos données et former vos enseignants — gratuitement.
        </div>
      </div>
      <Button size="lg" full iconRight="arrowRight" style={{ background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)' }}>Créer mon compte</Button>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.55 }}>
        En continuant, vous acceptez nos CGV, notre politique de confidentialité et la conformité MEMP/RGPD.
      </p>
    </div>
  </AuthFrame>
);

const MFAScreen = () => (
  <AuthFrame title="Vérification en 2 étapes" sub="Pour protéger les données de vos élèves, entrez le code envoyé au +229 95 ** ** 56.">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        {['7', '4', '2', '9', '', ''].map((d, i) => (
          <div key={i} style={{
            width: 56, height: 64, borderRadius: 'var(--radius-md)',
            border: `1.5px solid ${d ? 'var(--brand-600)' : 'var(--border-default)'}`,
            background: d ? 'var(--brand-50)' : 'var(--surface-card)',
            display: 'grid', placeItems: 'center',
            fontSize: 28, fontWeight: 700, color: 'var(--text-primary)',
            position: 'relative',
          }} className="display tabular">
            {d}
            {!d && i === 4 && <span style={{ position: 'absolute', width: 2, height: 28, background: 'var(--brand-600)', animation: 'eduPulse 1s infinite' }}/>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Code reçu par SMS</span>
        <a style={{ color: 'var(--brand-700)', fontWeight: 600, cursor: 'pointer' }}>Renvoyer dans 0:42</a>
      </div>
      <Button size="lg" full disabled>Vérifier</Button>
      <Button variant="ghost" size="md" icon="sms" full>Essayer par WhatsApp</Button>
    </div>
  </AuthFrame>
);

const ForgotScreen = () => (
  <AuthFrame title="Mot de passe oublié ?" sub="Ça arrive. Indiquez votre email — nous envoyons un lien de réinitialisation valide 1h.">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Input label="Email" icon="sms" value="m.akpovi@excellence.bj"/>
      <Button size="lg" full iconRight="arrowRight" style={{ background: 'var(--gradient-cta)' }}>Envoyer le lien</Button>
      <div style={{ padding: 14, background: 'var(--success-50)', border: '1px solid var(--success-200)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="check" size={16} color="var(--success-700)" style={{ marginTop: 2 }}/>
        <div style={{ fontSize: 12, color: 'var(--success-800)', lineHeight: 1.55 }}>
          <strong>Email envoyé.</strong> Vérifiez votre boîte (et les spams). Pensez aussi à votre SMS de secours.
        </div>
      </div>
      <Button variant="ghost" full size="md" icon="chevron" style={{ marginTop: 8 }}>Retour à la connexion</Button>
    </div>
  </AuthFrame>
);

Object.assign(window, { LoginScreen, RegisterScreen, MFAScreen, ForgotScreen });
