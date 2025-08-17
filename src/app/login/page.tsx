"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // check session
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
    });

    // listen to changes
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const loginWithDiscord = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        scopes: "identify email", // email optional
      },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div>
      {authed ? (
        <>
          <p>You’re logged in ✅</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={loginWithDiscord}>Login with Discord</button>
      )}
    </div>
  );
}
