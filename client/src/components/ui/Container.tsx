import type { HTMLAttributes, ReactNode } from 'react';

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'narrow' | 'default' | 'wide';
  children: ReactNode;
}

export function Container({ size = 'default', className = '', children, ...rest }: ContainerProps) {
  const sizeClass = size === 'narrow' ? 'container container--narrow' :
                    size === 'wide' ? 'container container--wide' :
                    'container';
  return (
    <div className={`${sizeClass} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
