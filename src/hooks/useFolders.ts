import { useEffect, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { listFolders } from '@/lib/repos/foldersRepo';

export default function useFolders() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    if (user?.id) {
      listFolders(user.id)
        .then(setFolders)
        .catch(() => setFolders([]));
    } else {
      setFolders([]);
    }
  }, [user]);
  return folders;
}
