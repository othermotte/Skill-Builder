
import React from 'react';
import { EnvelopeIcon } from './icons/EnvelopeIcon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-200 relative max-h-[90vh] overflow-y-auto">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
        </button>

        <h3 className="text-2xl font-bold text-gray-900 mb-4 tracking-tight">Privacy & Security</h3>
        
        <div className="space-y-6 text-gray-600 leading-relaxed text-sm md:text-base">
            <div>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Data Privacy</h4>
                <p className="mb-3">
                    Your account and learning records are stored using Google Firebase. Scenario responses, transcripts and related feedback are processed by Google’s Gemini service to provide assessments and coaching. Authorised administrators can access stored learning records to administer the service and support users.
                </p>
                <p>
                    We use Google reCAPTCHA Enterprise through Firebase App Check to help prevent automated abuse. Google processes browser and device signals for this purpose. Google’s <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms of Service</a> apply.
                </p>
                <p className="mt-3">
                    Your learning records are not published or made available to other learners. Payments are handled by Stripe, which receives your email address and transaction details. Card details entered in Stripe Checkout are not stored by Skill Builder.
                </p>
            </div>

            <div className="pt-4 border-t border-gray-100">
                 <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Infrastructure & Security</h4>
                 
                 <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                    <div>
                        <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            For Users
                        </span>
                        <p className="text-sm text-gray-700 mt-1.5">
                            Access to your account requires sign-in. Database rules separate learner records and restrict administrative operations. Data is encrypted in transit and at rest using Google Cloud services.
                        </p>
                    </div>
                    
                    <div>
                        <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                             <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                             Technical Specs (For IT Teams)
                        </span>
                        <p className="text-xs text-gray-600 mt-1.5 font-mono leading-relaxed">
                            Application hosted on Google Cloud Platform (GCP). Identity management via Firebase Authentication. Data storage uses Cloud Firestore (NoSQL) with automatic encryption at rest. AI processing uses the Google Gemini API over HTTPS. Stripe hosts payment collection and subscription management.
                        </p>
                    </div>
                 </div>
            </div>
        </div>

        <div className="mt-8 flex justify-end">
            <button 
                onClick={onClose} 
                className="bg-black text-white hover:bg-gray-800 font-semibold py-2.5 px-6 rounded-xl text-sm transition-colors shadow-sm"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export const ContactModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-200 relative">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
        </button>

        <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Get in Touch</h3>
        <p className="text-gray-500 mb-6">We'd love to hear from you.</p>
        
        <div className="space-y-6 text-gray-600 leading-relaxed text-sm md:text-base">
            <p>
                Have questions, encountered an issue, or interested in a customized version of Leadership Skill Builder for your own organization?
            </p>
            
            <a 
                href="mailto:gary@gardenersnotmechanics.com" 
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-100 transition-all group"
            >
                <div className="bg-white p-2 rounded-full border border-gray-200 text-gray-900 group-hover:text-black">
                    <EnvelopeIcon className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Email Us</p>
                    <p className="font-bold text-gray-900 text-base break-all">gary@gardenersnotmechanics.com</p>
                </div>
            </a>
        </div>

        <div className="mt-8 flex justify-end">
            <button 
                onClick={onClose} 
                className="bg-black text-white hover:bg-gray-800 font-semibold py-2.5 px-6 rounded-xl text-sm transition-colors shadow-sm"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};
