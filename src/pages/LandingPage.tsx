import { useEffect, useRef, useState } from 'react';
import './LandingPage.css';

interface LandingPageProps {
  mode: 'guest' | 'member';
  onPrimary: () => void;
}

const FEATURES = [
  {
    label: '기록',
    body: '직관적인 캘린더형 UI와 필요한 조작만 요구하는 미니멀한 UX로 하루의 소득과 지출을 등록하세요.',
  },
  {
    label: '한도',
    body: '(소득 - 지출) ÷ 남은 날 = 오늘 써도 되는 돈. 손익 분기를 확인하고 충동적인 소비를 예방하세요.',
  },
  {
    label: '보안',
    body: '소득과 지출에 남기는 모든 메모는 암호화됩니다. 관리자도, 서버를 탈취당한 경우에도 원문을 확인할 수 없습니다.',
  },
] as const;

export function LandingPage({ mode, onPrimary }: LandingPageProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(false);
  const [visibleBlocks, setVisibleBlocks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const blocks = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const end = endRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const el = entry.target as HTMLElement;
          if (el === end) {
            setCtaVisible(true);
            continue;
          }

          const index = Number(el.dataset.reveal);
          if (!Number.isNaN(index)) {
            setVisibleBlocks((prev) => ({ ...prev, [index]: true }));
          }
        }
      },
      {
        root: null,
        threshold: 0.35,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    blocks.forEach((block) => observer.observe(block));
    if (end) observer.observe(end);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing">
      <div className="landing-scroll">
        <header className="landing-hero">
          <h1 className="landing-title">PayDay</h1>
          <p className="landing-subtitle">
            소득과 지출을 관리하고,
            <br />
            오늘 돈을 얼마나 써도 되는지 확인하세요.
          </p>
        </header>

        <section className="landing-features">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.label}
              className={`landing-block ${visibleBlocks[index] ? 'is-visible' : ''}`}
              data-reveal={index}
            >
              <div className="landing-block-index">{String(index + 1).padStart(2, '0')}</div>
              <div className="landing-block-content">
                <h2 className="landing-block-label">{feature.label}</h2>
                <p className="landing-block-body">{feature.body}</p>
              </div>
            </article>
          ))}
        </section>

        <div ref={endRef} className="landing-scroll-end" aria-hidden />
      </div>

      <div className={`landing-cta ${ctaVisible ? 'is-visible' : ''}`}>
        <button type="button" className="landing-btn" onClick={onPrimary}>
          {mode === 'guest' ? '시작하기' : '내 캘린더로 이동'}
        </button>
      </div>
    </div>
  );
}
