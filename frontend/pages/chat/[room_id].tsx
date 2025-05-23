import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useAuthGuard } from "../../utils/authGuard";

type Room = {
  room_id: number;
  display_name: string;
  created_at: string;
  last_message_time: string;
};

type Message = {
  id: number;
  room_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  read_by?: number[];
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

  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!room_id || typeof room_id !== "string" || !token) return;

    const socket = new WebSocket(`ws://localhost:8081/ws?room_id=${room_id}&token=${token}`);
    socketRef.current = socket;

    socket.onopen = () => console.log("✅ WebSocket connected");

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message_read") {
        const { message_id, user_id } = data;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === message_id && !msg.read_by?.includes(user_id)
              ? { ...msg, read_by: [...(msg.read_by || []), user_id] }
              : msg
          )
        );
      } else {
        const newMsg: Message = data;
        if (newMsg.sender_id !== userId) {
          setMessages((prev) =>
            prev.some((msg) => msg.id === newMsg.id) ? prev : [...prev, newMsg]
          );
        }
      }
    };

    socket.onclose = () => console.log("🔌 WebSocket disconnected");
    socket.onerror = (e) => console.error("❌ WebSocket error:", e);

    return () => socket.close();
  }, [room_id, token, userId]);

    useEffect(() => {
    if (!token) return;
    fetch("http://localhost:8081/my_rooms", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) =>
        setRooms(
          data.sort((a: Room, b: Room) =>
            new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
          )
        )
      )
      .catch(() => setRooms([]));
  }, [token]);

  useEffect(() => {
    if (!token || typeof room_id !== "string") return;
    fetch(`http://localhost:8081/messages?room_id=${room_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => {
        setMessages([]);
        setError("メッセージの取得に失敗しました");
      });
  }, [room_id, token]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✅ 未読メッセージを既読にする処理（WebSocket通知）
  useEffect(() => {
    if (!messages.length || !token || !userId || !socketRef.current) return;

    const unreadMessages = messages.filter(
      (msg) =>
        msg.sender_id !== userId &&
        (!msg.read_by || !msg.read_by.includes(userId))
    );

    unreadMessages.forEach((msg) => {
      socketRef.current?.send(
        JSON.stringify({
          type: "message_read",
          message_id: msg.id,
          user_id: userId,
        })
      );
    });
  }, [messages, token, userId]);

  const sendMessage = async (content: string) => {
    try {
      const res = await fetch("http://localhost:8081/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          room_id: parseInt(room_id as string),
          sender_id: userId,
          content,
        }),
      });

      if (!res.ok) throw new Error();
      const newMsg: Message = await res.json();

      setMessages((prev) => [...prev, newMsg]);
      socketRef.current?.send(JSON.stringify({ ...newMsg, type: "message" }));
    } catch {
      setError("送信に失敗しました");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || typeof room_id !== "string") return;
    await sendMessage(input);
    setInput("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("http://localhost:8081/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.url) {
        await sendMessage(data.url); // 画像URLを送信
      }
    } catch {
      alert("画像アップロードに失敗しました");
    }
  };

    const currentRoom = rooms.find((room) => String(room.room_id) === String(room_id));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 2rem", backgroundColor: "#fff", borderBottom: "1px solid #eee" }}>
        <h1 style={{ fontSize: "1.5rem", color: "#2d3142", fontWeight: "bold", cursor: "pointer" }} onClick={() => router.push("/chat")}>Chat_app</h1>
        <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user_id"); router.push("/login"); }} style={{ padding: "0.5rem 1rem", backgroundColor: "#f0616d", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>ログアウト</button>
      </header>

      <div style={{ display: "flex", flex: 1, height: "calc(100vh - 72px)", overflow: "hidden" }}>
        <aside style={{ width: "300px", backgroundColor: "#fff5f4", padding: "1.5rem 1rem", borderRight: "1px solid #f1dcdc", boxShadow: "2px 0 6px rgba(0,0,0,0.03)", overflowY: "auto" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
            <button onClick={() => router.push("/chat")} style={{ padding: "0.4rem 0.75rem", fontSize: "0.9rem", color: "#2d3142", backgroundColor: "transparent", border: "1px solid #ccc", borderRadius: "8px", cursor: "pointer" }}>戻る</button>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#2d3142", margin: 0 }}>ルーム一覧</h3>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {rooms.map((room) => (
              <li key={room.room_id}>
                <button onClick={() => router.push(`/chat/${room.room_id}`)} style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  padding: "0.8rem 1rem",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "1rem",
                  textAlign: "left",
                  transition: "all 0.2s ease",
                  backgroundColor: String(room.room_id) === room_id ? "#f0616d" : "#ffecec",
                  color: String(room.room_id) === room_id ? "#fff" : "#2d3142",
                }}>{room.display_name}</button>
              </li>
            ))}
          </ul>
        </aside>

                <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2rem", backgroundColor: "#ffffff", overflowY: "auto" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#2d3142", marginBottom: "1.2rem", borderBottom: "1px solid #eee", paddingBottom: "0.5rem", textAlign: "left" }}>
            {currentRoom?.display_name ?? `ルーム #${room_id}`}
          </div>

          {error && <p style={{ color: "red", textAlign: "center", marginBottom: "1rem" }}>{error}</p>}

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem 0.5rem", borderRadius: "10px", marginBottom: "1.5rem" }}>
            {messages.map((msg, index) => {
              const currentDate = new Date(msg.created_at);
              const previousDate = index > 0 ? new Date(messages[index - 1].created_at) : null;
              const showDateSeparator = !previousDate || currentDate.toDateString() !== previousDate.toDateString();

              return (
                <div key={`msg-${msg.id}`}>
                  {showDateSeparator && (
                    <div style={{ textAlign: "center", margin: "1rem 0", color: "#888", fontSize: "0.9rem", fontWeight: "bold" }}>
                      {currentDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" })}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", alignItems: msg.sender_id === userId ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "70%",
                      padding: "0.75rem 1rem",
                      borderRadius: "16px",
                      fontSize: "1rem",
                      lineHeight: "1.4",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      backgroundColor: msg.sender_id === userId ? "#f0616d" : "#e6e9f0",
                      color: msg.sender_id === userId ? "#fff" : "#2d3142",
                    }}>
                      {msg.content.match(/\.(jpg|jpeg|png|gif)$/i) || msg.content.startsWith("/uploads/")
                        ? <img src={`http://localhost:8081${msg.content}`} alt="画像" style={{ maxWidth: "100%", borderRadius: "8px" }} />
                        : <span>{msg.content}</span>}

                      {/* ✅ 既読表示（自分が送信したメッセージにだけ） */}
                      {msg.sender_id === userId && (msg.read_by ?? []).filter(id => id !== userId).length > 0 && (
  <div style={{ fontSize: "0.7rem", color: "#eee", marginTop: "0.2rem", textAlign: "right" }}>
    {(() => {
      const readers = (msg.read_by ?? []).filter(id => id !== userId);
      return readers.length === 1 ? "既読" : `既読${readers.length}`;
    })()}
  </div>
)}

                    </div>
                    <div style={{ fontSize: "0.7rem", textAlign: "right", opacity: 0.6, marginTop: "0.3rem" }}>
                      {currentDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>

          <form onSubmit={handleSend} style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{
              padding: "0.4rem 0.75rem",
              fontSize: "0.9rem",
              backgroundColor: "#ffecec",
              border: "1px solid #ccc",
              borderRadius: "8px",
              color: "#2d3142",
              cursor: "pointer"
            }} />
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="メッセージを入力..." style={{ flex: 1, padding: "0.75rem 1rem", borderRadius: "12px", border: "1px solid #ccc", fontSize: "1rem" }} />
            <button type="submit" style={{ backgroundColor: "#f0616d", color: "#fff", border: "none", borderRadius: "12px", padding: "0.75rem 1.5rem", fontWeight: "bold", fontSize: "1rem", cursor: "pointer" }}>送信</button>
          </form>
        </main>
      </div>
    </div>
  );
}


