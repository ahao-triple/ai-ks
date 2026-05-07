import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

export interface InputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  error?: ReactNode;
  helper?: ReactNode;
  label: ReactNode;
  onChange?: (value: string) => void;
  trailing?: ReactNode;
}

export function InputField({
  className,
  error,
  helper,
  id,
  label,
  onChange,
  trailing,
  ...props
}: InputFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? helper;
  const messageId = message ? `${inputId}-message` : undefined;
  const classes = ['ui-input-field', className].filter(Boolean).join(' ');

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.currentTarget.value);
  }

  return (
    <label className={classes} htmlFor={inputId}>
      <span className="ui-input-label">{label}</span>
      <span className="ui-input-control">
        <input
          aria-describedby={messageId}
          aria-invalid={error ? true : undefined}
          id={inputId}
          onChange={handleChange}
          {...props}
        />
        {trailing ? <span className="ui-input-trailing">{trailing}</span> : null}
      </span>
      {message ? (
        <span
          className={error ? 'ui-input-message ui-input-error' : 'ui-input-message'}
          id={messageId}
        >
          {message}
        </span>
      ) : null}
    </label>
  );
}
