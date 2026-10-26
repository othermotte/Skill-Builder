import { freemiumEnabled, stagingEnabled } from '../firebaseConfig';
import { chooseHomepageVariant, homepageCopy } from '../utils/homepageExperiment';
import React, { useState } from 'react';
import { GoogleIcon } from './icons/GoogleIcon';
import { loginWithEmail, signupWithEmail, loginWithGoogle, sendPasswordReset } from '../services/firebase';
import { NetworkIcon } from './icons/NetworkIcon';
import { PrivacyModal, ContactModal } from './LegalModals';
import { LabGuide } from './LabGuide';

const VoiceWaveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
);

const DnaIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H5.625c-.621 0-1.125.504-1.125 1.125v1.75c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-1.75c0-.621-.504-1.125-1.125-1.125Z" />
    </svg>
);

const NudgeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
);

const ChartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
);

export const LoginPage: React.FC = () => {
    const [variant] = useState(() => {
        let saved: string | null = null;
        try { saved = sessionStorage.getItem('homepageVariant'); } catch {}
        const choice = chooseHomepageVariant(location.search, saved, Math.random());
        try { sessionStorage.setItem('homepageVariant', choice); const code = new URLSearchParams(location.search).get('organisationCode'); if (code) sessionStorage.setItem('organisationCode', code); } catch {}
        return choice;
    });
    const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState('');
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [showContact, setShowContact] = useState(false);
    const [showLabGuide, setShowLabGuide] = useState(false);

    const handleGoogleButtonClick = async () => {
        setAuthError('');
        try {
            await loginWithGoogle();
        } catch (error: any) {
            setAuthError(error.message || "An error occurred during Google Sign-In.");
        }
    };

    const renderAuthForm = () => {
        switch (authMode) {
            case 'signup':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="mb-8">
                            <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tighter">Create Your Account</h2>
                            <p className="text-gray-500 text-sm font-medium">Join our leadership practice community.</p>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); signupWithEmail(email, password).catch(err => setAuthError(err.message)); }} className="space-y-4">
                            <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-white rounded-2xl border border-gray-200 text-base focus:ring-4 focus:ring-black/5 focus:border-black transition-all outline-none" required />
                            <input type="password" placeholder="Create Password" onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-white rounded-2xl border border-gray-200 text-base focus:ring-4 focus:ring-black/5 focus:border-black transition-all outline-none" required />
                            {authError && <div className="text-rose-600 text-xs font-bold bg-rose-50 p-3 rounded-xl border border-rose-100">{authError}</div>}
                            <button type="submit" className="w-full bg-black text-white font-black py-4 px-4 rounded-2xl shadow-xl hover:bg-gray-800 transition-all active:scale-[0.98] uppercase tracking-widest text-xs">Start My Profile</button>
                        </form>
                        <p className="text-center text-gray-400 mt-8 text-sm font-medium">Already registered? <button onClick={() => setAuthMode('login')} className="font-black text-black hover:underline">Sign In</button></p>
                    </div>
                );
            case 'reset':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="mb-8">
                            <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tighter">Reset Your Password</h2>
                            <p className="text-gray-500 text-sm font-medium">We'll send a secure link to your email.</p>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); sendPasswordReset(email).then(() => setSuccessMessage("Check your inbox")).catch(err => setAuthError(err.message)); }} className="space-y-4">
                            <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-white rounded-2xl border border-gray-200 text-base focus:ring-4 focus:ring-black/5 focus:border-black transition-all outline-none" required />
                            {authError && <div className="text-rose-600 text-xs font-bold bg-rose-50 p-3 rounded-xl border border-rose-100">{authError}</div>}
                            <button type="submit" className="w-full bg-black text-white font-black py-4 px-4 rounded-2xl shadow-xl hover:bg-gray-800 transition-all active:scale-[0.98] uppercase tracking-widest text-xs">Send Reset Link</button>
                        </form>
                        <p className="text-center text-gray-400 mt-8 text-sm font-medium"><button onClick={() => setAuthMode('login')} className="font-black text-black hover:underline">Return to Sign In</button></p>
                    </div>
                );
            default:
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="mb-8">
                            <h2 className="text-4xl font-black text-gray-900 mb-2 tracking-tighter uppercase">Welcome Back</h2>
                            <p className="text-gray-500 text-sm font-medium">Sign in to continue your progress.</p>
                        </div>
                        {successMessage && <p className="text-emerald-600 text-center mb-6 text-sm bg-emerald-50 p-3 rounded-xl border border-emerald-100 font-bold">{successMessage}</p>}
                        {authError && <div className="text-rose-600 text-xs font-bold bg-rose-50 p-3 rounded-xl border border-rose-100 mb-6">{authError}</div>}
                        <form onSubmit={(e) => { e.preventDefault(); loginWithEmail(email, password).catch(err => setAuthError(err.message)); }} className="space-y-4">
                            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-white rounded-2xl border border-gray-200 text-base focus:ring-4 focus:ring-black/5 focus:border-black transition-all outline-none font-medium" required />
                            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-white rounded-2xl border border-gray-200 text-base focus:ring-4 focus:ring-black/5 focus:border-black transition-all outline-none font-medium" required />
                            <div className="flex justify-end"><button type="button" onClick={() => setAuthMode('reset')} className="text-[10px] font-black text-gray-400 hover:text-black uppercase tracking-widest">Forgot password?</button></div>
                            <button type="submit" className="w-full bg-black text-white font-black py-4 px-4 rounded-2xl shadow-xl hover:bg-gray-800 transition-all active:scale-[0.98] uppercase tracking-widest text-xs">Log In</button>
                        </form>
                        {!stagingEnabled && (<div className="my-10 flex items-center"><div className="flex-grow border-t border-gray-100"></div><span className="mx-4 text-gray-300 text-[10px] font-black uppercase tracking-[0.3em]">OR</span><div className="flex-grow border-t border-gray-100"></div></div>)}
                        {!stagingEnabled && (<button onClick={handleGoogleButtonClick} className="w-full flex items-center justify-center gap-4 bg-white text-gray-900 font-black py-4 px-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all shadow-sm active:scale-[0.98] uppercase tracking-widest text-xs"><GoogleIcon className="w-4 h-4 shrink-0" />Log In With Google</button>)}
                        <p className="text-center text-gray-400 mt-10 text-sm font-medium">New here? <button onClick={() => setAuthMode('signup')} className="font-black text-black hover:underline">Sign Up</button></p>
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col lg:flex-row min-h-screen w-full bg-white overflow-x-hidden">
            <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
            <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
            {showLabGuide && <LabGuide onClose={() => setShowLabGuide(false)} />}

            {/* Brand Side */}
            <div className="w-full lg:flex-1 bg-white flex flex-col justify-center px-8 py-16 lg:px-24 relative overflow-y-auto">
                <div className="max-w-xl mx-auto lg:mx-0 w-full space-y-12 relative z-10 pt-10 pb-20">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                            PRACTICE-FIRST METHODOLOGY
                        </div>
                        <h2 className="text-6xl lg:text-7xl font-black tracking-tighter leading-[0.9]">
                            <div className="text-gray-900">Leadership</div>
                            <div className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mt-2">Skill Builder.</div>
                        </h2>
                        <p className="text-2xl font-bold text-gray-500 leading-tight max-w-md">
                            {freemiumEnabled ? homepageCopy[variant].heading : 'Master the high-stakes conversations that define great leaders.'}
                        </p>

                        <p className="text-lg font-black text-gray-900 pt-4">
                            {freemiumEnabled ? homepageCopy[variant].detail : 'Every conversation informs the next conversation.'}
                        </p>

                        <div className="pt-2">
                            <button
                                onClick={() => setShowLabGuide(true)}
                                className="inline-flex items-center gap-2 bg-indigo-50 text-blue-700 font-black py-3 px-6 rounded-full hover:bg-indigo-100 transition-colors uppercase tracking-widest text-xs"
                            >
                                See How It Works
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
                        <div className="p-6 bg-white rounded-[2rem] border border-gray-200 shadow-sm space-y-4 group hover:border-black transition-all duration-500 text-left">
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-black group-hover:bg-black group-hover:text-white transition-colors">
                                <VoiceWaveIcon />
                            </div>
                            <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight">1. Experience (Realistic Scenarios)</h4>
                            <p className="text-gray-500 text-xs font-medium leading-relaxed">
                                Step into a realistic leadership scenario and respond as you would in real life.
                            </p>
                        </div>

                        <div className="p-6 bg-white rounded-[2rem] border border-gray-200 shadow-sm space-y-4 group hover:border-black transition-all duration-500 text-left">
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-black group-hover:bg-black group-hover:text-white transition-colors">
                                <DnaIcon />
                            </div>
                            <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight">2. Feedback (Clear & Written)</h4>
                            <p className="text-gray-500 text-xs font-medium leading-relaxed">
                                System analyses responses and provides clear, written feedback on 5 essential capabilities.
                            </p>
                        </div>

                        <div className="p-6 bg-white rounded-[2rem] border border-gray-200 shadow-sm space-y-4 group hover:border-black transition-all duration-500 text-left">
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-black group-hover:bg-black group-hover:text-white transition-colors">
                                <NudgeIcon />
                            </div>
                            <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight">3. Focused Practice (One Micro-Skill)</h4>
                            <p className="text-gray-500 text-xs font-medium leading-relaxed">
                                Receive a short, targeted explanation of one specific micro-skill, tailored to how you responded. Practice it immediately, paving the way to tackle more micro-skills based on your growing adaptive history.
                            </p>
                        </div>

                        <div className="p-6 bg-white rounded-[2rem] border border-gray-200 shadow-sm space-y-4 group hover:border-black transition-all duration-500 text-left">
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-black group-hover:bg-black group-hover:text-white transition-colors">
                                <ChartIcon />
                            </div>
                            <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight">4. Reflection (Steady Progress)</h4>
                            <p className="text-gray-500 text-xs font-medium leading-relaxed">
                                Revisit past feedback and observe steady, visible progress over time.
                            </p>
                        </div>
                    </div>


                </div>
            </div>

            {/* Auth Side */}
            <div className="w-full lg:flex-1 bg-white flex flex-col items-center justify-center px-6 py-12 lg:py-0 border-l border-gray-100">
                <div className="max-w-md w-full flex flex-col h-full justify-center">
                    <div className="flex-grow flex flex-col justify-center">
                        <div className="mb-12 flex justify-center lg:justify-start">
                            <div className="flex items-center gap-3 text-blue-600">
                                <NetworkIcon className="w-8 h-8" />
                                <h1 className="text-[11px] font-black tracking-[0.25em] uppercase text-gray-900 mt-1">Access Portal</h1>
                            </div>
                        </div>
                        {renderAuthForm()}
                        
                        <div className="mt-10 p-5 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-500 font-medium space-y-2 leading-relaxed">
                            <p>For the most reliable experience with voice interactions, we recommend using Chrome, Edge, or Safari.</p>
                            <p>If you experience issues with voice in Firefox, switching to one of the browsers above usually resolves the problem</p>
                        </div>
                    </div>

                    <div className="mt-12 pt-8 border-t border-gray-100 flex justify-center lg:justify-start gap-8 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
                        <button onClick={() => setShowPrivacy(true)} className="hover:text-black transition-colors">Security</button>
                        <button onClick={() => setShowContact(true)} className="hover:text-black transition-colors">Inquiry</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
