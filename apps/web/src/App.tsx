import { AuthProvider, useAuth } from "./store/auth";
import { AuthPage } from "./pages/AuthPage";
import { ChatPage } from "./pages/ChatPage";

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Realtime Chat</h1>
          <p className="subtitle">Loading session…</p>
        </div>
      </div>
    );
  }

  return user ? <ChatPage /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}