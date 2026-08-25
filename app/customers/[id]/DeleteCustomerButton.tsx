'use client';

import React, { useState } from 'react';
import { deleteCustomerAction } from '../actions';
import { useRouter } from 'next/navigation';

export default function DeleteCustomerButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this customer? This profile will be archived if they have order history, or deleted permanently if not.')) {
      return;
    }
    
    setLoading(true);
    try {
      const res = await deleteCustomerAction(id);
      if (res.error) {
        alert(res.error);
      } else {
        alert(res.archived ? 'Customer profile has order history and has been archived.' : 'Customer deleted permanently.');
        router.push('/customers');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while deleting the customer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="px-4 py-2 border border-error text-error hover:bg-error/5 transition-colors rounded-lg font-label-md text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-[16px]">delete</span>
      {loading ? 'Deleting...' : 'Delete Client'}
    </button>
  );
}
