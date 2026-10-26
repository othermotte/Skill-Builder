
import React, { useState, useEffect, useMemo } from 'react';
import { User, Role, Scenario, Skill, PracticeSession, PracticeAttempt, SkillLibrary } from '../types';
import type { AccessAccount } from '../services/access';
import { ScenarioCard } from './ScenarioCard';
import { PrivacyModal, ContactModal } from './LegalModals';
import { LabGuide } from './LabGuide';
import { getAllUsers, getAllPracticeSessions, saveAppFeedback, patchOldAttempts } from '../services/firebase';
import { freemiumEnabled } from '../firebaseConfig';
import { INITIAL_SKILLS } from '../constants';
import { AdminAnalytics } from './AdminAnalytics';
import { AppFeedbackForm } from './AppFeedbackForm';

interface DashboardPageProps {
  currentUser: User;
  access?: AccessAccount | null;
  scenarios: Scenario[];
  skills: Skill[];
  practiceSessions: PracticeSession[];
  practiceAttempts: PracticeAttempt[];
  appLibrary: SkillLibrary | null;
  onStartPractice: (scenario: Scenario) => void;
  onSaveScenario: (scenario: Partial<Scenario>) => void;
  onDeleteScenario: (scenarioId: string) => void;
  onUserUpdate: () => void;
  onViewHistory: () => void;
  onViewSessionFeedback: (session: PracticeSession, initialView?: 'feedback' | 'choose_focus') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentUser, access, scenarios, skills, practiceSessions, practiceAttempts, appLibrary,
  onStartPractice,
  onUserUpdate,
  onViewHistory,
  onViewSessionFeedback
}) => {
  const isFree = freemiumEnabled && !!access && !access.fullAccess;
  const orderedScenarios = [...scenarios].sort((a, b) => Number(b.id === access?.freeScenarioId) - Number(a.id === access?.freeScenarioId));
  const [adminView, setAdminView] = useState<'admin' | 'practice'>('practice');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allSessions, setAllSessions] = useState<PracticeSession[]>([]);

  useEffect(() => {
    if (currentUser.role === Role.ADMIN && adminView === 'admin') {
      Promise.all([getAllUsers(), getAllPracticeSessions()]).then(([u, s]) => {
        setAllUsers(u);
        setAllSessions(s);
      });
    }
  }, [currentUser, adminView]);

  const latestSession = useMemo(() => {
    return practiceSessions.length > 0
      ? [...practiceSessions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
      : null;
  }, [practiceSessions]);

  const scenarioDepthMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    practiceAttempts.forEach(attempt => {
      if (attempt.completedAt) {
        if (!map[attempt.scenarioId]) {
          map[attempt.scenarioId] = new Set();
        }
        map[attempt.scenarioId].add(attempt.microSkillId);
      }
    });

    const countMap: Record<string, number> = {};
    for (const [scenarioId, skillsSet] of Object.entries(map)) {
      countMap[scenarioId] = skillsSet.size;
    }
    return countMap;
  }, [practiceAttempts]);


  const renderActivePath = () => {
    if (!latestSession || (isFree && !practiceSessions.some(s => s.scenarioId === access?.freeScenarioId))) {
      return (
        <div className="bg-indigo-600 text-white rounded-[3rem] p-10 shadow-2xl space-y-6 relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl transition-transform group-hover:scale-125"></div>
          <div className="space-y-2 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Personalization Phase</span>
            <h3 className="text-3xl font-black tracking-tighter leading-none">Establish Your Baseline</h3>
            <p className="text-white/70 text-sm font-medium max-w-sm">
              To personalize your journey, we need behavioral evidence. Start your first assessment lab to reveal your judgment patterns.
            </p>
          </div>
          <button
            onClick={() => isFree && access?.freeScenarioId ? onStartPractice(scenarios.find(s => s.id === access.freeScenarioId)!) : freemiumEnabled ? document.getElementById('scenario-catalogue')?.scrollIntoView({ behavior: 'smooth' }) : onStartPractice(scenarios[0])}
            className="relative z-10 bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-gray-50 transition-all active:scale-[0.98]"
          >
            {isFree && access?.freeScenarioId ? 'Open your free scenario' : freemiumEnabled ? 'Choose your scenario' : 'Start First Lab'}
          </button>
        </div>
      );
    }

    const activeSessions: typeof practiceSessions = [];
    const seenScenarios = new Set<string>();

    // Sort newest first, then prefer sessions with valid (non-error) feedback
    const sorted = [...practiceSessions].sort((a, b) => {
      // First: prefer sessions with valid feedback over error/missing feedback
      const aIsError = !a.feedback || a.feedback.includes('"error"');
      const bIsError = !b.feedback || b.feedback.includes('"error"');
      if (aIsError !== bIsError) return aIsError ? 1 : -1;
      // Then: newest first
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    for (const session of sorted) {
      if (isFree && session.scenarioId !== access?.freeScenarioId) continue;
      if (!seenScenarios.has(session.scenarioId)) {
        seenScenarios.add(session.scenarioId);
        activeSessions.push(session);
      }
    }

    return (
      <div className="space-y-6">
        {activeSessions.map(session => {
          const sessionScenario = scenarios.find(s => s.id === session.scenarioId);
          if (!sessionScenario) return null;

          return (
            <div
              key={session.id}
              onClick={() => {
                if (session.status === 'completed') {
                  // Check if assessment is valid before allowing practice
                  let isValidAssessment = false;
                  try {
                    const fb = session.feedback ? JSON.parse(session.feedback) : null;
                    isValidAssessment = fb?.validity?.is_valid === true;
                  } catch (e) { }
                  onViewSessionFeedback(session, isValidAssessment ? 'choose_focus' : 'feedback');
                } else {
                  onStartPractice(sessionScenario);
                }
              }}
              role="button"
              tabIndex={0}
              className="block w-full text-left bg-white border border-gray-100 rounded-[3rem] p-10 shadow-sm space-y-8 cursor-pointer hover:border-black hover:shadow-md transition-all group outline-none focus:ring-4 focus:ring-indigo-500/20"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">In Progress Scenario</span>
                  <h3 className="text-2xl font-black tracking-tight text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {session.status === 'completed'
                      ? (() => { try { const fb = JSON.parse(session.feedback || '{}'); return fb?.validity?.is_valid ? 'Continue practising' : 'View Assessment'; } catch { return 'View Assessment'; } })()
                      : 'Resume Assessment'}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:scale-110 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>

              <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Target Scenario</p>
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="font-bold text-gray-900">{sessionScenario.title}</p>
                    <p className="text-xs text-gray-500 mt-1">Last activity: {new Date(session.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200/50 space-y-1">
                  <p className="text-xs text-gray-600 font-medium leading-relaxed">
                    You’ve practised <span className="font-black text-gray-900">{scenarioDepthMap[sessionScenario.id] || 0} micro-skills</span> in this scenario.
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
                    We recommend around <span className="text-gray-600">12 micro-skill practices</span> before re-running a scenario.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 bg-black text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-center group-hover:bg-gray-800 transition-all shadow-xl">
                  {session.status === 'completed' ? 'Choose a micro-skill to practise' : 'Resume Lab'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const practiceView = (
    <div className="space-y-16 pb-20 max-w-5xl mx-auto">
      {showGuide && <LabGuide onClose={() => setShowGuide(false)} />}

      {/* 1. Orientation Header */}
      <section className="animate-in fade-in slide-in-from-top-4 duration-700 px-4 mt-8 flex flex-col md:flex-row justify-between items-end gap-8">
        <div className="space-y-4">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-gray-900 leading-[0.85]">
            Welcome back, <br />
            <span className="text-gray-400 font-medium">practitioner.</span>
          </h2>
          <p className="text-gray-500 text-lg font-medium max-w-md leading-tight">
            Run a scenario. Practise the micro-skills it exposes.
          </p>
        </div>
        <button
          onClick={() => setShowGuide(true)}
          className="px-6 py-3 rounded-2xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black hover:border-black transition-all"
        >
          How it Works
        </button>
      </section>

      {/* 2. Your Current Path */}
      <section className="px-4">
        {renderActivePath()}
      </section>

      {/* 3. SCENARIO LABS */}
      <section id="scenario-catalogue" className="space-y-12 px-4">
        <div className="space-y-2">
          <h3 className="text-2xl font-black tracking-tight text-gray-900 uppercase">SCENARIO LABS</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{isFree ? access?.freeScenarioId ? "Your chosen scenario is shown first. You can repeat its assessment and practise your five personalised micro skills. Other scenarios require full access." : "Your free account includes one scenario of your choice and five micro skills recommended from its assessment. Browse the scenarios, then confirm the one you want to keep. This choice is permanent." : "Explore the scenarios to reveal your thinking patterns."}</p>
        </div>
        <div className="grid grid-cols-1 gap-8">
          {orderedScenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              locked={isFree && !!access?.freeScenarioId && access.freeScenarioId !== scenario.id}
              freeChoice={isFree && access?.freeScenarioId === scenario.id}
              choosingFree={isFree && !access?.freeScenarioId}
              depth={scenarioDepthMap[scenario.id] || 0}
              onSelect={() => onStartPractice(scenario)}
            />
          ))}
        </div>
      </section>

      {/* 4. History Snippet */}
      {practiceSessions.length > 1 && (
        <section className="px-4 border-t border-gray-100 pt-16">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-black text-gray-900 uppercase">Growth History</h3>
            <button onClick={onViewHistory} className="text-[10px] font-black uppercase tracking-widest text-indigo-500">View All</button>
          </div>
          <div className="space-y-4">
            {practiceSessions.slice(0, 3).map(session => {
              const sessionAttempts = practiceAttempts.filter(a => a.parentSessionId === session.id);
              return (
                <div key={session.id} className="flex flex-col p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700 truncate mr-4">
                      {scenarios.find(s => s.id === session.scenarioId)?.title}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono shrink-0">{new Date(session.timestamp).toLocaleDateString()}</span>
                  </div>
                  {sessionAttempts.length > 0 && (() => {
                    const uniqueAttemptsMap = new Map<string, PracticeAttempt & { isCompleted: boolean }>();
                    sessionAttempts.forEach(a => {
                      const existing = uniqueAttemptsMap.get(a.microSkillId);
                      const isCompleted = !!a.completedAt;
                      if (!existing || (!existing.isCompleted && isCompleted)) {
                        uniqueAttemptsMap.set(a.microSkillId, { ...a, isCompleted });
                      }
                    });
                    const uniqueAttempts = Array.from(uniqueAttemptsMap.values());

                    return (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {uniqueAttempts.map(a => (
                          <span key={a.id} className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${a.isCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-gray-500 border-gray-200'}`}>
                            {a.isCompleted ? '✓ ' : ''}{(appLibrary?.skill_groups.flatMap(g => g.skills).flatMap(s => s.micro_skills).find(m => m.id === a.microSkillId)?.label) || 'Micro-skill'}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 5. Feedback CTA */}
      <section className="pt-12 border-t border-gray-100 text-center px-4">
        {!showFeedbackForm ? (
          <button
            onClick={() => setShowFeedbackForm(true)}
            className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            How can we make Skill Builder better? Leave feedback.
          </button>
        ) : (
          <div className="max-w-md mx-auto p-1 text-left animate-in fade-in zoom-in-95 duration-300">
            <AppFeedbackForm 
                userId={currentUser.id} 
                userEmail={currentUser.email} 
                onSuccess={() => setShowFeedbackForm(false)}
                onCancel={() => setShowFeedbackForm(false)}
            />
          </div>
        )}
      </section>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 w-full flex-grow flex flex-col">
      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />

      {currentUser?.role === Role.ADMIN ? (
        <>
          <div className="mb-12 flex items-center justify-between px-4">
            <nav className="flex space-x-1 bg-gray-100 p-1 rounded-xl inline-flex border border-gray-200">
              <button onClick={() => setAdminView('admin')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${adminView === 'admin' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Admin Panel</button>
              <button onClick={() => setAdminView('practice')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${adminView === 'practice' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Practice View</button>
            </nav>
          </div>

          {adminView === 'admin' ? (
            <div className="space-y-12 pb-24">
              <AdminAnalytics
                users={allUsers}
                sessions={allSessions}
                scenarios={scenarios}
                skills={INITIAL_SKILLS}
                onRefresh={onUserUpdate}
              />
            </div>
          ) : (
            practiceView
          )}
        </>
      ) : (
        practiceView
      )}

      <footer className="mt-auto py-12 border-t border-gray-100 flex justify-center flex-wrap gap-x-6 gap-y-3 text-xs text-gray-400 font-medium">
        <button onClick={() => setShowPrivacy(true)} className="hover:text-gray-900 transition-colors">Privacy Statement</button>
        <button onClick={() => setShowContact(true)} className="hover:text-gray-900 transition-colors">Contact</button>
      </footer>
    </div>
  );
};
