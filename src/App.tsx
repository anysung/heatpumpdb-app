import React, { useState, useEffect } from 'react';
import { loginUser, registerUser, logoutUser, onUserChange, loginWithProvider, isAdminRole } from './services/authService';
import { HpiqApp } from './hpiq/HpiqApp';
import { AdminDashboard } from './components/AdminDashboard';
import {
  AuthShell, GlassCard, SegmentTiles, LeafIcon, GoogleIcon, AppleIcon,
  authInput, authSelect, authLabel, primaryBtn, ghostBtn, socialBtn,
} from './components/auth/AuthShell';
import { HeatPumpDatabase, HeatPump, User, AppMode, Language } from './types';
import { auth } from './firebase';
import { translations } from './translations';
import { DEFAULT_LANGUAGE } from './hpiq/market';
import { PUBLIC_ENV } from './config/env';

// Unified operations console build (own hosting site, all markets, admin-only).
const IS_ADMIN_BUILD = PUBLIC_ENV.APP_MODE === 'admin';
// Use Firestore Service
import { getProducts, getCommercialProducts, getNews, getPolicies, getBAFA } from './services/dbService';

type ViewState = 'LANDING' | 'LOGIN' | 'SIGNUP' | 'PENDING_APPROVAL' | 'APP' | 'ADMIN_DASHBOARD';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(IS_ADMIN_BUILD ? 'LOGIN' : 'LANDING');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  const [fullDatabase, setFullDatabase] = useState<HeatPumpDatabase | null>(null);
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [signupData, setSignupData] = useState<any>({});
  // Account/data-use consent popup (signup gate) — resolves on agree.
  const [termsPrompt, setTermsPrompt] = useState<{ resolve: () => void; reject: () => void } | null>(null);
  const requestTermsConsent = () =>
    new Promise<void>((resolve, reject) => setTermsPrompt({ resolve, reject }));

  const t = translations[language];

  useEffect(() => {
    // 1. Auth
    const unsubscribe = onUserChange((user) => {
      setCurrentUser(user);
      if (user) {
        // Enforce approval status in ALL views — including while the user is already in the app.
        // This ensures real-time enforcement if an admin suspends/rejects a live session.
        if (user.status === 'pending') {
          setCurrentView('PENDING_APPROVAL');
        } else if (
          user.status === 'suspended' ||
          user.status === 'rejected' ||
          user.status === 'disabled'
        ) {
          logoutUser();
        } else {
          // User is approved — only redirect to APP when coming from pre-app views.
          // If already in APP or ADMIN_DASHBOARD, leave them where they are.
          const needsRouting =
            currentView === 'LANDING' ||
            currentView === 'LOGIN' ||
            currentView === 'SIGNUP' ||
            currentView === 'PENDING_APPROVAL';
          if (needsRouting) {
            if (IS_ADMIN_BUILD) {
              if (isAdminRole(user.role)) {
                setCurrentView('ADMIN_DASHBOARD');
              } else {
                alert('This console requires an administrator account.');
                logoutUser();
              }
            } else {
              setCurrentView('APP');
            }
          }
        }
      } else {
        if (IS_ADMIN_BUILD) {
          if (currentView !== 'LOGIN') setCurrentView('LOGIN');
        } else if (currentView === 'APP' || currentView === 'PENDING_APPROVAL') {
          setCurrentView('LANDING');
        }
      }
      setAuthLoading(false);
    });

    // 2. Load Data from Firestore
    const loadData = async () => {
      try {
        const [products, commercialProducts, news, policies, bafa] = await Promise.all([
            getProducts(),
            getCommercialProducts(),
            getNews(),
            getPolicies(),
            getBAFA()
        ]);

        const dbData: HeatPumpDatabase = {
            generatedAt: new Date().toISOString(),
            version: "Firestore-Live",
            appMode: 'DATABASE',
            products: products,
            commercialProducts: commercialProducts,
            newsFeed: news,
            policySummary: policies,
            bafaListLinks: bafa
        };
        setFullDatabase(dbData);
      } catch (err) {
          console.error("Failed to load Firestore data", err);
      }
    };
    // Datasets + Firestore content are auth-protected (anti-scraping):
    // loading before sign-in would only produce permission errors, so wait
    // for a session. The effect re-runs on the post-login view change.
    // Dev server reads local files and may load immediately (previews).
    if (import.meta.env.DEV || auth.currentUser) loadData();

    return () => unsubscribe();
  }, [currentView]);

  // ... (Keep all Handlers: handleLogin, handleSignup, etc. EXACTLY AS THEY WERE) ...
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginUser(loginEmail, loginPass);
      setLoginEmail(''); setLoginPass('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Consent to the one-account-per-person + no-data-extraction terms
      // is required before the account is created.
      try { await requestTermsConsent(); }
      catch { alert(t.termsDeclined); return; }
      const activated = await registerUser({ ...signupData, termsAcceptedAt: new Date().toISOString() });
      if (activated) {
        // Free-access grant applied — the account is live, go straight in.
        setCurrentUser(activated);
        setCurrentView('APP');
      } else {
        setCurrentView('PENDING_APPROVAL');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      const result = await loginWithProvider(provider, requestTermsConsent);
      // 'active' → onUserChange routes into the app automatically.
      if (result === 'pending-created') setCurrentView('PENDING_APPROVAL');
    } catch (err: any) {
      // User closed/cancelled the popup — not an error worth alerting.
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
      if (err?.message === 'terms-declined') { alert(t.termsDeclined); return; }
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    const email = currentUser?.email || '';
    const name = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '';
    await logoutUser(email, name);
  };

  // Admin access is role-based (Firebase account): owner/admin/support/ops only.
  // Firestore security rules enforce the same roles server-side, so the view
  // gate here is UX — data access is protected even if the gate were bypassed.
  const handleAdminAccess = () => {
    if (currentUser && isAdminRole(currentUser.role)) {
      setCurrentView('ADMIN_DASHBOARD');
    } else if (currentUser) {
      alert(language === 'de'
        ? 'Der Admin-Bereich erfordert ein Administratorkonto.'
        : 'The admin console requires an administrator account.');
    } else {
      alert(language === 'de'
        ? 'Bitte melden Sie sich mit einem Administratorkonto an.'
        : 'Please log in with an administrator account first.');
      setCurrentView('LOGIN');
    }
  };

  // Dev-only admin console preview (no auth, layout only — Firestore reads
  // still require a real admin account): vite dev server + ?preview=admin
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'admin') {
    return (
      <AdminDashboard
        onLogout={() => {}}
        cachedDatabase={fullDatabase ? [...fullDatabase.products, ...(fullDatabase.commercialProducts ?? [])] : null}
        lastUpdated={fullDatabase?.generatedAt || null}
        language={language}
      />
    );
  }

  // Dev-only UI preview (no auth): vite dev server + ?preview=hpiq
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'hpiq') {
    const previewUser: User = {
      id: 'preview', email: 'c.sung@example.de', firstName: 'Christopher', lastName: 'Sung',
      companyType: 'Installer', jobRole: 'Technician', isActive: true, registeredAt: new Date().toISOString(),
    };
    return (
      <HpiqApp
        user={previewUser}
        onLogout={() => {}}
        dbData={fullDatabase}
        language={language}
        setLanguage={setLanguage}
      />
    );
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading App...</div>;


  // ... (Return JSX - Keep exactly the same structure as before) ...
  // I am omitting the full JSX here for brevity as it hasn't changed, just the data loading logic above.
  // Please ensure you keep the full JSX for LANDING, LOGIN, SIGNUP, APP, ADMIN_DASHBOARD.
  
  // Account/data-use consent popup — gates every registration path
  // (signup form + first-time social sign-in). Fixed overlay above the auth UI.
  const termsModal = termsPrompt ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#101b16] p-7 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-1">{t.termsTitle}</h3>
        <p className="text-white/50 text-sm mb-4">{t.termsIntro}</p>
        <div className="space-y-3 mb-6">
          <p className="text-[13px] leading-relaxed text-white/80 bg-white/5 border border-white/10 rounded-xl p-3.5">{t.termsAccount}</p>
          <p className="text-[13px] leading-relaxed text-white/80 bg-white/5 border border-white/10 rounded-xl p-3.5">{t.termsData}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { termsPrompt.resolve(); setTermsPrompt(null); }}
            className="flex-1 py-3 rounded-xl font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:opacity-90 transition-opacity"
          >
            {t.termsAgree}
          </button>
          <button
            onClick={() => { termsPrompt.reject(); setTermsPrompt(null); }}
            className="px-5 py-3 rounded-xl font-medium text-white/70 border border-white/20 hover:bg-white/5 transition-colors"
          >
            {t.termsCancel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ... (Previous JSX code) ...
  if (currentView === 'LANDING') {
    return (
      <AuthShell t={t} language={language} setLanguage={setLanguage}>
        <div className="w-full max-w-6xl grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-center">
          {/* Hero — market story */}
          <div className="max-w-xl hp-fade-up">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/25 text-emerald-300 text-xs font-semibold tracking-wide uppercase">
              <LeafIcon className="w-3.5 h-3.5" />
              {t.authTagline}
            </span>
            <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight leading-[1.08]">
              {t.authHeadline}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                {t.authHeadlineAccent}
              </span>
            </h1>
            <p className="mt-4 text-white/60 text-base md:text-lg">{t.subTitle}</p>
            <div className="mt-5">
              <SegmentTiles t={t} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[t.authChipBafa, t.authChipRefrigerant, t.authChipScop].map((chip: string) => (
                <span key={chip} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/70 whitespace-nowrap">
                  {chip}
                </span>
              ))}
            </div>
            {/* Indexable market keywords — compact two-line copy (search visibility). */}
            {(t as any).authSeoLine && (
              <p className="mt-4 text-[11px] leading-relaxed text-white/40 max-w-lg">
                {(t as any).authSeoLine}
              </p>
            )}
          </div>

          {/* Entry card */}
          <div className="w-full max-w-md justify-self-center lg:justify-self-end flex flex-col gap-3 hp-fade-up-delay">
            {/* Live catalogue stats (build-time counts) — the app's USP,
                presented as a three-line lockup above the entry card. */}
            {__MARKET_STATS__.res > 0 && (
              <div className="text-center flex flex-col gap-1.5 mb-1">
                <p className="text-[11px] tracking-[0.16em] uppercase text-white/50">{(t as any).authStatsTitle}</p>
                <p className="text-3xl font-bold leading-none text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300">
                  {(t as any).authStatsTotal} {(__MARKET_STATS__.res + __MARKET_STATS__.com).toLocaleString()}
                </p>
                <p className="text-[12.5px] text-white/60">
                  {t.tabResidential} <span className="font-semibold text-white/85">{__MARKET_STATS__.res.toLocaleString()}</span>
                  <span className="mx-2 text-white/30">·</span>
                  {t.tabCommercial} <span className="font-semibold text-white/85">{__MARKET_STATS__.com.toLocaleString()}</span>
                </p>
              </div>
            )}
          <GlassCard className="w-full p-8">
            <h2 className="text-xl font-semibold text-white mb-6 text-center">{t.welcomeTitle}</h2>
            <div className="flex flex-col gap-3">
              <button onClick={() => setCurrentView('SIGNUP')} className={primaryBtn}>{t.signup}</button>
              <button onClick={() => setCurrentView('LOGIN')} className={ghostBtn}>{t.login}</button>
            </div>
            <div className="mt-8 text-center">
              <button onClick={handleAdminAccess} className="text-white/30 text-xs hover:text-white/70 underline transition-colors">
                {t.adminAccess}
              </button>
            </div>
          </GlassCard>
          </div>
        </div>
      </AuthShell>
    );
  }
  if (currentView === 'LOGIN') {
    return (
      <AuthShell t={t} language={language} setLanguage={setLanguage}>
        {termsModal}
        <GlassCard className="w-full max-w-md p-8 hp-fade-up">
          <button onClick={() => setCurrentView('LANDING')} className="text-white/40 hover:text-white text-sm mb-6 transition-colors">← {t.back}</button>
          <h2 className="text-2xl font-bold text-white mb-1">{t.loginTitle}</h2>
          <p className="text-white/50 text-sm mb-7">{t.loginSub}</p>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className={authLabel}>{t.email}</label>
              <input type="email" required autoComplete="email" className={authInput} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            </div>
            <div>
              <label className={authLabel}>{t.password}</label>
              <input type="password" required autoComplete="current-password" className={authInput} value={loginPass} onChange={e => setLoginPass(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => alert("Reset link sent to email.")} className="text-sm text-emerald-300/80 hover:text-emerald-200 transition-colors">{t.forgotPass}</button>
            </div>
            <button type="submit" disabled={isLoading} className={primaryBtn}>{isLoading ? t.loggingIn : t.loginTitle}</button>
          </form>
          <div className="flex items-center gap-3 my-6">
            <span className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/40">{t.orContinueWith}</span>
            <span className="flex-1 h-px bg-white/10" />
          </div>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => handleSocialLogin('google')} disabled={isLoading} className={socialBtn}>
              <GoogleIcon /> {t.continueGoogle}
            </button>
            <button type="button" onClick={() => handleSocialLogin('apple')} disabled={isLoading} className={socialBtn}>
              <AppleIcon /> {t.continueApple}
            </button>
          </div>
          <p className="mt-6 text-center text-sm text-white/45">
            {t.authNoAccount}{' '}
            <button onClick={() => setCurrentView('SIGNUP')} className="text-emerald-300 font-semibold hover:text-emerald-200 transition-colors">{t.signup}</button>
          </p>
        </GlassCard>
      </AuthShell>
    );
  }
  if (currentView === 'SIGNUP') {
    return (
      <AuthShell t={t} language={language} setLanguage={setLanguage}>
        {termsModal}
        <GlassCard className="w-full max-w-2xl p-8 hp-fade-up">
          <button onClick={() => setCurrentView('LANDING')} className="text-white/40 hover:text-white text-sm mb-6 transition-colors">← {t.back}</button>
          <h2 className="text-2xl font-bold text-white mb-6">{t.createAccount}</h2>
          <form onSubmit={handleSignup} className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="col-span-1"><label className={authLabel}>{t.firstName} *</label><input type="text" required className={authInput} onChange={e => setSignupData({...signupData, firstName: e.target.value})} /></div>
             <div className="col-span-1"><label className={authLabel}>{t.lastName} *</label><input type="text" required className={authInput} onChange={e => setSignupData({...signupData, lastName: e.target.value})} /></div>
             <div className="md:col-span-2"><label className={authLabel}>{t.email} *</label><input type="email" required autoComplete="email" className={authInput} onChange={e => setSignupData({...signupData, email: e.target.value})} /></div>
             <div className="md:col-span-2"><label className={authLabel}>{t.password} *</label><input type="password" required autoComplete="new-password" className={authInput} onChange={e => setSignupData({...signupData, password: e.target.value})} /></div>
             <div className="col-span-1"><label className={authLabel}>{t.companyType} *</label><select required className={authSelect} onChange={e => setSignupData({...signupData, companyType: e.target.value})}><option value="">{t.select}</option><option value="Manufacturer">Manufacturer</option><option value="Distributor">Distributor</option><option value="Installer">Installer</option><option value="Private Individual">Private Individual</option></select></div>
             <div className="col-span-1"><label className={authLabel}>{t.jobRole} *</label><select required className={authSelect} onChange={e => setSignupData({...signupData, jobRole: e.target.value})}><option value="">{t.select}</option><option value="C-Level">C-Level</option><option value="Director">Director</option><option value="Sales Manager">Sales Manager</option><option value="Technician">Technician</option><option value="Service">Service</option><option value="Product Management">Product Management</option><option value="General Public">General Public</option><option value="Other">Other</option></select></div>
             <div className="col-span-1"><label className={authLabel}>{t.companyName}</label><input type="text" className={authInput} onChange={e => setSignupData({...signupData, companyName: e.target.value})} /></div>
             <div className="col-span-1"><label className={authLabel}>{t.city}</label><input type="text" className={authInput} onChange={e => setSignupData({...signupData, companyCity: e.target.value})} /></div>
             <div className="md:col-span-2"><label className={authLabel}>{t.referralSource}</label><select className={authSelect} onChange={e => setSignupData({...signupData, referralSource: e.target.value})}><option value="">{t.select}</option><option value="Google">Google Search</option><option value="Friend">Friend/Colleague</option><option value="Ad">Online Ad</option><option value="Other">Other</option></select></div>
             <div className="md:col-span-2 mt-4"><button type="submit" disabled={isLoading} className={primaryBtn}>{isLoading ? t.registering : t.completeSignup}</button></div>
          </form>
          <p className="mt-6 text-center text-sm text-white/45">
            {t.authHaveAccount}{' '}
            <button onClick={() => setCurrentView('LOGIN')} className="text-emerald-300 font-semibold hover:text-emerald-200 transition-colors">{t.login}</button>
          </p>
        </GlassCard>
      </AuthShell>
    );
  }
  if (currentView === 'PENDING_APPROVAL') {
    return (
      <AuthShell t={t} language={language} setLanguage={setLanguage}>
        <GlassCard className="w-full max-w-md p-10 text-center hp-fade-up">
          <div className="text-6xl mb-6">⏳</div>
          <h2 className="text-2xl font-bold text-white mb-3">Registration Submitted</h2>
          <p className="text-white/70 mb-2">Your application is <span className="font-semibold text-amber-300">pending approval</span>.</p>
          <p className="text-white/50 text-sm mb-8">
            An administrator will review your registration and notify you by email once your account is activated. This typically takes 1–2 business days.
          </p>
          <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-4 text-sm text-emerald-200 mb-8 text-left">
            <p className="font-bold mb-1">What happens next?</p>
            <ol className="list-decimal list-inside space-y-1 text-emerald-200/80">
              <li>Admin reviews your profile</li>
              <li>Account is approved &amp; activated</li>
              <li>You can log in with your credentials</li>
            </ol>
          </div>
          <button onClick={() => setCurrentView('LANDING')} className={ghostBtn}>
            ← Back to Home
          </button>
        </GlassCard>
      </AuthShell>
    );
  }

  if (currentView === 'ADMIN_DASHBOARD') {
    // Role guard: never render the console without an admin account.
    if (!currentUser || !isAdminRole(currentUser.role)) {
      setTimeout(() => setCurrentView(currentUser ? 'APP' : 'LANDING'), 0);
      return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Redirecting…</div>;
    }
    // The console owns its own EN/KO language toggle (sidebar buttons) — no
    // floating flag switcher overlaying the content.
    return (
      <AdminDashboard
        onLogout={() => {
          if (IS_ADMIN_BUILD) { logoutUser(); setCurrentView('LOGIN'); }
          else setCurrentView(currentUser ? 'APP' : 'LANDING');
        }}
        cachedDatabase={fullDatabase ? [...fullDatabase.products, ...(fullDatabase.commercialProducts ?? [])] : null}
        lastUpdated={fullDatabase?.generatedAt || null}
      />
    );
  }
  if (currentView === 'APP' && currentUser) {
    // HeatPump DB shell owns its own language toggle (DE|EN in the global nav) —
    // no floating switcher overlay here.
    return (
      <HpiqApp
        user={currentUser}
        onLogout={handleLogout}
        onAdminAccess={isAdminRole(currentUser.role) ? handleAdminAccess : undefined}
        dbData={fullDatabase}
        language={language}
        setLanguage={setLanguage}
      />
    );
  }

  return <div>Loading View...</div>;
};
export default App;