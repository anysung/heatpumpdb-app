import { useEffect, useMemo, useState } from 'react';
import type { User } from '../../../types';
import { Project } from './projectModel';
import { projectBackend, ProjectBackend } from './projectStore';

/** Live project list for the signed-in user (personal or team). Subscribes only while `enabled`. */
export function useProjects(user: Pick<User, 'id' | 'orgId'>, enabled: boolean): {
  backend: ProjectBackend;
  projects: Project[] | null;
  error: boolean;
} {
  const backend = useMemo(() => projectBackend(user), [user.id, user.orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    setError(false);
    return backend.subscribe(
      list => setProjects(list),
      e => { console.warn('[projects] subscribe failed', e); setError(true); setProjects(p => p ?? []); },
    );
  }, [backend, enabled]);
  return { backend, projects, error };
}
