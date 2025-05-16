import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuthGuard } from "../../utils/authGuard";

// ユーザー型（新規チャット用）
type User = {
  id: number;
  username: string;
};

// バックエンドから返ってくるルーム情報
type Room = {
  room_id: number;
  display_name: string; // ← グループ名 or 相手の名前
  is_group: boolean;
  created_at: string;
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
        setUsers(data);
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
        setRooms(Array.isArray(data) ? data : []);
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
    <div style={{ padding: "2rem" }}>
      <h2>ようこそ！チャットルームへ</h2>
      <button
        onClick={() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user_id");
          router.push("/login");
        }}
      >
        ログアウト
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>ルーム一覧</h3>
      <ul>
        {rooms.map((room) => (
          <li key={room.room_id}>
            <button onClick={() => router.push(`/chat/${room.room_id}`)}>
              {room.display_name}
            </button>
          </li>
        ))}
      </ul>

      <h3>ユーザー一覧（新しくチャットを始める）</h3>
      <ul>
        {users
          .filter((user) => user.id !== userId) // 👈 自分は除く
          .map((user) => (
            <li key={user.id}>
              <button onClick={() => startChat(user.id)}>{user.username}</button>
            </li>
          ))}
      </ul>
    </div>
  );
}
