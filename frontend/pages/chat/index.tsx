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
  useAuthGuard();
  const router = useRouter();
  const userId = typeof window !== "undefined" ? parseInt(localStorage.getItem("user_id") || "0") : 0;
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!token) return;

    const fetchUsers = async () => {
      try {
        const res = await fetch("http://localhost:8081/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        console.log("🔍 my_rooms response:", data);
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
        setRooms(
  data
    .map((room: any) => ({
      room_id: room.room_id ?? room.id, // 念のため fallback
      display_name: room.display_name ?? room.room_name ?? "(No Name)",
      created_at: room.created_at,
      last_message_time: room.last_message_time,
    }))
    .sort(
      (a: Room, b: Room) =>
        new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
    )
);

      } catch {
        setError("ルームの取得に失敗しました");
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
    } catch {
      setError("チャットルームの作成に失敗しました");
    }
  };

  const toggleSelectUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const createGroup = async () => {
  if (!groupName.trim()) {
    setFormError("グループ名を入力してください");
    return;
  }
  if (selectedUserIds.length < 2) {
    setFormError("2人以上のメンバーを選択してください");
    return;
  }

  try {
    setFormError("");

    const res = await fetch("http://localhost:8081/create_group", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ group_name: groupName, member_ids: selectedUserIds }),
    });

    if (!res.ok) throw new Error("グループ作成失敗");
    const data = await res.json();

    // 🔄 最新のルーム情報を取得しなおす
    const resRooms = await fetch("http://localhost:8081/my_rooms", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const roomsData = await resRooms.json();
    setRooms(roomsData);

    router.push(`/chat/${data.room_id}`);
  } catch (e: any) {
    setFormError("既存のグループが存在するか、作成に失敗しました");
  }
};


  const handleToggleGroupForm = () => {
    if (showGroupForm) {
      setGroupName("");
      setSelectedUserIds([]);
      setFormError("");
    }
    setShowGroupForm(!showGroupForm);
  };

  const handleDeleteRoom = async (roomId: number) => {
  if (!confirm("このルームを削除しますか？")) return;

  try {
    const res = await fetch("http://localhost:8081/delete_room", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ room_id: roomId }),
    });

    if (!res.ok) {
      const text = await res.text();
      alert("削除に失敗：" + text);
      return;
    }

    // 成功したら再取得
    const resRooms = await fetch("http://localhost:8081/my_rooms", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const roomsData = await resRooms.json();
    setRooms(roomsData);
    alert("ルームを削除しました");
  } catch (e) {
    alert("通信エラー");
    console.error(e);
  }
};


  return (
    <div style={{ display: "flex", height: "100vh", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 2rem", backgroundColor: "#fff", borderBottom: "1px solid #eee" }}>
        <h1 style={{ fontSize: "1.5rem", color: "#2d3142", fontWeight: "bold", cursor: "pointer" }} onClick={() => router.push("/chat")}>Chat_app</h1>
        <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user_id"); router.push("/login"); }} style={{ padding: "0.5rem 1rem", backgroundColor: "#f0616d", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>ログアウト</button>
      </header>

      <div style={{ display: "flex", flex: 1, backgroundColor: "#fefefe" }}>
        <aside style={{ width: "50%", backgroundColor: "#f9f9f9", padding: "1.5rem 1rem", borderRight: "1px solid #f1dcdc" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#2d3142", marginBottom: "1rem" }}>友だち</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {users.filter((user) => user.id !== userId).map((user) => (
              <li key={user.id}>
                <button onClick={() => startChat(user.id)} style={{ border: "none", width: "100%", padding: "0.8rem 1rem", borderRadius: "12px", cursor: "pointer", fontWeight: 600, fontSize: "1rem", textAlign: "left", backgroundColor: "#e6e9f0" }}>{user.username}</button>
              </li>
            ))}
          </ul>
        </aside>

        <aside style={{ width: "50%", backgroundColor: "#fff5f4", padding: "1.5rem 1rem", borderLeft: "1px solid #f1dcdc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#2d3142", marginBottom: "1rem" }}>ルーム一覧</h3>
            <button onClick={handleToggleGroupForm} style={{ padding: "0.3rem 0.7rem", backgroundColor: showGroupForm ? "#ccc" : "#f0616d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>{showGroupForm ? "中止する" : "＋グループ作成"}</button>
          </div>

          {showGroupForm ? (
            <div style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#fff" }}>
              <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="グループ名" style={{ width: "100%", padding: "0.6rem 0.8rem", marginBottom: "0.8rem", borderRadius: "8px", border: "1px solid #ccc", fontSize: "1rem" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.8rem" }}>
                {users.filter((u) => u.id !== userId).map((u) => (
                  <button key={u.id} onClick={() => toggleSelectUser(u.id)} style={{ width: "100%", padding: "0.6rem 0.9rem", borderRadius: "12px", border: "none", textAlign: "left", fontWeight: 600, fontSize: "1rem", backgroundColor: selectedUserIds.includes(u.id) ? "#f0616d" : "#e6e9f0", color: selectedUserIds.includes(u.id) ? "#fff" : "#2d3142" }}>
                    {u.username}
                  </button>
                ))}
              </div>

              {formError && <div style={{ color: "red", fontSize: "0.9rem", marginBottom: "0.5rem" }}>{formError}</div>}
              <button onClick={createGroup} style={{ marginTop: "0.8rem", width: "100%", padding: "0.7rem", backgroundColor: "#f0616d", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "1rem" }}>作成する</button>
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {rooms.map((room) => (
  <li key={room.room_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <button
      onClick={() => router.push(`/chat/${room.room_id}`)}
      style={{
        flexGrow: 1,
        border: "none",
        outline: "none",
        padding: "0.8rem 1rem",
        borderRadius: "12px",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: "1rem",
        textAlign: "left",
        backgroundColor: String(room.room_id) === router.query.room_id ? "#f0616d" : "#ffecec",
        color: String(room.room_id) === router.query.room_id ? "#fff" : "#2d3142",
        marginRight: "0.5rem",
      }}
    >
      {room.display_name}
    </button>
    <button
      onClick={() => handleDeleteRoom(room.room_id)}
      title="ルーム削除"
      style={{
        backgroundColor: "#ffecec",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        padding: "0.4rem 0.6rem",
        cursor: "pointer",
      }}
    >
      🗑
    </button>
  </li>
))}

            
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}