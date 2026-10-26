
import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { User, Scenario, Skill, PracticeSession, Role, FeedbackAnalysis, PracticeAttempt, MicroSkill, SkillSnapshot, SkillLibrary, InteractionMedium } from './types';
import {
  logout,
  getUser,
  getScenarios,
  getSkills,
  getPracticeSessions,
  getPracticeAttempts,
  saveScenario,
  deleteScenario,
  savePracticeSession,
  deletePracticeSession,
  ensureDbInitialized,
  updateUserMemory,
  logEvent,
  savePracticeAttempt,
  getSkillLibrary
} from './services/firebase';
import { auth, stagingEnabled, freemiumEnabled } from './firebaseConfig';
import { AccessAccount, getAccessAccount, chooseFreeScenario } from './services/access';
import { AccessPanel } from './components/AccessPanel';
import { generateSkillSnapshot, analyzePracticeReflection, getFeedbackForTranscript } from './services/geminiService';

import { VerifyEmailPage } from './components/VerifyEmailPage';
import { LoginPage } from './components/LoginPage';
import { NetworkIcon } from './components/icons/NetworkIcon';
import { DashboardPage } from './components/DashboardPage';
import { RoleplayPage } from './components/RoleplayPage';
import { FeedbackPage } from './components/FeedbackPage';
import { HistoryPage } from './components/HistoryPage';
import { SkillSnapshotView } from './components/SkillSnapshotView';
import { ReflectionView } from './components/ReflectionView';
import { AppFeedbackModal } from './components/AppFeedbackModal';
import { AssessmentLaunchPage } from './components/AssessmentLaunchPage';


