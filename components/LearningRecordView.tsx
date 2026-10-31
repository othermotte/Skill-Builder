import React, { useMemo, useState } from 'react';
import { FeedbackAnalysis, PracticeAttempt, PracticeSession, Scenario, Skill, SkillLibrary, User } from '../types';
import { createLearningRecordPdfBlob } from '../services/learningRecordPdf';

interface LearningRecordViewProps {
  currentUser: User;
  session: PracticeSession;
  scenario: Scenario;
  skills: Skill[];
  practiceAttempts: PracticeAttempt[];
  appLibrary: SkillLibrary | null;
  onBack: () => void;
}

const formatDate = (value?: string) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const titleCase = (value?: string) => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : 'Not recorded';

export const LearningRecordView: React.FC<LearningRecordViewProps> = ({
  currentUser,
  session,
  scenario,
  skills,
  practiceAttempts,
  appLibrary,
  onBack,
}) => {
  const [isCreatingPdf, setIsCreatingPdf] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const feedback = useMemo<FeedbackAnalysis | null>(() => {
    if (!session.feedback) return null;
    try {
      const parsed = JSON.parse(session.feedback);
      return parsed?.scores && parsed?.summary ? parsed as FeedbackAnalysis : null;
    } catch {
      return null;
    }
  }, [session.feedback]);

  const completedAttempts = useMemo(() => practiceAttempts
    .filter(attempt => attempt.parentSessionId === session.id && !!attempt.completedAt)
    .sort((a, b) => new Date(a.completedAt || a.timestamp).getTime() - new Date(b.completedAt || b.timestamp).getTime()),
  [practiceAttempts, session.id]);

  const microSkillDetails = useMemo(() => {
    const lookup = new Map<string, { label: string; skill: string; group: string }>();
    appLibrary?.skill_groups.forEach(group => {
      group.skills.forEach(skill => {
        skill.micro_skills.forEach(microSkill => {
          lookup.set(microSkill.id, { label: microSkill.label, skill: skill.label, group: group.label });
        });
      });
    });
    return lookup;
  }, [appLibrary]);

  const scoreItems = useMemo(() => {
    if (!feedback?.scores) return [];
    return (Object.entries(feedback.scores) as [string, { score: number; justification: string }][]).map(([id, value]) => ({
      id,
      name: skills.find(skill => skill.id === id)?.name || id.replace(/_/g, ' '),
      score: value.score,
      justification: value.justification,
    }));
  }, [feedback, skills]);

  const validAssessment = feedback?.validity?.is_valid === true;
  const reference = `SB-${session.id.slice(-8).toUpperCase()}`;
  const pdfFilename = `skill-builder-${scenario.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '.pdf';

  const downloadPdf = async () => {
    if (isCreatingPdf) return;

    setIsCreatingPdf(true);
    setPdfMessage(null);
    const pdfWindow = window.open('', '_blank');

    try {
      if (!pdfWindow) throw new Error('The browser blocked the PDF preview window.');
      pdfWindow.document.title = 'Creating learning record PDF';
      pdfWindow.document.body.innerHTML = '<p style="font: 16px system-ui; padding: 32px; color: #374151;">Creating your learning record PDF...</p>';

      const pdfBlob = await createLearningRecordPdfBlob({
        currentUser,
        session,
        scenario,
        skills,
        completedAttempts,
        feedback,
        appLibrary,
        reference,
        filename: pdfFilename,
      });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      pdfWindow.location.replace(pdfUrl);

      setPdfMessage('PDF opened in a new tab. Use the PDF viewer to print or save it.');
    } catch (error) {
      console.error('Unable to create learning record PDF', error);
      pdfWindow?.close();
      setPdfMessage('The PDF could not be opened. Please try again or open this page in Safari or Chrome.');
    } finally {
      setIsCreatingPdf(false);
    }
  };

  return (
    <div className="learning-record-screen min-h-screen bg-gray-50 px-4 py-8 md:px-8 md:py-12">
      <div className="print-hidden mx-auto mb-6 flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 transition-colors hover:bg-white hover:text-black"
        >
          <span aria-hidden="true">←</span>
          Back to History
        </button>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={isCreatingPdf}
          className="rounded-2xl bg-black px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-colors hover:bg-indigo-600 disabled:cursor-wait disabled:bg-gray-400"
        >
          {isCreatingPdf ? 'Creating PDF…' : 'Open PDF'}
        </button>
        {pdfMessage && <p className="text-xs font-bold text-gray-500 sm:max-w-sm sm:text-right" role="status">{pdfMessage}</p>}
      </div>

      <article className="learning-record-print mx-auto w-full max-w-5xl bg-white px-6 py-8 shadow-xl md:px-12 md:py-12">
        <header className="record-header border-b-2 border-gray-900 pb-8">
          <div>
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600">Skill Builder learning record</p>
              <h1 className="text-3xl font-black tracking-tight text-gray-950 md:text-5xl">{scenario.title}</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-gray-500">
                Evidence of a formative scenario assessment and its associated micro-skill practice.
              </p>
            </div>
          </div>

          <dl className="record-meta mt-8 grid grid-cols-1 gap-4 rounded-2xl bg-gray-50 p-5 sm:grid-cols-3">
            <div>
              <dt className="text-[9px] font-black uppercase tracking-widest text-gray-400">Learner</dt>
              <dd className="mt-1 break-all text-sm font-bold text-gray-900">{currentUser.email}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase tracking-widest text-gray-400">Assessment date</dt>
              <dd className="mt-1 text-sm font-bold text-gray-900">{formatDate(session.timestamp)}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase tracking-widest text-gray-400">Record reference</dt>
              <dd className="mt-1 font-mono text-sm font-bold text-gray-900">{reference}</dd>
            </div>
          </dl>
        </header>

        <section className="record-section py-9">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Completion summary</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-950">Work completed</h2>
            </div>
            <p className="text-xs font-bold text-gray-400">Assessment and practice are shown together as a record of learning.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="print-avoid-break rounded-2xl border border-gray-200 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Scenario assessment</p>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <p className="text-xl font-black text-gray-950">{validAssessment ? 'Completed' : 'Needs more evidence'}</p>
                <span className={`h-3 w-3 rounded-full ${validAssessment ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-hidden="true" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                {validAssessment ? 'The assessment produced a valid formative rubric.' : feedback?.validity?.reason || 'A valid rubric was not available.'}
              </p>
            </div>
            <div className="print-avoid-break rounded-2xl border border-gray-200 p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Completed micro-practices</p>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <p className="text-xl font-black text-gray-950">{completedAttempts.length} completed</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                Every completed practice session is shown below, including repeated work on the same micro-skill.
              </p>
            </div>
          </div>
        </section>

        <section className="record-section border-t border-gray-200 py-9">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Formative assessment</p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-2xl font-black tracking-tight text-gray-950">Rubric feedback</h2>
              {feedback && (
                <div className="flex gap-6">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total</p>
                    <p className="text-xl font-black text-gray-950">{feedback.total_score}<span className="text-gray-300">/25</span></p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Profile</p>
                    <p className="text-xl font-black text-gray-950">{feedback.leadership_potential}</p>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 text-xs font-bold leading-relaxed text-indigo-800">
              These results are formative Skill Builder feedback. They are not an academic grade.
            </p>
          </div>

          {feedback ? (
            <>
              <div className="record-score-grid grid grid-cols-1 gap-4 md:grid-cols-2">
                {scoreItems.map(item => (
                  <div key={item.id} className="print-avoid-break rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">{item.name}</h3>
                      <p className="shrink-0 text-xl font-black text-gray-950">{item.score}<span className="text-gray-300">/5</span></p>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-gray-900" style={{ width: `${Math.max(0, Math.min(100, (item.score / 5) * 100))}%` }} />
                    </div>
                    <p className="mt-3 text-xs font-medium leading-relaxed text-gray-600">{item.justification}</p>
                  </div>
                ))}
              </div>

              <div className="print-avoid-break mt-6 rounded-2xl bg-gray-950 p-6 text-white">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Overall summary</p>
                <p className="mt-3 text-sm font-medium leading-relaxed text-gray-100">{feedback.summary.overall_summary}</p>
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Strengths</p>
                    <ul className="mt-2 space-y-1 text-xs leading-relaxed text-gray-200">
                      {feedback.summary.strengths.map((strength, index) => <li key={index}>• {strength}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-300">Areas to develop</p>
                    <ul className="mt-2 space-y-1 text-xs leading-relaxed text-gray-200">
                      {feedback.summary.areas_for_improvement.map((area, index) => <li key={index}>• {area}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-900">
              Rubric feedback is unavailable for this historical session.
            </div>
          )}
        </section>

        <section className="record-section print-page-break-before border-t border-gray-200 py-9">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Associated practice</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-950">Micro-practice feedback</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">
              Completed practice attempts linked to this scenario assessment. Conversation transcripts are intentionally excluded.
            </p>
          </div>

          {completedAttempts.length > 0 ? (
            <div className="space-y-5">
              {completedAttempts.map((attempt, index) => {
                const details = microSkillDetails.get(attempt.microSkillId);
                const reflection = attempt.reflection;
                return (
                  <article key={attempt.id} className="practice-record print-avoid-break rounded-2xl border border-gray-200 p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600">Practice {index + 1}</p>
                        <h3 className="mt-1 text-lg font-black leading-tight text-gray-950">{details?.label || 'Micro-skill practice'}</h3>
                        <p className="mt-1 text-xs font-bold text-gray-400">{details ? `${details.group} · ${details.skill}` : 'Skill details unavailable'}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-bold text-gray-700">{formatDate(attempt.completedAt || attempt.timestamp)}</p>
                        <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-400">{titleCase(attempt.interactionMedium)} conversation</p>
                      </div>
                    </div>

                    {reflection ? (
                      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-xl bg-gray-50 p-4 sm:col-span-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Outcome</p>
                          <p className={`mt-1 text-sm font-black ${reflection.detected ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {reflection.detected ? 'Micro-skill practised' : 'Keep practising'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4">
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Evidence observed</p>
                          <p className="mt-2 text-xs font-medium leading-relaxed text-gray-700">{reflection.evidence}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4">
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Observed impact</p>
                          <p className="mt-2 text-xs font-medium leading-relaxed text-gray-700">{reflection.impact}</p>
                        </div>
                        <div className="rounded-xl bg-indigo-50 p-4">
                          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Coaching tip</p>
                          <p className="mt-2 text-xs font-bold leading-relaxed text-indigo-800">{reflection.adjustment}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-5 rounded-xl bg-gray-50 p-4 text-xs font-medium text-gray-500">
                        This practice was completed, but reflection feedback is unavailable for the historical record.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm font-medium text-gray-500">
              No completed micro-practices are linked to this scenario yet.
            </div>
          )}
        </section>

        <footer className="record-footer border-t-2 border-gray-900 pt-5 text-[9px] font-bold uppercase tracking-widest text-gray-400">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>Generated by Skill Builder · Learner-controlled evidence</p>
            <p>{reference} · {currentUser.email}</p>
          </div>
        </footer>
      </article>
    </div>
  );
};
