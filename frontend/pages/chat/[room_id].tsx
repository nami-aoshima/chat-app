import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useAuthGuard } from "../../utils/authGuard";

type Room = {
  room_id: number;
  display_name: string;
  created_at: string;
  last_message_time: string;
  unread_count: number;
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
  const socketMapRef = useRef<Map<number, WebSocket>>(new Map());
  const roomIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (typeof room_id === "string") {
      roomIdRef.current = room_id;
    }
  }, [room_id]);

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
    if (!token || rooms.length === 0) return;

    rooms.forEach((room) => {
      const roomId = room.room_id;
      if (socketMapRef.current.has(roomId)) return;

      const ws = new WebSocket(`ws://localhost:8081/ws?room_id=${roomId}&token=${token}`);

      ws.onopen = () => {
        console.log(`✅ WS OPEN: room ${roomId}`);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "message") {
          const newMsg: Message = data;
          const isCurrentRoom = String(newMsg.room_id) === roomIdRef.current;

          if (newMsg.sender_id !== userId) {
            if (isCurrentRoom) {
              setMessages((prev) =>
                prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]
              );
            } else {
              setRooms((prev) =>
                prev.map((r) =>
                  r.room_id === newMsg.room_id ? { ...r, unread_count: r.unread_count + 1 } : r
                )
              );
            }
          }
        } else if (data.type === "message_read") {
          const { message_id, user_id, room_id: readRoomId } = data;

          if (String(readRoomId) === roomIdRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === message_id && !msg.read_by?.includes(user_id)
                  ? { ...msg, read_by: [...(msg.read_by || []), user_id] }
                  : msg
              )
            );
          }

          // バッジ減らす（他ルーム）
          setRooms((prevRooms) =>
  prevRooms.map((room) => {
    if (String(room.room_id) === roomIdRef.current) {
      return { ...room, unread_count: 0 };
    }
    return room;
  })
);
        }
      };

      ws.onclose = () => console.log(`🔌 WS CLOSED: room ${roomId}`);
      ws.onerror = (e) => console.error("❌ WebSocket error:", e);

      socketMapRef.current.set(roomId, ws);
    });

    return () => {
      socketMapRef.current.forEach((s) => s.close());
      socketMapRef.current.clear();
    };
  }, [rooms, token]);

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

  useEffect(() => {
    if (!messages.length || !token || !userId) return;
    const currentRoomId = parseInt(room_id as string);
    const socket = socketMapRef.current.get(currentRoomId);

    const unreadMessages = messages.filter(
      (msg) =>
        msg.sender_id !== userId &&
        (!msg.read_by || !msg.read_by.includes(userId))
    );

    if (socket && socket.readyState === WebSocket.OPEN) {
      unreadMessages.forEach((msg) => {
        socket.send(
          JSON.stringify({
            type: "message_read",
            message_id: msg.id,
            user_id: userId,
            room_id: currentRoomId,
          })
        );
      });
    }
  }, [messages, token, userId, room_id]);

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
      const socket = socketMapRef.current.get(parseInt(room_id as string));
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ ...newMsg, type: "message" }));
      }
    } catch {
      setError("送信に失敗しました");
    }
  };

  // ...（以下UI部分は変更不要）


  const currentRoom = rooms.find((room) => String(room.room_id) === String(room_id));

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
      await sendMessage(data.url);
    }
  } catch {
    alert("画像アップロードに失敗しました");
  }
};



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
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#2d3142", margin: 0 }}>ルーム一覧</h3>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {rooms.map((room) => (
              <li key={room.room_id} style={{ borderRadius: "12px" }}>
                <button 
                onClick={() => router.push(`/chat/${room.room_id}`)} 
                style={{
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
                }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{room.display_name}</span>
          {room.unread_count > 0 && (
            <span style={{
              backgroundColor: "#f0616d",
              color: "#fff",
              fontSize: "0.75rem",
              borderRadius: "12px",
              padding: "0.1rem 0.5rem",
              marginLeft: "0.5rem",
              minWidth: "1.5rem",
              textAlign: "center",
              fontWeight: "bold"
            }}>
              {room.unread_count}
            </span>
          )}
        </div>
      </button>
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
              const isImage = msg.content.match(/\.(jpg|jpeg|png|gif)$/i) || msg.content.startsWith("/uploads/");
              const readers = (msg.read_by ?? []).filter(id => id !== userId);

              return (
                <div key={`msg-${msg.id}`} style={{ marginBottom: "1.2rem" }}>
                  {showDateSeparator && (
                    <div style={{ textAlign: "center", margin: "1rem 0", color: "#888", fontSize: "0.9rem", fontWeight: "bold" }}>
                      {currentDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" })}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", alignItems: msg.sender_id === userId ? "flex-end" : "flex-start" }}>
                    {isImage ? (
                      <img
                        src={`http://localhost:8081${msg.content}`}
                        alt="画像"
                        style={{ maxWidth: "70%", borderRadius: "8px" }}
                      />
                    ) : (
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
                        <span>{msg.content}</span>
                      </div>
                    )}

                    <div style={{
                      fontSize: "0.7rem",
                      textAlign: "right",
                      opacity: 0.6,
                      marginTop: "0.3rem",
                      display: "flex",
                      gap: "0.5rem"
                    }}>
                      {msg.sender_id === userId && readers.length > 0 && (
                        <span style={{ color: "#888" }}>
                          {readers.length === 1 ? "既読" : `既読${readers.length}`}
                        </span>
                      )}
                      <span>{currentDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>

          <form
  onSubmit={handleSend}
  style={{
    display: "flex",
    gap: "0.5rem",
    marginTop: "auto",
    alignItems: "center",
  }}
>
  <input
    type="text"
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder="メッセージを入力"
    style={{
      flex: 1,
      padding: "0.75rem",
      borderRadius: "8px",
      border: "1px solid #ccc",
      fontSize: "1rem",
    }}
  />

  {/* 画像ボタン（薄ピンク） */}
  <label
    htmlFor="file-upload"
    style={{
      backgroundColor: "#ffecec",
      color: "#2d3142",
      padding: "0.6rem 1rem",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "0.9rem",
      border: "1px solid #f1dcdc",
      transition: "background-color 0.2s ease",
    }}
    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#fcdcdc")}
    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#ffecec")}
  >
     ファイルを選択
  </label>
  <input
    id="file-upload"
    type="file"
    accept="image/*"
    onChange={handleImageUpload}
    style={{ display: "none" }}
  />

  {/* 送信ボタン（同じ形状で濃い色） */}
  <button
    type="submit"
    style={{
      padding: "0.6rem 1rem",
      backgroundColor: "#f0616d",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "0.9rem",
      transition: "background-color 0.2s ease",
    }}
    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#e45763")}
    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#f0616d")}
  >
    送信
  </button>
</form>

        </main>
      </div>
    </div>
  );
}
