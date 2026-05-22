import type { ReactNode } from 'react';
import './sectionTitle.css';

interface SectionTitleProps {
  eyebrow?: string;
  title: ReactNode;
  align?: 'left' | 'center';
  size?: 'sm' | 'md' | 'lg';
}

export function SectionTitle({ eyebrow, title, align = 'center', size = 'md' }: SectionTitleProps) {
  return (
    <div className={`section-title section-title--${align} section-title--${size}`}>
      {eyebrow && <p className="section-title__eyebrow">{eyebrow}</p>}
      <h2 className="section-title__title">{title}</h2>
    </div>
  );
}
