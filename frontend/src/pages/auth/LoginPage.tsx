import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { Mic, BookOpen, TrendingUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

type Mode = 'signin' | 'signup' | 'confirm';

const FEATURES = [
  { icon: Mic, text: 'Live AI tutor — speaks, listens, corrects' },
  { icon: TrendingUp, text: 'Adapts to your IELTS level automatically' },
  { icon: BookOpen, text: 'Track your progress, session by session' },
] as const;

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, confirmSignUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(cardRef.current, {
        duration: 0.3,
        opacity: 0,
        y: 16,
        ease: 'expo.out',
      });
    });
    return () => ctx.revert();
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setIsSubmitting(true);
    try {
      await signUp(email, password, name);
      setMode('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmSignUp(email, code);
      setMode('signin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSignIn = mode === 'signin';
  const title = mode === 'confirm' ? 'Check your email' : isSignIn ? 'Welcome back' : 'Create account';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left brand panel */}
      <div style={{
        flex: '0 0 50%',
        background: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '10%', left: '10%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '10%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(45,212,191,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 400 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 48,
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.1,
            marginBottom: 12,
          }}>
            EnglishAI
          </div>
          <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.5 }}>
            Master English through real conversation.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-gold-muted)',
                  border: '1px solid rgba(201,168,76,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={16} strokeWidth={1.5} style={{ color: 'var(--accent-gold)' }} />
                </div>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{
        flex: '0 0 50%',
        background: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
      }}>
        <div ref={cardRef} style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 24,
          }}>
            {title}
          </h2>

          {/* Mode toggle */}
          {mode !== 'confirm' && (
            <div style={{
              display: 'flex',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-pill)',
              padding: 3,
              marginBottom: 28,
              width: 'fit-content',
            }}>
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  style={{
                    padding: '7px 20px',
                    borderRadius: 'var(--radius-pill)',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                    transition: 'all 200ms var(--ease-out-expo)',
                    background: mode === m ? 'var(--accent-gold)' : 'transparent',
                    color: mode === m ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  }}
                >
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--status-error)',
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {mode === 'signin' && (
            <form onSubmit={(e) => { void handleSignIn(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
              <SubmitBtn loading={isSubmitting}>Sign In</SubmitBtn>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={(e) => { void handleSignUp(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Full name" type="text" value={name} onChange={setName} placeholder="Your name" />
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="8+ characters" />
              <Field label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat password" />
              <SubmitBtn loading={isSubmitting}>Create Account</SubmitBtn>
            </form>
          )}

          {mode === 'confirm' && (
            <form onSubmit={(e) => { void handleConfirm(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                We sent a code to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Enter it below.
              </p>
              <Field label="Confirmation code" type="text" value={code} onChange={setCode} placeholder="6-digit code" />
              <SubmitBtn loading={isSubmitting}>Verify Account</SubmitBtn>
              <button
                type="button"
                onClick={() => setMode('signin')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}
              >
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function Field({ label, type, value, onChange, placeholder }: FieldProps) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        style={{
          width: '100%',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '11px 16px',
          color: 'var(--text-primary)',
          fontSize: 15,
          fontFamily: 'var(--font-body)',
          outline: 'none',
          transition: 'border-color 200ms, box-shadow 200ms',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-gold)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-gold-muted)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

function SubmitBtn({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: '100%',
        padding: '12px 0',
        background: loading ? 'rgba(201,168,76,0.5)' : 'var(--accent-gold)',
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        color: 'var(--text-inverse)',
        fontSize: 14,
        fontWeight: 500,
        fontFamily: 'var(--font-body)',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'background 200ms',
        marginTop: 4,
      }}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
