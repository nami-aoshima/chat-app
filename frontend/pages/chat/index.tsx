import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuthGuard } from "../../utils/authGuard"; // 認証ガード

type User = {
  id: number;
  username: string;
};

type Room = {
  room_id: number;
  room_name: string;
  is_group: boolean;
  created_at: string;
};

export default function ChatHome() {
  useAuthGuard(); // 🔐 認証チェック
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // 🔽 ログアウト関数
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    router.push("/login");
  };

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
        setError("ユーザー一覧の取得に失敗しました");
      }
    };

    const fetchRooms = async () => {
      try {
        const res = await fetch("http://localhost:8081/my_rooms", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setRooms(data);
      } catch {
        setError("ルーム一覧の取得に失敗しました");
      }
    };

    fetchUsers();
    fetchRooms();
  }, [token]);

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

      {/* 🔽 ログアウトボタン */}
      <button onClick={handleLogout} style={{ marginBottom: "1.5rem" }}>
        ログアウト
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>ルーム一覧</h3>
      <ul>
        {rooms.map((room) => (
          <li key={room.room_id}>
            <button onClick={() => router.push(`/chat/${room.room_id}`)}>
              {room.room_name || `Room ${room.room_id}`}
            </button>
          </li>
        ))}
      </ul>

      <h3>ユーザー一覧（新しくチャットを始める）</h3>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            <button onClick={() => startChat(user.id)}>{user.username}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
