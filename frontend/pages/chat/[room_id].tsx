import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuthGuard } from "../../utils/authGuard";

// 型定義
type Room = {
  room_id: number;
  display_name: string;
  created_at: string;
  last_message_time: string; // 新しいメッセージの時間
};

type Message = {
  id: number;
  room_id: number;
  sender_id: number;
  content: string;
  created_at: string;
};

export default function ChatRoomPage() {
  useAuthGuard();

  const router = useRouter();
  const { room_id } = router.query;

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const userId = typeof window !== "undefined" ? parseInt(localStorage.getItem("user_id") || "0") : 0;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  // ルーム一覧を新しいメッセージ順に並べる
  useEffect(() => {
    if (!token) return;

    const fetchRooms = async () => {
      try {
        const res = await fetch("http://localhost:8081/my_rooms", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        // 新しいメッセージがあるルームが上に来るように並べる
        setRooms(data.sort((a: Room, b: Room) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()));
      } catch {
        setRooms([]);
      }
    };

    fetchRooms();
  }, [token]);

  useEffect(() => {
    if (!token || typeof room_id !== "string") return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`http://localhost:8081/messages?room_id=${room_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      } catch {
        setMessages([]);
        setError("メッセージの取得に失敗しました");
      }
    };

    fetchMessages();
  }, [room_id, token]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || typeof room_id !== "string") return;

    try {
      const res = await fetch("http://localhost:8081/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          room_id: parseInt(room_id),
          sender_id: userId,
          content: input,
        }),
      });

      if (!res.ok) throw new Error();

      const newMsg = await res.json();
      setMessages((prev) => [newMsg, ...prev]);
      setInput("");
    } catch {
      setError("送信に失敗しました");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* ヘッダー */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 2rem", backgroundColor: "#fff", borderBottom: "1px solid #eee" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <h1 style={{ fontSize: "1.5rem", color: "#2d3142", fontWeight: "bold", cursor: "pointer" }} onClick={() => router.push("/chat")}>Chat_app</h1>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {/* ログアウトボタン */}
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("user_id");
              router.push("/login");
            }}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#f0616d", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* メイン画面 */}
      <div style={styles.page}>
        {/* ルーム一覧 */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarTitleContainer}>
            {/* 戻るボタン */}
            <button
              onClick={() => router.push("/chat")}
              style={{ padding: "0.4rem 0.75rem", fontSize: "0.9rem", color: "#2d3142", backgroundColor: "transparent", border: "1px solid #ccc", borderRadius: "8px", cursor: "pointer" }}
            >
              戻る
            </button>
            <h3 style={styles.sidebarTitle}>ルーム一覧</h3>
          </div>
          <ul style={styles.roomList}>
            {rooms.map((room) => (
              <li key={room.room_id} style={styles.roomItem}>
                <button
                  onClick={() => router.push(`/chat/${room.room_id}`)}
                  style={{
                    ...styles.roomButton,
                    backgroundColor: String(room.room_id) === room_id ? "#f0616d" : "#ffecec",
                    color: String(room.room_id) === room_id ? "#fff" : "#2d3142",
                    boxShadow: String(room.room_id) === room_id ? "0 2px 8px rgba(0, 0, 0, 0.15)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                    transform: String(room.room_id) === room_id ? "scale(1.02)" : "none",
                  }}
                >
                  {room.display_name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* チャットエリア */}
        <main style={styles.chatArea}>
          <div style={styles.chatHeader}>ルーム #{room_id}</div>

          {error && <p style={styles.error}>{error}</p>}

          <div style={{ ...styles.messageArea, backgroundColor: "#ffffff" }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.messageBox,
                  alignSelf: msg.sender_id === userId ? "flex-end" : "flex-start",
                  backgroundColor: msg.sender_id === userId ? "#f0616d" : "#e6e9f0",
                  color: msg.sender_id === userId ? "#fff" : "#2d3142",
                }}
              >
                <div>{msg.content}</div>
                <div style={styles.timestamp}>{new Date(msg.created_at).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} style={styles.form}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="メッセージを入力..."
              style={styles.input}
            />
            <button type="submit" style={styles.button}>送信</button>
          </form>
        </main>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    display: "flex",
    flex: 1,
    backgroundColor: "#fefefe",
  },
  sidebar: {
    width: "300px", // ルーム一覧のリスト幅は変更せずに維持
    backgroundColor: "#fff5f4",
    padding: "1.5rem 1rem",
    borderRight: "1px solid #f1dcdc",
    boxShadow: "2px 0 6px rgba(0,0,0,0.03)",
  },
  sidebarTitleContainer: {
    display: "flex",
    gap: "1rem",
    alignItems: "center",
    marginBottom: "1rem",
  },
  sidebarTitle: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#2d3142",
  },
  roomList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  messageArea: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    padding: "1rem 0.5rem",
    borderRadius: "10px",
    marginBottom: "1.5rem",
  },
  messageBox: {
    maxWidth: "70%",
    padding: "0.75rem 1rem",
    borderRadius: "16px",
    fontSize: "1rem",
    lineHeight: "1.4",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  timestamp: {
    fontSize: "0.7rem",
    textAlign: "right",
    opacity: 0.6,
    marginTop: "0.3rem",
  },
  roomItem: {
    borderRadius: "12px",
  },
  roomButton: {
    border: "none",
    outline: "none",
    display: "block",
    width: "100%",
    padding: "0.8rem 1rem",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "1rem",
    textAlign: "left",
    transition: "all 0.2s ease",
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "2rem",
    backgroundColor: "#ffffff",
  },
  chatHeader: {
    fontSize: "1.4rem",
    fontWeight: "bold",
    color: "#2d3142",
    marginBottom: "1.2rem",
    borderBottom: "1px solid #eee",
    paddingBottom: "0.5rem",
    textAlign: "left",
  },
  error: {
    color: "red",
    textAlign: "center",
    marginBottom: "1rem",
  },
  form: {
    display: "flex",
    gap: "0.75rem",
  },
  input: {
    flex: 1,
    padding: "0.75rem 1rem",
    borderRadius: "12px",
    border: "1px solid #ccc",
    fontSize: "1rem",
  },
  button: {
    backgroundColor: "#f0616d",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "0.75rem 1.5rem",
    fontWeight: "bold",
    fontSize: "1rem",
    cursor: "pointer",
  },
};
