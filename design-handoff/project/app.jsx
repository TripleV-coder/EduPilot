// EduPilot — main app: design canvas + tweaks panel

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "deepblue",
  "displayFont": "Bricolage Grotesque",
  "bodyFont": "Plus Jakarta Sans",
  "theme": "light",
  "language": "fr"
}/*EDITMODE-END*/;

const App = () => {
  const [tw, setTweak] = useTweaks(DEFAULTS);

  // Apply palette + theme to <html>
  React.useEffect(() => {
    const paletteMap = { deepblue: null, emerald: 'emerald', terracotta: 'terracotta', indigo: 'indigo' };
    const p = paletteMap[tw.palette];
    if (p) document.documentElement.setAttribute('data-palette', p);
    else document.documentElement.removeAttribute('data-palette');
    document.documentElement.setAttribute('data-theme', tw.theme);
    document.documentElement.style.setProperty('--font-display', `'${tw.displayFont}', system-ui, sans-serif`);
    document.documentElement.style.setProperty('--font-body', `'${tw.bodyFont}', system-ui, sans-serif`);
  }, [tw.palette, tw.theme, tw.displayFont, tw.bodyFont]);

  return (
    <>
      <DesignCanvas>
        <DCSection id="ds" title="01 · Design System" subtitle="Tokens, foundation components, edu-business components">
          <DCArtboard id="showcase" label="Showcase complet" width={1100} height={3450}>
            <Showcase/>
          </DCArtboard>
        </DCSection>

        <DCSection id="dashboards" title="02 · Dashboards par rôle (desktop)" subtitle="Une UI qui s'adapte au rôle — chaud mais précis">
          <DCArtboard id="director" label="Directrice — pilotage établissement" width={1280} height={820}>
            <DirectorDash/>
          </DCArtboard>
          <DCArtboard id="teacher" label="Enseignant — saisie de notes & appel" width={1280} height={820}>
            <TeacherDash/>
          </DCArtboard>
          <DCArtboard id="parent" label="Parent — paiements & enfants" width={1280} height={820}>
            <ParentDash/>
          </DCArtboard>
          <DCArtboard id="student" label="Élève — gamifié & motivant" width={1280} height={820}>
            <StudentDash/>
          </DCArtboard>
          <DCArtboard id="superadmin" label="Super Admin — vue réseau multi-sites" width={1280} height={820}>
            <SuperAdminDash/>
          </DCArtboard>
        </DCSection>

        <DCSection id="mobile" title="03 · Mobile · 375px" subtitle="Parents/élèves : bottom nav, gros tap targets, offline-first">
          <DCArtboard id="parent-m" label="Parent — accueil" width={395} height={780}>
            <ParentMobile/>
          </DCArtboard>
          <DCArtboard id="student-m" label="Élève — accueil" width={395} height={780}>
            <StudentMobile/>
          </DCArtboard>
          <DCArtboard id="teacher-m" label="Enseignant — appel tactile offline" width={395} height={780}>
            <TeacherMobile/>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks · EduPilot DS">
        <TweakSection label="Palette de marque">
          <TweakColor label="Couleur primaire"
            options={[
              ['#1f3a8a', '#3245c9', '#dde5ff'],
              ['#065f46', '#10b981', '#d1fae5'],
              ['#6f2a18', '#d9622e', '#fbe5d3'],
              ['#5b21b6', '#8b5cf6', '#ede9fe'],
            ]}
            value={tw.palette === 'deepblue' ? ['#1f3a8a','#3245c9','#dde5ff'] : tw.palette === 'emerald' ? ['#065f46','#10b981','#d1fae5'] : tw.palette === 'terracotta' ? ['#6f2a18','#d9622e','#fbe5d3'] : ['#5b21b6','#8b5cf6','#ede9fe']}
            onChange={v => {
              const p = v[0] === '#1f3a8a' ? 'deepblue' : v[0] === '#065f46' ? 'emerald' : v[0] === '#6f2a18' ? 'terracotta' : 'indigo';
              setTweak('palette', p);
            }}/>
        </TweakSection>

        <TweakSection label="Typographie">
          <TweakSelect label="Display (titres)" value={tw.displayFont}
            options={['Bricolage Grotesque', 'Cabinet Grotesk', 'Syne', 'Space Grotesk', 'Fraunces']}
            onChange={v => setTweak('displayFont', v)}/>
          <TweakSelect label="Body / UI" value={tw.bodyFont}
            options={['Plus Jakarta Sans', 'DM Sans', 'Outfit', 'Inter', 'Manrope']}
            onChange={v => setTweak('bodyFont', v)}/>
        </TweakSection>

        <TweakSection label="Apparence">
          <TweakRadio label="Mode" value={tw.theme} options={['light', 'dark']}
            onChange={v => setTweak('theme', v)}/>
          <TweakRadio label="Langue mocks" value={tw.language} options={['fr', 'en']}
            onChange={v => setTweak('language', v)}/>
        </TweakSection>
      </TweaksPanel>
    </>
  );
};

// Inject extra fonts the user can switch to
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@500;600;700&family=Syne:wght@500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap';
document.head.appendChild(fontLink);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
