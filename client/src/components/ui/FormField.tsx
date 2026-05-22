import { forwardRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import eyeShow from '@/assets/eye-show.png';
import eyeHide from '@/assets/eye-hide.png';
import './formField.css';

interface FormFieldBaseProps {
  label: string;
  error?: string;
  hint?: string;
}

type InputProps = FormFieldBaseProps & InputHTMLAttributes<HTMLInputElement>;
type SelectProps = FormFieldBaseProps & SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
};

export const FormField = forwardRef<HTMLInputElement, InputProps>(function FormField(
  { label, error, hint, id, type = 'text', className = '', ...rest },
  ref
) {
  const inputId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const actualType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`form-field ${error ? 'form-field--error' : ''} ${className}`.trim()}>
      <input
        ref={ref}
        id={inputId}
        type={actualType}
        placeholder={rest.placeholder || ` `}
        {...rest}
      />
      <label htmlFor={inputId}>{label}</label>
      {isPassword && (
        <button
          type="button"
          className="form-field__eye"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          <img src={showPassword ? eyeShow : eyeHide} alt="" />
        </button>
      )}
      {hint && !error && <p className="form-field__hint">{hint}</p>}
      {error && <p className="form-field__error">{error}</p>}
    </div>
  );
});

export function SelectField({
  label,
  error,
  hint,
  id,
  options,
  className = '',
  ...rest
}: SelectProps) {
  const selectId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className={`form-field form-field--select ${error ? 'form-field--error' : ''} ${className}`.trim()}>
      <select id={selectId} {...rest}>
        <option value="" hidden></option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <label htmlFor={selectId}>{label}</label>
      {hint && !error && <p className="form-field__hint">{hint}</p>}
      {error && <p className="form-field__error">{error}</p>}
    </div>
  );
}

interface FieldGroupProps {
  children: ReactNode;
  className?: string;
}
export function FieldGroup({ children, className = '' }: FieldGroupProps) {
  return <div className={`form-group ${className}`.trim()}>{children}</div>;
}
