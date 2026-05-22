import './feedback.css';

interface LoadingProps {
  label?: string;
  fullPage?: boolean;
}

export function Loading({ label = 'Loading…', fullPage = false }: LoadingProps) {
  return (
    <div className={`feedback ${fullPage ? 'feedback--full' : ''}`}>
      <div className="feedback__spinner" aria-hidden="true" />
      <p className="feedback__text">{label}</p>
    </div>
  );
}
