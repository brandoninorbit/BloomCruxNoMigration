import { useEffect, useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { listFolders } from '@/lib/repos/foldersRepo';

export default function useFolders() {
  const user = useUser();
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
