import { useState } from "react";
import { ConversationList } from "../../components/ConversationList.js";
import { ConversationDetail } from "../../components/ConversationDetail.js";
import { NewConversationPanel } from "../../components/NewConversationPanel.js";
import { ManageFamilyPanel } from "../../components/ManageFamilyPanel.js";
import { RealtimeConnection } from "../../components/RealtimeConnection.js";
import { NotificationsToggle } from "../../components/NotificationsToggle.js";
import { Avatar } from "../../components/Avatar.js";
import { logout } from "../../api/auth.js";
import { useAuthStore } from "../../store/auth.js";

export function ConversationsPage() {
  const user = useAuthStore((state) => state.user);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showManageFamily, setShowManageFamily] = useState(false);

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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowNewConversation((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-600 shadow hover:bg-emerald-50"
            >
              💬 Nouvelle discussion
            </button>
            {user?.role === "parent" && (
              <button
                onClick={() => setShowManageFamily((v) => !v)}
                className="flex items-center gap-1 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30"
              >
                👨‍👩‍👧 Famille
              </button>
            )}
            <NotificationsToggle />
            <button
              onClick={handleLogout}
              className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30"
            >
              🚪 Sortir
            </button>
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
          <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </aside>

      <main className={`${selectedId ? "flex" : "hidden md:flex"} min-h-0 flex-1 flex-col overflow-hidden`}>
        {selectedId ? (
          <ConversationDetail conversationId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">
            <span className="text-5xl">💬</span>
            <p className="text-lg">Choisis une discussion pour commencer !</p>
          </div>
        )}
      </main>
    </div>
  );
}
