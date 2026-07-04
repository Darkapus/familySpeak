import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConversationList } from "../../components/ConversationList.js";
import { ConversationDetail } from "../../components/ConversationDetail.js";
import { NewConversationPanel } from "../../components/NewConversationPanel.js";
import { ManageFamilyPanel } from "../../components/ManageFamilyPanel.js";
import { RealtimeConnection } from "../../components/RealtimeConnection.js";
import { NotificationsToggle } from "../../components/NotificationsToggle.js";
import { UserProfileModal } from "../../components/UserProfileModal.js";
import { Avatar } from "../../components/Avatar.js";
import { logout } from "../../api/auth.js";
import { useAuthStore } from "../../store/auth.js";

export function ConversationsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showManageFamily, setShowManageFamily] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [profileTarget, setProfileTarget] = useState<{ userId: string; displayName: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  async function handleLogout() {
    await logout().catch(() => {});
    useAuthStore.getState().clear();
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-white">
      <RealtimeConnection />
      <aside
        className={`${selectedId ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col overflow-hidden border-slate-200 md:w-96 md:border-r`}
      >
        <div className="space-y-3 border-b border-slate-100 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-4">
          <div className="flex items-center gap-3">
            {user && <Avatar id={user.id} name={user.displayName} size="lg" />}
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-white">{user?.displayName}</p>
              <p className="text-sm text-emerald-50">Salut ! 👋</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewConversation((v) => !v)}
              className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-emerald-600 shadow hover:bg-emerald-50"
            >
              💬 Nouvelle discussion
            </button>
            <button
              onClick={() => navigate("/game")}
              aria-label="Espace de jeu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg text-white hover:bg-white/30"
            >
              🧱
            </button>
            {user?.role === "parent" && (
              <button
                onClick={() => setShowManageFamily((v) => !v)}
                aria-label="Gérer la famille"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg text-white hover:bg-white/30"
              >
                👨‍👩‍👧
              </button>
            )}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                aria-label="Plus d'options"
                aria-expanded={showMenu}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-xl font-bold leading-none text-white hover:bg-white/30"
              >
                ⋮
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl bg-white py-1 text-slate-600 shadow-xl">
                  <NotificationsToggle />
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold hover:bg-slate-50"
                  >
                    🚪 Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {showManageFamily && <ManageFamilyPanel onClose={() => setShowManageFamily(false)} />}
        {showNewConversation && (
          <NewConversationPanel
            onClose={() => setShowNewConversation(false)}
            onCreated={(id) => {
              setSelectedId(id);
              setShowNewConversation(false);
            }}
          />
        )}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <ConversationList
            selectedId={selectedId}
            onSelect={setSelectedId}
            onStartNewConversation={() => setShowNewConversation(true)}
            onOpenProfile={(userId, displayName) => setProfileTarget({ userId, displayName })}
          />
        </div>
      </aside>

      <main className={`${selectedId ? "flex" : "hidden md:flex"} min-h-0 flex-1 flex-col overflow-hidden`}>
        {selectedId ? (
          <ConversationDetail
            conversationId={selectedId}
            onBack={() => setSelectedId(null)}
            onOpenProfile={(userId, displayName) => setProfileTarget({ userId, displayName })}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">
            <span className="text-5xl">💬</span>
            <p className="text-lg">Choisis une discussion pour commencer !</p>
          </div>
        )}
      </main>

      {profileTarget && (
        <UserProfileModal
          userId={profileTarget.userId}
          displayName={profileTarget.displayName}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </div>
  );
}
