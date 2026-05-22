import type { HTMLAttributes, ReactNode } from 'react';
import './card.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Card({
  hoverable = false,
  padding = 'md',
  className = '',
  children,
  ...rest
}: CardProps) {
  const classes = [
    'card',
    `card--p-${padding}`,
    hoverable ? 'card--hoverable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}

export default Card;
