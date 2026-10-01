import { useState } from "react";
import { LogOut } from "lucide-react";

export function SignOutButton({
  panel,
  onConfirm,
}: {
  panel: "Admin" | "Procurement" | "SubHub";
  onConfirm: () => void | Promise<void>;
}) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setError("");

    try {
      await onConfirm();
    } catch (cause) {
      console.error(`Failed to sign out of ${panel}.`, cause);
      setError("Sign-out failed. Please try again.");
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={isSigningOut ? `Signing out of ${panel}` : `Sign out of ${panel}`}
        aria-busy={isSigningOut}
        title={error || `Sign out of ${panel}`}
        disabled={isSigningOut}
        onClick={() => void handleSignOut()}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground disabled:cursor-wait disabled:opacity-50"
      >
        <LogOut className="size-5" />
      </button>
      {error ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}
    </>
  );
}
