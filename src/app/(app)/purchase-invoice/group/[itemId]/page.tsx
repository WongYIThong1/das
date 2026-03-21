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
  const [isResolvingTask, setIsResolvingTask] = useState(true);
  const [resolveError, setResolveError] = useState<string>('');

  useEffect(() => {
    if (!itemId) {
      setIsResolvingTask(false);
      setResolveError('Batch item ID is missing.');
      return;
    }

    // Pre-load from sessionStorage immediately so the UI isn't blank
    const storedGroupId = sessionStorage.getItem(`groupId_for_${itemId}`);
    if (storedGroupId) setGroupId(storedGroupId);
    const storedImageUrl = sessionStorage.getItem(`imageUrl_for_${itemId}`);
    if (storedImageUrl) setEarlyImageUrl(storedImageUrl);

    if (!accessToken) {
      setIsResolvingTask(true);
      return;
    }

    setIsResolvingTask(true);
    setResolveError('');

    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    fetch(`/api/purchase-invoice/batch/item?itemId=${encodeURIComponent(itemId)}`, {
      headers,
      cache: 'no-store',
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data: { item?: { groupId?: string; taskId?: string }; task?: { fileServer?: { imageUrl?: string } } } | null) => {
        if (data?.item?.groupId) setGroupId(data.item.groupId);
        if (data?.item?.taskId) {
          setTaskId(data.item.taskId);
          setResolveError('');
        } else {
          setResolveError('Preview task is still being prepared. Please wait a moment and try again.');
        }
        if (data?.task?.fileServer?.imageUrl) setEarlyImageUrl(data.task.fileServer.imageUrl);
      })
      .catch(() => {
        setResolveError('Unable to resolve the batch item preview yet.');
      })
      .finally(() => {
        setIsResolvingTask(false);
      });
  }, [itemId, accessToken]);

  if (isResolvingTask || !taskId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-zinc-800">
            {resolveError || 'Resolving batch item preview…'}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Batch `itemId` and preview `taskId` are different. The preview page will open as soon as the task is ready.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PurchaseInvoiceTaskPage
      taskIdOverride={taskId}
      isGroup={true}
      groupId={groupId}
      earlyImageUrlOverride={earlyImageUrl || undefined}
      groupItemIdOverride={itemId}
      onGroupItemResolved={({ groupId: nextGroupId, taskId: nextTaskId, imageUrl }) => {
        if (nextGroupId) setGroupId(nextGroupId);
        if (nextTaskId) setTaskId(nextTaskId);
        if (imageUrl) {
          setEarlyImageUrl(imageUrl);
          sessionStorage.setItem(`imageUrl_for_${itemId}`, imageUrl);
        }
        if (nextGroupId) {
          sessionStorage.setItem(`groupId_for_${itemId}`, nextGroupId);
        }
      }}
    />
  );
}
