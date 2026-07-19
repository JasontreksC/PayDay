import { useState } from 'react';
import '../auth/auth.css';

interface ResetDataScreenProps {
  onBack: () => void;
  onReset: () => Promise<string | null>;
}

export function ResetDataScreen({ onBack, onReset }: ResetDataScreenProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    if (step === 0) {
      setStep(1);
      setError('');
      setSuccess('');
      return;
    }

    if (step === 1) {
      setStep(2);
      return;
    }

    setSubmitting(true);
    setError('');
    const message = await onReset();
    if (message) {
      setError(message);
      setStep(0);
    } else {
      setSuccess('모든 수입·지출 내역이 삭제되었습니다.');
      setStep(0);
    }
    setSubmitting(false);
  };

  return (
    <div className="account">
      <div className="account-header">
        <button type="button" className="account-back" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        <h2 className="account-title">초기화</h2>
      </div>

      <div className="account-card">
        <p className="account-email" style={{ fontSize: 14, lineHeight: 1.55 }}>
          작성한 모든 수입·지출 내역을 삭제합니다.
          계정과 암호화 키는 유지됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {success && <p className="auth-success">{success}</p>}

      <div className="account-actions">
        <button
          type="button"
          className={`auth-btn ${step > 0 ? 'danger' : 'ghost'}`}
          onClick={handleReset}
          disabled={submitting}
        >
          {step === 0 && '내역 전체 삭제'}
          {step === 1 && '한 번 더 확인'}
          {step === 2 && (submitting ? '삭제 중...' : '최종 삭제')}
        </button>
        {step > 0 && (
          <button
            type="button"
            className="auth-link"
            onClick={() => setStep(0)}
            disabled={submitting}
          >
            취소
          </button>
        )}
      </div>
    </div>
  );
}
