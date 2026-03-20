'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import PurchaseInvoiceTaskPage from '../../[taskId]/page';

export default function GroupItemPage() {
  const params = useParams();
  const itemId = typeof params.itemId === 'string' ? params.itemId : '';
  const [groupId, setGroupId] = useState<string>('');

  useEffect(() => {
    if (!itemId) return;
    const stored = sessionStorage.getItem(`groupId_for_${itemId}`);
    if (stored) setGroupId(stored);
  }, [itemId]);

  return <PurchaseInvoiceTaskPage taskIdOverride={itemId} isGroup={true} groupId={groupId} />;
}
