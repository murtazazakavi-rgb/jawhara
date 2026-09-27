'use client';

import React from 'react';

/**
 * A <select> that submits its parent GET form as soon as the value changes,
 * so filter changes apply without a separate "Apply" button.
 */
export default function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(e) => {
        props.onChange?.(e);
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
