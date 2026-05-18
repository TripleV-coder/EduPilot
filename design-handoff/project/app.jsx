// EduPilot — main app: design canvas + tweaks panel

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "deepblue",
  "displayFont": "Inter",
  "bodyFont": "Inter",
  "theme": "light",
  "density": "regular",
  "language": "fr"
}/*EDITMODE-END*/;

const PALETTES = {
  deepblue:   ['#1D4ED8', '#3B82F6', '#DBEAFE'],
  emerald:    ['#047857', '#10B981', '#D1FAE5'],
  terracotta: ['#93371D', '#D9622E', '#FBE5D3'],
  indigo:     ['#6D28D9', '#8B5CF6', '#EDE9FE'],
};

const App = () => {
  const [tw, setTweak] = useTweaks(DEFAULTS);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-palette', tw.palette || 'deepblue');
    document.documentElement.setAttribute('data-theme', tw.theme || 'light');
    document.documentElement.setAttribute('data-density', tw.density || 'regular');
    document.documentElement.style.setProperty('--font-display', `'${tw.displayFont}', system-ui, sans-serif`);
    document.documentElement.style.setProperty('--font-body', `'${tw.bodyFont}', system-ui, sans-serif`);
  }, [tw.palette, tw.theme, tw.density, tw.displayFont, tw.bodyFont]);

  return (
    <>
      <DesignCanvas>
        <DCSection id="ds" title="01 · Design System" subtitle="Tokens EduFlow · foundation · edu components">
          <DCArtboard id="showcase" label="Showcase complet" width={1100} height={3450}>
            <Showcase/>
          </DCArtboard>
        </DCSection>

        <DCSection id="landing" title="02 · Site marketing" subtitle="Hero, features, pricing, témoignages, FAQ, CTA — un seul scroll">
          <DCArtboard id="landing" label="Page d'accueil edupilot.bj" width={1280} height={3680}>
            <Landing/>
          </DCArtboard>
        </DCSection>

        <DCSection id="auth" title="03 · Auth & onboarding" subtitle="Login, register, MFA, mot de passe oublié">
          <DCArtboard id="login" label="Connexion" width={1280} height={800}>
            <LoginScreen/>
          </DCArtboard>
          <DCArtboard id="register" label="Créer un compte établissement" width={1280} height={800}>
            <RegisterScreen/>
          </DCArtboard>
          <DCArtboard id="mfa" label="MFA · vérification 2 étapes" width={1280} height={800}>
            <MFAScreen/>
          </DCArtboard>
          <DCArtboard id="forgot" label="Mot de passe oublié" width={1280} height={800}>
            <ForgotScreen/>
          </DCArtboard>
        </DCSection>

        <DCSection id="dashboards" title="04 · Dashboards par rôle" subtitle="Une UI qui s'adapte au rôle — chaud mais précis">
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

        <DCSection id="modules" title="05 · Modules métier" subtitle="8 pages clés du produit · profondeur fonctionnelle">
          <DCArtboard id="grades" label="Notes — carnet complet 26 élèves × 10 devoirs" width={1280} height={820}>
            <GradesPage/>
          </DCArtboard>
          <DCArtboard id="attendance" label="Présences — appel quotidien 4ᵉ B" width={1280} height={820}>
            <AttendancePage/>
          </DCArtboard>
          <DCArtboard id="finance" label="Finance — recouvrement T2" width={1280} height={820}>
            <FinancePage/>
          </DCArtboard>
          <DCArtboard id="schedule" label="Emploi du temps — drag & drop" width={1280} height={820}>
            <SchedulePage/>
          </DCArtboard>
          <DCArtboard id="health" label="Santé & incidents — infirmerie" width={1280} height={820}>
            <HealthPage/>
          </DCArtboard>
          <DCArtboard id="ai" label="Assistant IA — chat & insights" width={1280} height={820}>
            <AIPage/>
          </DCArtboard>
          <DCArtboard id="library" label="Bibliothèque — catalogue & retards" width={1280} height={820}>
            <LibraryPage/>
          </DCArtboard>
          <DCArtboard id="cafeteria" label="Cantine — menus & allergies" width={1280} height={820}>
            <CafeteriaPage/>
          </DCArtboard>
        </DCSection>

        <DCSection id="onboarding" title="06 · Onboarding par rôle" subtitle="5 parcours adaptés · directeur (5 étapes établissement) · enseignant · parent · élève · super admin">
          <DCArtboard id="onb-1" label="Directeur · 1 — identité établissement" width={1280} height={800}>
            <OnboardingStep1/>
          </DCArtboard>
          <DCArtboard id="onb-2" label="Directeur · 2 — cycles & classes" width={1280} height={800}>
            <OnboardingStep2/>
          </DCArtboard>
          <DCArtboard id="onb-3" label="Directeur · 3 — import élèves CSV" width={1280} height={800}>
            <OnboardingStep3/>
          </DCArtboard>
          <DCArtboard id="onb-4" label="Directeur · 4 — équipe & rôles" width={1280} height={800}>
            <OnboardingStep4/>
          </DCArtboard>
          <DCArtboard id="onb-5" label="Directeur · 5 — paiement & lancement" width={1280} height={800}>
            <OnboardingStep5/>
          </DCArtboard>
          <DCArtboard id="onb-teacher" label="Enseignant · 1ʳᵉ saisie de note" width={1280} height={800}>
            <TeacherOnboarding/>
          </DCArtboard>
          <DCArtboard id="onb-parent" label="Parent · lier mon enfant via matricule" width={1280} height={800}>
            <ParentOnboarding/>
          </DCArtboard>
          <DCArtboard id="onb-student" label="Élève · choisir mon objectif trimestre" width={1280} height={800}>
            <StudentOnboarding/>
          </DCArtboard>
          <DCArtboard id="onb-superadmin" label="Super Admin · réseau multi-sites" width={1280} height={800}>
            <SuperAdminOnboarding/>
          </DCArtboard>
        </DCSection>

        <DCSection id="notifs" title="07 · Notifications intelligentes · par rôle" subtitle="Le même centre, mais chacun ne voit que ce qui compte pour lui · regroupement IA · multi-canal">
          <DCArtboard id="notif-director" label="Directrice — pilotage P0, finance, IA" width={1280} height={920}>
            <NotifCenter/>
          </DCArtboard>
          <DCArtboard id="notif-teacher" label="Enseignant — saisies, absences classe, IA pédago" width={1280} height={920}>
            <NotifTeacher/>
          </DCArtboard>
          <DCArtboard id="notif-parent" label="Parent — paiements, notes enfant, absences, événements" width={1280} height={920}>
            <NotifParent/>
          </DCArtboard>
          <DCArtboard id="notif-student" label="Élève — devoirs, notes, badges, messages prof" width={1280} height={920}>
            <NotifStudent/>
          </DCArtboard>
        </DCSection>

        <DCSection id="orientation" title="08 · Orientation · système béninois A → G + CEP" subtitle="Décision conseil · vœux famille · IA · conforme DOB/MEMP · CEP & BEPC pris en charge">
          <DCArtboard id="orientation-council" label="Conseil · post-BEPC · 7 séries + DT" width={1280} height={1300}>
            <OrientationPage/>
          </DCArtboard>
          <DCArtboard id="orientation-student" label="Élève · mes 3 vœux + mentions bac" width={1280} height={900}>
            <OrientationStudent/>
          </DCArtboard>
          <DCArtboard id="orientation-cep" label="Primaire · CEP · passage CM2 → 6ᵉ" width={1280} height={900}>
            <OrientationCEP/>
          </DCArtboard>
        </DCSection>

        <DCSection id="student-suite" title="09 · Dossier élève complet" subtitle="Profil 360° · bulletin · conseil de classe · inscription">
          <DCArtboard id="profile" label="Profil élève 360° — Aïcha Hounsou" width={1280} height={920}>
            <StudentProfile/>
          </DCArtboard>
          <DCArtboard id="bulletin" label="Bulletin trimestriel — print-ready A4" width={794} height={1123}>
            <Bulletin/>
          </DCArtboard>
          <DCArtboard id="council" label="Conseil de classe — validation bulletins" width={1280} height={820}>
            <ClassCouncil/>
          </DCArtboard>
          <DCArtboard id="inscription" label="Inscription — formulaire long 5 étapes" width={1280} height={820}>
            <Inscription/>
          </DCArtboard>
        </DCSection>

        <DCSection id="operations" title="10 · Opérations & pédagogie" subtitle="Discipline, examens, messagerie, devoirs, compétences, gamification, templates">
          <DCArtboard id="discipline" label="Discipline — sanctions & climat" width={1280} height={820}>
            <DisciplinePage/>
          </DCArtboard>
          <DCArtboard id="exams" label="Examens — planning compositions" width={1280} height={820}>
            <ExamsPage/>
          </DCArtboard>
          <DCArtboard id="messaging" label="Messagerie — 3 panneaux Slack-like" width={1280} height={820}>
            <MessagingPage/>
          </DCArtboard>
          <DCArtboard id="lms" label="Devoirs & ressources LMS" width={1280} height={820}>
            <LMSPage/>
          </DCArtboard>
          <DCArtboard id="competences" label="Évaluations par compétences MEMP" width={1280} height={820}>
            <CompetencesPage/>
          </DCArtboard>
          <DCArtboard id="gamification" label="Gamification — badges & leaderboard" width={1280} height={820}>
            <GamificationPage/>
          </DCArtboard>
          <DCArtboard id="templates" label="Templates SMS / Email — variables IA" width={1280} height={820}>
            <TemplatesPage/>
          </DCArtboard>
        </DCSection>

        <DCSection id="system" title="11 · Système & conformité" subtitle="Settings · RBAC · audit · import · BI builder">
          <DCArtboard id="settings" label="Paramètres — identité & branding" width={1280} height={820}>
            <SettingsPage/>
          </DCArtboard>
          <DCArtboard id="rbac" label="Rôles & permissions" width={1280} height={820}>
            <RBACPage/>
          </DCArtboard>
          <DCArtboard id="audit" label="Journal d'audit MEMP" width={1280} height={820}>
            <AuditPage/>
          </DCArtboard>
          <DCArtboard id="import" label="Import CSV — mapping & validation" width={1280} height={820}>
            <ImportPage/>
          </DCArtboard>
          <DCArtboard id="analytics" label="Analytics BI — dashboard custom" width={1280} height={820}>
            <AnalyticsPage/>
          </DCArtboard>
        </DCSection>

        <DCSection id="states" title="12 · États, overlays & ⌘K" subtitle="Empty / loading / error · modals · command palette">
          <DCArtboard id="states" label="States · modals · palette" width={1280} height={1000}>
            <StatesPage/>
          </DCArtboard>
        </DCSection>

        <DCSection id="extras" title="13 · Outils complémentaires" subtitle="Calendrier global · cahier de liaison · mon compte · transport scolaire">
          <DCArtboard id="calendar" label="Calendrier établissement — vue mois" width={1280} height={820}>
            <CalendarPage/>
          </DCArtboard>
          <DCArtboard id="liaison" label="Cahier de liaison digital — vue parent" width={1280} height={820}>
            <LiaisonBook/>
          </DCArtboard>
          <DCArtboard id="account" label="Mon compte — profil & sessions" width={1280} height={820}>
            <MyAccountPage/>
          </DCArtboard>
          <DCArtboard id="transport" label="Transport scolaire — GPS bus temps réel" width={1280} height={820}>
            <TransportPage/>
          </DCArtboard>
          <DCArtboard id="sidebar-collapsed" label="Sidebar collapsée — mode rail 64px" width={1280} height={820}>
            <SidebarCollapsedDemo/>
          </DCArtboard>
        </DCSection>

        <DCSection id="value-add" title="14 · Valeur ajoutée · spécifique Bénin" subtitle="Trim/sem · WhatsApp · offline · QR · annales · bourses · clubs · RH · alumni">
          <DCArtboard id="academic-config" label="Année académique — trimestres vs semestres" width={1280} height={920}>
            <AcademicConfig/>
          </DCArtboard>
          <DCArtboard id="whatsapp" label="WhatsApp Business — canal #1 au Bénin" width={1280} height={920}>
            <WhatsAppPage/>
          </DCArtboard>
          <DCArtboard id="offline" label="Mode hors-ligne / PWA — sync en attente" width={1280} height={820}>
            <OfflinePage/>
          </DCArtboard>
          <DCArtboard id="qr-badge" label="QR Badge & contrôle d'accès live" width={1280} height={820}>
            <QRBadgePage/>
          </DCArtboard>
          <DCArtboard id="exams-prep" label="Concours BEPC — annales & IA tutrice" width={1280} height={920}>
            <ExamsPrepPage/>
          </DCArtboard>
          <DCArtboard id="scholarships" label="Bourses & aides MEMP" width={1280} height={820}>
            <ScholarshipsPage/>
          </DCArtboard>
          <DCArtboard id="clubs" label="Clubs & vie associative" width={1280} height={920}>
            <ClubsPage/>
          </DCArtboard>
          <DCArtboard id="hr" label="RH enseignants — contrats, congés, paie" width={1280} height={820}>
            <TeacherHRPage/>
          </DCArtboard>
          <DCArtboard id="alumni" label="Réseau Alumni — mentorat & dons" width={1280} height={820}>
            <AlumniPage/>
          </DCArtboard>
        </DCSection>

        <DCSection id="mobile" title="15 · Mobile · 375px" subtitle="Parents/élèves/enseignants : bottom nav, offline-first">
          <DCArtboard id="parent-m" label="Parent — accueil" width={395} height={780}>
            <ParentMobile/>
          </DCArtboard>
          <DCArtboard id="student-m" label="Élève — accueil gamifié" width={395} height={780}>
            <StudentMobile/>
          </DCArtboard>
          <DCArtboard id="teacher-m" label="Enseignant — appel tactile offline" width={395} height={780}>
            <TeacherMobile/>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks · EduPilot">
        <TweakSection label="Palette de marque">
          <TweakColor label="Couleur primaire"
            options={[PALETTES.deepblue, PALETTES.emerald, PALETTES.terracotta, PALETTES.indigo]}
            value={PALETTES[tw.palette] || PALETTES.deepblue}
            onChange={v => {
              const found = Object.entries(PALETTES).find(([, pal]) => pal[0] === v[0]);
              setTweak('palette', found ? found[0] : 'deepblue');
            }}/>
        </TweakSection>

        <TweakSection label="Typographie">
          <TweakSelect label="Display (titres)" value={tw.displayFont}
            options={['Inter', 'Bricolage Grotesque', 'Cabinet Grotesk', 'Syne', 'Space Grotesk', 'Fraunces']}
            onChange={v => setTweak('displayFont', v)}/>
          <TweakSelect label="Body / UI" value={tw.bodyFont}
            options={['Inter', 'Plus Jakarta Sans', 'DM Sans', 'Outfit', 'Manrope']}
            onChange={v => setTweak('bodyFont', v)}/>
        </TweakSection>

        <TweakSection label="Apparence">
          <TweakRadio label="Mode" value={tw.theme} options={['light', 'dark']}
            onChange={v => setTweak('theme', v)}/>
          <TweakRadio label="Densité" value={tw.density} options={['regular', 'compact']}
            onChange={v => setTweak('density', v)}/>
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
fontLink.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Cabinet+Grotesk:wght@500;600;700&family=Syne:wght@500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap';
document.head.appendChild(fontLink);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
