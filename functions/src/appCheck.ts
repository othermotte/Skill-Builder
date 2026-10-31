import { defineBoolean } from 'firebase-functions/params';

// Explicit deployment parameter. Production defaults to unchanged behaviour.
// Emulator tests use their isolated Firebase services without attestation.
export const appCheckEnforced = defineBoolean('APP_CHECK_ENFORCED', { default: false });
export const callableAppCheck = {
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR === 'true' ? false : appCheckEnforced,
};
