import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const schema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { authUser, loading: authLoading, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Already authenticated → redirect
  if (!authLoading && authUser) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(data: FormData) {
    setServerError('');
    setIsLoading(true);

    try {
      const result = await login(data.username, data.password);

      if (!result.success) {
        setServerError(result.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch {
      setServerError('حدث خطأ غير متوقع. حاول مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <span className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      {/* Background accent */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, var(--color-accent-bg) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Card outer shell — double-bezel */}
        <div className="bg-[var(--color-border)]/30 rounded-[var(--radius-xl)] p-[1.5px] shadow-[var(--shadow-lg)]">
          <div className="bg-[var(--color-surface)] rounded-[calc(var(--radius-xl)-1.5px)] p-8">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--color-accent)] flex items-center justify-center shadow-[var(--shadow-md)]">
                <UtensilsCrossed size={26} className="text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-[var(--color-text)]">أبو ناجي</h1>
                <p className="text-sm text-[var(--color-text-2)] mt-0.5">لوحة إدارة المطعم</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <Input
                id="username"
                label="اسم المستخدم"
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="أدخل اسم المستخدم"
                error={errors.username?.message}
                {...register('username')}
              />

              <Input
                id="password"
                label="كلمة المرور"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="أدخل كلمة المرور"
                error={errors.password?.message}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="text-[var(--color-text-3)] hover:text-[var(--color-text)] transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                {...register('password')}
              />

              {serverError && (
                <div
                  role="alert"
                  className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-sm"
                >
                  {serverError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full mt-2"
              >
                تسجيل الدخول
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--color-text-3)] mt-4">
          لوحة الإدارة الداخلية — غير مخصصة للعامة
        </p>
      </div>
    </div>
  );
}
