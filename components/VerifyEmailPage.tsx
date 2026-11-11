
import React, { useState } from 'react';
import { User as FirebaseAuthUser } from 'firebase/auth';
import { resendVerificationEmail } from '../services/firebase';
import { EnvelopeIcon } from './icons/EnvelopeIcon';
import { NetworkIcon } from './icons/NetworkIcon';
import { PrivacyModal, ContactModal } from './LegalModals';

const ProbingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-900">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
  </svg>
);

const MicroSkillIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-900">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.498-.552.775-.802.53-.478 1.135-.731 1.707-.974C17.716 3.117 18.271 3 18.75 3c.667 0 1.23.129 1.663.383.434.254.73.618.817 1.102.086.484-.01 1.055-.262 1.604-.253.548-.611 1.087-.97 1.578-.363.495-.71 1.003-.813 1.432m-5.935-5.011a6.011 6.011 0 01-1.502 1.353m1.502-1.353l-.01.01m1.501 0a6.011 6.011 0 001.503 1.353m-1.503-1.353l.01.01M12 11.25V12m0 0a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5M12 12l.01-.01M7.5 12h-.008m.008 0l-.01-.01m9.01.01h-.008m.008 0l-.01-.01" />
  </svg>
);

const JourneyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-900">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface VerifyEmailPageProps {
  user: FirebaseAuthUser;
  onLogout: () => void;
}

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ user, onLogout }) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const handleResend = async () => {
    setIsSending(true);
    setError('');
    setMessage('');
    try {
      await resendVerificationEmail();
      setMessage('Verification email sent.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full bg-white overflow-x-hidden">

      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />

      <div className="w-full lg:flex-1 min-w-0 bg-gray-50 flex flex-col justify-center px-6 py-12 lg:px-20 border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden">
        <div className="max-w-lg mx-auto lg:mx-0 w-full space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-center lg:justify-start w-12 h-12 mb-6">
              <NetworkIcon className="w-12 h-12 text-blue-600 shrink-0" />
            </div>
            <h2 className="text-4xl lg:text-6xl font-bold tracking-tighter text-gray-900 leading-none text-center lg:text-left break-words">
              Leadership <span className="text-gray-400 font-medium">SkillBuilder</span>.
            </h2>
            <p className="text-xl font-medium text-gray-500 text-center lg:text-left">Verify your account.</p>
          </div>

          <p className="text-gray-600 leading-relaxed max-w-md text-center lg:text-left mx-auto lg:mx-0">
            You're one step away from joining our practice-first community. Reveal. Practice. Build Capability.
          </p>

          <ul className="space-y-4 pt-4">
            <li className="flex gap-4 items-center">
              <div className="bg-white p-2 rounded-lg border border-gray-200 shrink-0 shadow-sm">
                <ProbingIcon />
              </div>
              <span className="text-gray-700 font-medium">Revealing Thinking Patterns</span>
            </li>
            <li className="flex gap-4 items-center">
              <div className="bg-white p-2 rounded-lg border border-gray-200 shrink-0 shadow-sm">
                <MicroSkillIcon />
              </div>
              <span className="text-gray-700 font-medium">Micro-Skill Focus</span>
            </li>
            <li className="flex gap-4 items-center">
              <div className="bg-white p-2 rounded-lg border border-gray-200 shrink-0 shadow-sm">
                <JourneyIcon />
              </div>
              <span className="text-gray-700 font-medium">Personalized Growth</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="w-full lg:flex-1 min-w-0 bg-white flex flex-col items-center justify-center lg:items-start px-4 sm:px-8 lg:px-12 py-12 overflow-hidden">
        <div className="max-w-md w-full flex flex-col h-full justify-center">
          <div className="flex-grow flex flex-col justify-center">
            <div className="text-center lg:text-left mb-8">
              <div className="mx-auto lg:mx-0 flex items-center justify-center h-12 w-12 rounded-full bg-gray-50 mb-6 border border-gray-100 text-gray-900">
                <EnvelopeIcon className="h-5 w-5 shrink-0" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight break-words">Check your inbox</h2>
              <p className="text-gray-500 mb-6 text-sm leading-relaxed break-words">
                We've sent a verification link to <br />
                <span className="font-semibold text-gray-900">{user.email}</span>
              </p>
            </div>

            {message && <p className="text-emerald-600 text-center lg:text-left mb-4 text-sm bg-emerald-50 p-2 rounded border border-emerald-100 break-words">{message}</p>}
            {error && <p className="text-rose-600 text-center lg:text-left mb-4 text-sm bg-rose-50 p-2 rounded border border-rose-100 break-words">{error}</p>}

            <div className="space-y-3">
              <button onClick={async () => { await user.reload(); if (user.emailVerified) { await user.getIdToken(true); location.reload(); } else setError('Your email has not been verified yet. Open the verification link, then try again.'); }} className="w-full bg-indigo-600 text-white p-3 rounded-xl">I have verified my email</button>
              <button
                onClick={handleResend}
                disabled={isSending}
                className="w-full bg-gray-900 hover:bg-black text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
              >
                {isSending ? 'Sending...' : 'Resend Email'}
              </button>
              <button
                onClick={onLogout}
                className="w-full bg-white text-gray-500 hover:text-gray-900 font-medium py-3 px-4 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center gap-6 text-xs text-gray-400 font-medium">
            <button onClick={() => setShowPrivacy(true)} className="hover:text-gray-900 transition-colors">Privacy Statement</button>
            <span>•</span>
            <button onClick={() => setShowContact(true)} className="hover:text-gray-900 transition-colors">Contact</button>
          </div>
        </div>
      </div>
    </div>
  );
};