const App: React.FC = () => {
  const loadGeneration = useRef(0);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [access, setAccess] = useState<AccessAccount | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [confirmScenario, setConfirmScenario] = useState<Scenario | null>(null);
  const [choosingScenario, setChoosingScenario] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [practiceSessions, setPracticeSessions] = useState<PracticeSession[]>([]);
  const [practiceAttempts, setPracticeAttempts] = useState<PracticeAttempt[]>([]);
  const [appLibrary, setAppLibrary] = useState<SkillLibrary | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);

  const [activePage, setActivePage] = useState<'login' | 'dashboard' | 'assessment-launch' | 'roleplay' | 'feedback' | 'history' | 'snapshot' | 'reflection'>('dashboard');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [currentPracticeSession, setCurrentPracticeSession] = useState<PracticeSession | null>(null);
  const [feedbackInitialView, setFeedbackInitialView] = useState<'feedback' | 'choose_focus'>('feedback');

  const [activePracticeAttempt, setActivePracticeAttempt] = useState<Partial<PracticeAttempt> | null>(null);
  const [activeMicroSkill, setActiveMicroSkill] = useState<MicroSkill | null>(null);
  const [snapshot, setSnapshot] = useState<SkillSnapshot | null>(null);
  const [practiceType, setPracticeType] = useState<'diagnostic' | 'tutorial'>('diagnostic');
  const [interactionMedium, setInteractionMedium] = useState<InteractionMedium | null>(null);
  const [showAppFeedback, setShowAppFeedback] = useState(false);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      loadGeneration.current += 1;
      setFirebaseUser(user);
      setAppUser(null);
      setAccess(null);
      setPracticeSessions([]);
      setPracticeAttempts([]);
      setIsAuthLoading(false);
      if (!user) {
        setAppUser(null);
        setAccess(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadAppData = async () => {
    if (!firebaseUser || (freemiumEnabled && !firebaseUser.emailVerified)) return;
    const generation = ++loadGeneration.current;
    setIsLoadingData(true);
    setDataLoadError(null);
    const loadStartedAt = performance.now();

    try {
      const loadedAppUser = await getUser(firebaseUser.uid, { email: firebaseUser.email! });
      if (!loadedAppUser) throw new Error(`User profile initialization failed.`);

      let [loadedScenarios, loadedSkills] = await Promise.all([
        getScenarios(),
        getSkills(),
      ]);

      if (loadedScenarios.length === 0 || loadedSkills.length === 0) {
        await ensureDbInitialized();
        [loadedScenarios, loadedSkills] = await Promise.all([
          getScenarios(),
          getSkills(),
        ]);
      }

      const loadedAccess = freemiumEnabled ? await getAccessAccount() : null;
      if (generation !== loadGeneration.current) return;
      setAccess(loadedAccess);
      setAppUser(loadedAppUser);
      setScenarios(loadedScenarios);
      setSkills(loadedSkills);
      setIsLoadingData(false);

      console.info(`[Startup] Core app data loaded in ${Math.round(performance.now() - loadStartedAt)}ms.`);

      Promise.all([
        getPracticeSessions(firebaseUser.uid),
        getPracticeAttempts(firebaseUser.uid),
        getSkillLibrary(),
      ]).then(([loadedSessions, loadedAttempts, loadedLibrary]) => {
        if (generation !== loadGeneration.current) return;
        setPracticeSessions(loadedSessions);
        setPracticeAttempts(loadedAttempts);
        setAppLibrary(loadedLibrary);
        console.info(`[Startup] Background history data loaded in ${Math.round(performance.now() - loadStartedAt)}ms.`);
      }).catch((error) => {
        console.warn("[Startup] Background history data failed to load:", error);
      });
    } catch (error: any) {
      if (generation !== loadGeneration.current) return;
      console.error("Data load error:", error);
      setDataLoadError(error.message);
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (!isAuthLoading && firebaseUser) {
      loadAppData();
    }
  }, [firebaseUser, isAuthLoading]);

  useEffect(() => {
    if (!freemiumEnabled || !access?.organisations.length) return;
    if (access.organisations.some(o => o.expiresAt === null)) return;
    const expiresAt = Math.max(...access.organisations.map(o => o.expiresAt || 0));
    const timer = setTimeout(() => { getAccessAccount().then(setAccess).catch(() => setAccess(null)); }, Math.min(2147483647, Math.max(1, expiresAt - Date.now() + 1000)));
    return () => clearTimeout(timer);
  }, [access]);

  const handleLogout = async () => {
    await logout();
    setAppUser(null);
    setFirebaseUser(null);
    setActivePage('dashboard');
  };

  const handleStartPractice = (scenario: Scenario) => {
    setAccessError(null);
    if (freemiumEnabled && !access) return;
    if (freemiumEnabled && !access!.fullAccess) {
      if (!access!.freeScenarioId) { setConfirmScenario(scenario); return; }
      if (access!.freeScenarioId !== scenario.id) { setAccessError('Your free account includes your chosen scenario. Other scenarios require full access.'); return; }
    }
    setSelectedScenario(scenario);
    setCurrentPracticeSession(null);
    setActiveMicroSkill(null);
    setPracticeType('diagnostic');
    setInteractionMedium(null);
    setActivePage('assessment-launch');
  };

  const handleAssessmentMediumSelect = (medium: InteractionMedium) => {
    if (!selectedScenario) return;
    setInteractionMedium(medium);
    setActivePage('roleplay');
    logEvent(appUser?.id!, 'assessor_lab_started', { scenarioId: selectedScenario.id, interactionMedium: medium });
  };

  const handleBeginPracticeLoop = async (groupId: string, microSkillId: string, reason: string) => {
    if (!appUser || !currentPracticeSession || !selectedScenario) return;

    logEvent(appUser.id, 'skill_selected', { groupId, microSkillId, reason });

    const library = await getSkillLibrary();
    const skillGroup = library.skill_groups.find(g => g.id === groupId);
    const ms = skillGroup?.skills.flatMap(s => s.micro_skills).find(m => m.id === microSkillId);

    if (!ms) {
      console.error("MicroSkill not found:", microSkillId);
      return;
    }

    setActiveMicroSkill(ms as MicroSkill);

    const feedback: FeedbackAnalysis = JSON.parse(currentPracticeSession.feedback!);
    const snapshotData = await generateSkillSnapshot(ms.label, feedback.summary.overall_summary || "None", appUser.growth_memory || "None", selectedScenario.id, microSkillId);
    setSnapshot(snapshotData);

    setActivePracticeAttempt({
      userId: appUser.id,
      parentSessionId: currentPracticeSession.id,
      scenarioId: selectedScenario.id, // Anchor to scenario
      skillId: groupId,
      microSkillId,
      selectionReason: reason,
      snapshotContent: JSON.stringify(snapshotData),
      timestamp: new Date().toISOString()
    });

    setPracticeType('tutorial');
    setActivePage('snapshot');
    logEvent(appUser.id, 'snapshot_delivered', { microSkillId });
  };

  const handlePracticeLoopStart = (medium: InteractionMedium) => {
    setInteractionMedium(medium);
    setActivePage('roleplay');
    logEvent(appUser?.id!, 'practice_loop_started', { microSkillId: activeMicroSkill?.id, interactionMedium: medium });
  };

  const handleSessionEnd = async (completedSession: PracticeSession, isDiagnostic = true, isCompleted = false) => {
    try {
      // For tutorial sessions, skip creating a new PracticeSession record.
      // Tutorial data is persisted via PracticeAttempt instead.
      // Creating a PracticeSession here would produce a "ghost" scenario entry
      // in history that has no micro-skills and breaks resumption.
      if (activeMicroSkill && activePracticeAttempt) {
        const attemptPayload: Partial<PracticeAttempt> = {
          ...activePracticeAttempt,
          transcript: completedSession.transcript,
          interactionMedium: completedSession.interactionMedium,
          conversationModel: completedSession.conversationModel,
          analysisModel: completedSession.analysisModel
        };

        if (isCompleted) {
          attemptPayload.completedAt = new Date().toISOString();
        }

        const savedAttempt = await savePracticeAttempt(attemptPayload);
        setPracticeAttempts(prev => [savedAttempt, ...prev.filter(a => a.id !== savedAttempt.id)]);

        setIsLoadingData(true);
        const reflectionAnalysis = await analyzePracticeReflection(savedAttempt, activeMicroSkill.label);
        const finalAttempt = await savePracticeAttempt({
          ...savedAttempt,
          reflection: reflectionAnalysis
        });
        setActivePracticeAttempt(finalAttempt);
        setPracticeAttempts(prev => [finalAttempt, ...prev.filter(a => a.id !== finalAttempt.id)]);
        setActivePage('reflection');
        setIsLoadingData(false);
        logEvent(appUser!.id, 'practice_completed', { attemptId: finalAttempt.id, reflection: reflectionAnalysis, isCompleted });
        return;
      }

      // Diagnostic scenario flow: save the PracticeSession record normally
      const savedSession = await savePracticeSession(completedSession);
      setPracticeSessions(prev => [savedSession, ...prev]);
      setCurrentPracticeSession(savedSession);

      if (completedSession.feedback && appUser) {
        try {
          const feedbackData: FeedbackAnalysis = JSON.parse(completedSession.feedback);
          const updatedUser = await updateUserMemory(appUser.id, feedbackData, completedSession.scenarioId);
          if (updatedUser) setAppUser(updatedUser);
        } catch (e) { }
      }

    } catch (error) {
      console.error("Error saving session:", error);
    }

    if (isDiagnostic) {
      setFeedbackInitialView('feedback'); // Always show Rubric after a fresh scenario
      setActivePage('feedback');
    } else {
      setActivePage('dashboard');
    }
  };

  const handleRetryAssessment = async (session: PracticeSession) => {
    // Clear old feedback immediately so UI shows loader
    const loadingSession = { ...session, feedback: null };
    setCurrentPracticeSession(loadingSession);
    setIsLoadingData(true);
    try {
      // Guard: Check if there's enough transcript to analyze
      if (!session.transcript || session.transcript.length < 2) {
        throw new Error("This session doesn't have enough conversation data to analyze. The voice connection may have dropped before a meaningful exchange could take place. Please try running a new scenario.");
      }

      const scenario = scenarios.find(s => s.id === session.scenarioId);
      if (!scenario) throw new Error("Scenario not found. Please return to the dashboard and try again.");

      const targetSkill = skills.find(s => s.id === scenario.skillId);
      const response = await getFeedbackForTranscript(scenario, session.transcript, targetSkill?.name || 'Leadership', 'English');

      const updatedSession: PracticeSession = {
        ...session,
        feedback: response.text?.replace(/```json/gi, '').replace(/```/g, '').trim(),
        suggestedFocusOptions: null, // Clear old suggestions so they re-generate correctly
        status: 'completed'
      };

      const savedSession = await savePracticeSession(updatedSession);
      setCurrentPracticeSession(savedSession);
      setPracticeSessions(prev => prev.map(s => s.id === savedSession.id ? savedSession : s));

      if (appUser) {
        try {
          const feedbackData: FeedbackAnalysis = JSON.parse(savedSession.feedback!);
          const updatedUser = await updateUserMemory(appUser.id, feedbackData, savedSession.scenarioId);
          if (updatedUser) setAppUser(updatedUser);
        } catch (e) { }
      }
    } catch (error: any) {
      console.error("Retry assessment failed:", error);
      // Put back the original session so they can retry again
      setCurrentPracticeSession(session);
      // Show user-friendly message
      const userMsg = error.message?.includes('expected pattern')
        ? "The AI couldn't generate a structured assessment from this transcript. The conversation may have been too short. Try running a new scenario with a longer interaction."
        : (error.message || "Unknown error. Please try again.");
      alert(userMsg);
    } finally {
      setIsLoadingData(false);
    }
  };

  const renderLoader = (text: string) => (
    <div className="flex-grow flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-medium text-gray-500 animate-pulse">{text}</p>
    </div>
  );

  const renderContent = () => {
    if (isAuthLoading) return renderLoader("Authenticating...");
    if (!firebaseUser) return <LoginPage />;
    if (freemiumEnabled && !firebaseUser.emailVerified) return <VerifyEmailPage user={firebaseUser} onLogout={handleLogout} />;
    if (isLoadingData && !appUser) return renderLoader("Loading Labs...");
    if (dataLoadError) return <div className="p-12 text-center text-rose-500 font-bold">{dataLoadError}</div>;
    if (!appUser || appUser.id !== firebaseUser.uid || (freemiumEnabled && !access)) return renderLoader("Finalising...");

    switch (activePage) {
      case 'dashboard':
        return <DashboardPage
          currentUser={appUser} access={access} scenarios={scenarios} skills={skills}
          practiceSessions={practiceSessions}
          practiceAttempts={practiceAttempts}
          appLibrary={appLibrary}
          onStartPractice={handleStartPractice}
          onSaveScenario={saveScenario} onDeleteScenario={deleteScenario}
          onUserUpdate={loadAppData}
          onViewHistory={() => setActivePage('history')}
          onViewSessionFeedback={(s, initialView = 'feedback') => {
            const scenario = scenarios.find(sc => sc.id === s.scenarioId);
            setSelectedScenario(scenario || null);
            setCurrentPracticeSession(s);
            setFeedbackInitialView(initialView);
            setActivePage('feedback');
          }}
        />;
      case 'assessment-launch':
        return selectedScenario ? <AssessmentLaunchPage
          scenario={selectedScenario}
          onSelectMedium={handleAssessmentMediumSelect}
          onBack={() => setActivePage('dashboard')}
        /> : null;
      case 'roleplay':
        return selectedScenario && interactionMedium ? <RoleplayPage
          scenario={selectedScenario} skills={skills} currentUser={appUser}
          onSessionEnd={handleSessionEnd}
          onBackToDashboard={() => setActivePage('dashboard')}
          practiceMode={activeMicroSkill ? { microSkill: activeMicroSkill, cuePrompt: activeMicroSkill.cue || '', snapshot: snapshot || undefined } : undefined}
          mode={practiceType}
          interactionMedium={interactionMedium}
        /> : null;
      case 'feedback':
        if (!currentPracticeSession) {
          console.warn("Missing session for feedback page, redirecting to dashboard");
          setTimeout(() => setActivePage('dashboard'), 0);
          return renderLoader("Finalizing...");
        }
        // Try to find the scenario; it's OK if missing — FeedbackPage can function without it
        const feedbackScenario = selectedScenario || scenarios.find(sc => sc.id === currentPracticeSession.scenarioId) || null;
        return <FeedbackPage
          practiceSession={currentPracticeSession} scenario={feedbackScenario!}
          skills={skills} practiceAttempts={practiceAttempts}
          onBackToDashboard={() => setActivePage('dashboard')}
          onViewHistory={() => setActivePage('history')}
          onBeginPracticeLoop={handleBeginPracticeLoop}
          allowMoreRecommendations={!freemiumEnabled || !!access?.fullAccess}
          initialView={feedbackInitialView}
          onSessionUpdate={(updatedSession) => {
            setCurrentPracticeSession(updatedSession);
            setPracticeSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
          }}
          onRetryAssessment={() => handleRetryAssessment(currentPracticeSession)}
        />;
      case 'snapshot':
        return (activeMicroSkill && snapshot) ? <SkillSnapshotView
          microSkill={activeMicroSkill}
          snapshot={snapshot}
          reason={activePracticeAttempt?.selectionReason || ""}
          onStartPractice={handlePracticeLoopStart}
          onPause={() => setActivePage('dashboard')}
        /> : null;
      case 'reflection':
        return activePracticeAttempt?.reflection ? <ReflectionView
          analysis={activePracticeAttempt.reflection}
          onNextStep={(choice) => {
            logEvent(appUser.id, 'next_step_chosen', { choice });
            if (choice === 'repeat') {
              setActivePage('snapshot');
            } else if (choice === 'new_scenario') {
              setActivePage('dashboard');
            } else {
              // 'different_micro' or 'different_skill': go directly to micro-skill chooser
              // instead of via dashboard (avoids ghost sessions intercepting navigation)
              setFeedbackInitialView('choose_focus');
              setActivePage('feedback');
            }
          }}
        /> : null;
      case 'history':
        return <HistoryPage
          practiceSessions={practiceSessions} scenarios={scenarios} skills={skills}
          practiceAttempts={practiceAttempts}
          appLibrary={appLibrary}
          currentUser={appUser}
          onDeleteItem={async (id) => { await deletePracticeSession(id); setPracticeSessions(prev => prev.filter(ps => ps.id !== id)); }}
        />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900 font-sans mx-auto w-full overflow-x-hidden">
      {firebaseUser && appUser && (
        <header className="app-shell-header sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-gray-200 h-16 flex items-center w-full">
          <div className="max-w-7xl mx-auto w-full px-4 flex justify-between items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActivePage('dashboard')}>
              <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600 flex items-center justify-center">
                <NetworkIcon className="w-5 h-5" />
              </div>
              <h1 className="text-sm font-bold tracking-tight uppercase">Skill Builder</h1>
            </div>
            <nav className="flex items-center gap-6">
              <button onClick={() => setActivePage('dashboard')} className={`text-xs font-black uppercase tracking-widest ${activePage === 'dashboard' ? 'text-black' : 'text-gray-400'}`}>Practice</button>
              <button onClick={() => setActivePage('history')} className={`text-xs font-black uppercase tracking-widest ${activePage === 'history' ? 'text-black' : 'text-gray-400'}`}>History</button>
              <button onClick={() => setShowAppFeedback(true)} className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black">Feedback</button>
              <button onClick={handleLogout} className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-black">Sign out</button>
            </nav>
          </div>
        </header>
      )}
      {stagingEnabled && <div className="bg-amber-100 text-amber-950 text-center p-3 text-sm">Skill Builder staging. Separate test accounts and data.</div>}
      {freemiumEnabled && firebaseUser && appUser && access && activePage === 'dashboard' && <AccessPanel access={access} email={appUser.email} scenarioTitle={scenarios.find(s => s.id === access.freeScenarioId)?.title} />}
      {accessError && <div role="alert" className="p-5 text-center bg-amber-50">{accessError} <button onClick={() => setAccessError(null)} className="underline">Dismiss</button></div>}
      {confirmScenario && <div role="dialog" aria-modal="true" aria-labelledby="scenario-choice-title" className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-8 max-w-lg space-y-5 max-h-[85dvh] overflow-y-auto"><h2 id="scenario-choice-title" className="text-2xl font-bold">Choose {confirmScenario.title}?</h2><p>This will be your permanent free scenario. You can repeat its assessment and practise up to five micro skills recommended from your evaluation. Other scenarios require full access. You can keep browsing before making your choice.</p><details className="border rounded-xl p-3"><summary className="cursor-pointer font-semibold">Read the scenario</summary><p className="text-sm whitespace-pre-wrap mt-3">{confirmScenario.description}</p></details>{accessError && <p role="alert" className="text-rose-700 text-sm">{accessError}</p>}<button disabled={choosingScenario} className="bg-indigo-600 text-white p-3 rounded-xl disabled:opacity-50" onClick={async () => { const scenario = confirmScenario; setChoosingScenario(true); try { const updated = await chooseFreeScenario(scenario.id); setAccess(updated); setConfirmScenario(null); setSelectedScenario(scenario); setCurrentPracticeSession(null); setActiveMicroSkill(null); setPracticeType('diagnostic'); setInteractionMedium(null); setActivePage('assessment-launch'); } catch(e: any) { setAccessError(e.message); } finally { setChoosingScenario(false); } }}>{choosingScenario ? 'Saving…' : 'Confirm my free scenario'}</button> <button disabled={choosingScenario} onClick={() => setConfirmScenario(null)} className="p-3 underline">Keep browsing</button></div></div>}
      <main className="flex-grow w-full flex flex-col">{renderContent()}</main>
      {appUser && (
        <AppFeedbackModal 
          isOpen={showAppFeedback} 
          onClose={() => setShowAppFeedback(false)} 
          userId={appUser.id} 
          userEmail={appUser.email} 
        />
      )}
    </div>
  );
};

export default App;
