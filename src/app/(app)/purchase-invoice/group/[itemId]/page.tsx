'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../../../components/AuthProvider';
import PurchaseInvoiceTaskPage from '../../[taskId]/page';

export default function GroupItemPage() {
  const params = useParams();
  const itemId = typeof params.itemId === 'string' ? params.itemId : '';
  const { accessToken } = useAuth();
  const [groupId, setGroupId] = useState<string>('');
  const [taskId, setTaskId] = useState<string>('');
  const [earlyImageUrl, setEarlyImageUrl] = useState<string>('');

  useEffect(() => {
    if (!itemId || !accessToken) return;

    // Pre-load from sessionStorage immediately so the UI isn't blank
    const storedGroupId = sessionStorage.getItem(`groupId_for_${itemId}`);
    if (storedGroupId) setGroupId(storedGroupId);
    const storedImageUrl = sessionStorage.getItem(`imageUrl_for_${itemId}`);
    if (storedImageUrl) setEarlyImageUrl(storedImageUrl);

    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    fetch(`/api/purchase-invoice/batch/item?itemId=${encodeURIComponent(itemId)}`, {
      headers,
      cache: 'no-store',
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data: { item?: { groupId?: string; taskId?: string }; task?: { fileServer?: { imageUrl?: string } } } | null) => {
        if (data?.item?.groupId) setGroupId(data.item.groupId);
        if (data?.item?.taskId) setTaskId(data.item.taskId);
        if (data?.task?.fileServer?.imageUrl) setEarlyImageUrl(data.task.fileServer.imageUrl);
      })
      .catch(() => { /* keep sessionStorage values */ });
  }, [itemId, accessToken]);

  // Use taskId once resolved; fall back to itemId while loading
  const resolvedTaskId = taskId || itemId;

  return (
    <PurchaseInvoiceTaskPage
      taskIdOverride={resolvedTaskId}
      isGroup={true}
      groupId={groupId}
      earlyImageUrlOverride={earlyImageUrl || undefined}
    />
  );
}
