import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuthGuard } from "../../utils/authGuard";

// 型定義
type User = {
  id: number;
  username: string;
};

type Room = {
  room_id: number;
  display_name: string;
  created_at: string;
  last_message_time: string;
};

export default function ChatHome() {
  useAuthGuard(); // 🔐 認証ガード

  const router = useRouter();
  const userId =
    typeof window !== "undefined"
      ? parseInt(localStorage.getItem("user_id") || "0")
      : 0;

  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ユーザー一覧とルーム一覧を取得
  useEffect(() => {
    if (!token) return;

    const fetchUsers = async () => {
      try {
        const res = await fetch("http://localhost:8081/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        // あいうえお順に並べる
        setUsers(data.sort((a: User, b: User) => a.username.localeCompare(b.username)));
      } catch {
        setError("ユーザーの取得に失敗しました");
      }
    };

    const fetchRooms = async () => {
      try {
        const res = await fetch("http://localhost:8081/my_rooms", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        // 新しいメッセージがあるルームを上に並べる
        setRooms(data.sort((a: Room, b: Room) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()));
      } catch {
        setError("ルームの取得に失敗しました");
      }
    };

    fetchUsers();
    fetchRooms();
  }, [token]);

  // チャット開始（1対1）
  const startChat = async (receiverID: number) => {
    try {
      const res = await fetch("http://localhost:8081/start_chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiver_id: receiverID }),
      });

      if (!res.ok) throw new Error("チャット作成失敗");

      const data = await res.json();
      router.push(`/chat/${data.room_id}`);
    } catch (err) {
      setError("チャットルームの作成に失敗しました");
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
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
        {/* 友だち一覧 */}
        <aside style={styles.userSidebar}>
          <h3 style={styles.sidebarTitle}>友だち</h3>
          <ul style={styles.userList}>
            {users
              .filter((user) => user.id !== userId) // 自分を除外
              .map((user) => (
                <li key={user.id} style={styles.userItem}>
                  <button onClick={() => startChat(user.id)} style={styles.userButton}>
                    {user.username}
                  </button>
                </li>
              ))}
          </ul>
        </aside>

        {/* ルーム一覧 */}
        <aside style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>ルーム一覧</h3>
          <ul style={styles.roomList}>
            {rooms.map((room) => (
              <li key={room.room_id} style={styles.roomItem}>
                <button
                  onClick={() => router.push(`/chat/${room.room_id}`)}
                  style={{
                    ...styles.roomButton,
                    backgroundColor: String(room.room_id) === router.query.room_id ? "#f0616d" : "#ffecec",
                    color: String(room.room_id) === router.query.room_id ? "#fff" : "#2d3142",
                    boxShadow: String(room.room_id) === router.query.room_id ? "0 2px 8px rgba(0, 0, 0, 0.15)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                    transform: String(room.room_id) === router.query.room_id ? "scale(1.02)" : "none",
                  }}
                >
                  {room.display_name}
                </button>
              </li>
            ))}
          </ul>
        </aside>
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
  userSidebar: {
    width: "50%",
    backgroundColor: "#f9f9f9",
    padding: "1.5rem 1rem",
    borderRight: "1px solid #f1dcdc",
    boxShadow: "2px 0 6px rgba(0,0,0,0.03)",
  },
  sidebar: {
    width: "50%",
    backgroundColor: "#fff5f4",
    padding: "1.5rem 1rem",
    borderLeft: "1px solid #f1dcdc",
    boxShadow: "2px 0 6px rgba(0,0,0,0.03)",
  },
  sidebarTitle: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#2d3142",
    marginBottom: "1rem",
  },
  roomList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  userList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  roomItem: {
    borderRadius: "12px",
  },
  userItem: {
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
  userButton: {
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
    backgroundColor: "#e6e9f0",
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
};
