import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, authBootstrap } from "../lib/supabase";
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    let revision = 0;
    let verifiedToken: string | undefined;
    let verifiedUser: string | undefined;
    async function verify(next: Session | null, expected: number) {
      if (!alive || revision !== expected) return;
      if (!next) {
        setSession(null);
        setReady(true);
        return;
      }
      // Stored tokens alone must never unlock the dashboard.
      try {
        const { data, error } = await supabase!.auth.getUser(next.access_token);
        if (alive && revision === expected) {
          const verified = !error && data.user?.id === next.user.id;
          verifiedToken = verified ? next.access_token : undefined;
          verifiedUser = verified ? next.user.id : undefined;
          setSession(verified ? next : null);
          setReady(true);
        }
      } catch {
        if (alive && revision === expected) {
          setSession(null);
          setReady(true);
        }
      }
    }
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      const expected = ++revision;
      if (!alive) return;
      // Password/profile updates keep the same verified session. Preserve the
      // mounted form so its success/error state survives USER_UPDATED events.
      if (next && next.access_token === verifiedToken && next.user.id === verifiedUser) {
        setSession(next);
        setReady(true);
        return;
      }
      if (!next) {
        verifiedToken = undefined;
        verifiedUser = undefined;
      }
      setSession(null);
      setReady(!next);
      // Leave the SDK callback before starting another Auth request.
      if (next) window.setTimeout(() => void verify(next, expected), 0);
    });
    void authBootstrap.then(async () => {
      if (!alive) return;
      const expected = revision;
      const result = await supabase!.auth.getSession();
      await verify(result.error ? null : result.data.session, expected);
    }).catch(() => {
      if (alive) { setSession(null); setReady(true); }
    });
    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, []);
  return { session, ready };
}
