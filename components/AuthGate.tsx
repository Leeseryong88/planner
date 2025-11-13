import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { auth } from '@/firebase';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  User
} from 'firebase/auth';

type AuthGateProps = {
  children: React.ReactNode;
};

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && !busy;
  }, [email, password, busy]);

  const handleSignup = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Fire and forget; verification is optional depending on project policy
      try { await sendEmailVerification(cred.user); } catch {}
    } catch (e: any) {
      setError(e?.message ?? '회원가입에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }, [email, password]);

  const handleSignin = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      setError(e?.message ?? '로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }, [email, password]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div>로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary to-primary-gradient-end">
        <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-6">
          <div className="flex justify-center mb-4">
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              <button
                className={`px-4 py-2 rounded-md ${mode === 'signup' ? 'bg-accent text-white' : 'text-gray-700'}`}
                onClick={() => setMode('signup')}
              >
                회원가입
              </button>
              <button
                className={`px-4 py-2 rounded-md ${mode === 'signin' ? 'bg-accent text-white' : 'text-gray-700'}`}
                onClick={() => setMode('signin')}
              >
                로그인
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="email"
              placeholder="이메일"
              className="w-full border rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              type="password"
              placeholder="비밀번호 (6자 이상)"
              className="w-full border rounded-lg px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            {error ? <div className="text-red-600 text-sm">{error}</div> : null}
            {mode === 'signup' ? (
              <button
                className="w-full bg-accent text-white rounded-lg py-2 disabled:opacity-50"
                onClick={handleSignup}
                disabled={!canSubmit}
              >
                {busy ? '처리 중...' : '회원가입'}
              </button>
            ) : (
              <button
                className="w-full bg-accent text-white rounded-lg py-2 disabled:opacity-50"
                onClick={handleSignin}
                disabled={!canSubmit}
              >
                {busy ? '처리 중...' : '로그인'}
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            이메일/비밀번호 로그인이 Firebase Authentication에서 활성화되어 있어야 합니다.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};


