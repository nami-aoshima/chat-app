import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useAuthGuard } from "../../utils/authGuard";

import EmojiPicker from "emoji-picker-react";

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
  edited?: boolean;
  is_deleted?: boolean;       // 送信取消（物理削除の通知用）
  is_hidden_for?: number[];   // 各ユーザー向け非表示（論理削除）
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

  const [mentionRooms, setMentionRooms] = useState<number[]>([]);

  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const socketMapRef = useRef<Map<number, WebSocket>>(new Map());
  const roomIdRef = useRef<string | undefined>(undefined);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

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
        console.log("📥 WebSocket受信:", data);
if (data.type === "edit_message") {
    const edited = data.message as Message;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === edited.id
          ? { ...m, content: edited.content, edited: true }
          : m
      )
    );
    return;
  }

  if (data.type === "delete_message") {
  const deletedId = data.message_id;
  setMessages((prev) =>
    prev.map((m) =>
      m.id === deletedId ? { ...m, is_deleted: true } : m
    )
  );
  return;
}


if (data.type === "hide_message") {
  const { message_id, user_id } = data;
  setMessages((prev) =>
    prev.map((m) =>
      m.id === message_id
        ? { ...m, is_hidden_for: [...(m.is_hidden_for || []), user_id] }
        : m
    )
  );
  return;
}



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
        else if (data.type === "mention") {
          console.log("📣 メンション通知:", data);
  const { room_id, user_id } = data;

  // 自分へのメンションだけ追加（他人宛のはスルー）
  if (user_id === userId) {
    setMentionRooms((prev) =>
      prev.includes(room_id) ? prev : [...prev, room_id]
    );
  }
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

  useEffect(() => {
  if (!room_id || typeof room_id !== "string") return;

  // 現在表示中のroom_idを数値に変換
  const currentId = parseInt(room_id);

  // mentionRoomsに含まれていれば除外（通知を消す）
  setMentionRooms((prev) => prev.filter((id) => id !== currentId));
}, [room_id]);

  

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

  useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(event.target as Node)
    ) {
      setOpenMenuId(null);
    }
  };

  if (openMenuId !== null) {
    document.addEventListener("mousedown", handleClickOutside);
  }

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [openMenuId]);

  

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



const toggleMenu = (id: number) => {
  setOpenMenuId(prev => (prev === id ? null : id));
};

const handleEdit = async (msg: Message) => {
  const newContent = prompt("新しいメッセージ内容を入力", msg.content);
  if (!newContent || newContent === msg.content) return;

  try {
    await fetch(`http://localhost:8081/messages/${msg.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: newContent }),
    });

    setMessages(prev =>
      prev.map(m => m.id === msg.id ? { ...m, content: newContent, edited: true } : m)
    );
    setOpenMenuId(null);
  } catch {
    alert("編集に失敗しました");
  }
};

const handleDelete = async (id: number) => {
  if (!confirm("このメッセージを削除しますか？")) return;

  try {
    await fetch(`http://localhost:8081/messages/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setMessages(prev =>
      prev.map(m => m.id === id ? { ...m, is_deleted: true } : m)
    );
    setOpenMenuId(null);
  } catch {
    alert("削除に失敗しました");
  }
};
// 自分だけ削除
const handleHideForMe = async (id: number) => {
  try {
    await fetch(`http://localhost:8081/messages/${id}/hide`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });

    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, is_hidden_for: [...(m.is_hidden_for || []), userId] }
          : m
      )
    );
    setOpenMenuId(null);
  } catch {
    alert("削除に失敗しました");
  }
};

// 送信取消
const handleRecall = async (id: number) => {
  try {
    await fetch(`http://localhost:8081/messages/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_deleted: true } : m))
    );
    setOpenMenuId(null);
  } catch {
    alert("送信取消に失敗しました");
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
  <div style={{ display: "flex", flexDirection: "column" }}>
    <span>{room.display_name}</span>
    {mentionRooms.includes(room.room_id) && (
      <span style={{
        fontSize: "0.75rem",
        color: "#e45763",
        fontWeight: "bold",
        marginTop: "2px"
      }}>
        メンションされました
      </span>
    )}
  </div>

  {room.unread_count > 0 && (
    <span style={{
      backgroundColor: "#f0616d",
      color: "#fff",
      fontSize: "0.75rem",
      borderRadius: "12px",
      border: "2px solid white",
      padding: "0.2rem 0.6rem",
      marginLeft: "0.5rem",
      boxShadow: "0 0 4px rgba(0,0,0,0.1)",
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

  {error && (
    <p style={{ color: "red", textAlign: "center", marginBottom: "1rem" }}>{error}</p>
  )}

  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem 0.5rem", borderRadius: "10px", marginBottom: "1.5rem" }}>
    {messages.map((msg, index) => {
      const currentDate = new Date(msg.created_at);
      const previousDate = index > 0 ? new Date(messages[index - 1].created_at) : null;
      const showDateSeparator = !previousDate || currentDate.toDateString() !== previousDate.toDateString();
      const isImage = msg.content.match(/\.(jpg|jpeg|png|gif)$/i) || msg.content.startsWith("/uploads/");
      const readers = (msg.read_by ?? []).filter(id => id !== userId);
      const isMine = msg.sender_id === userId;
      // 自分に非表示のメッセージはスキップ


// 自分に非表示のメッセージ or 自分による削除 → 完全に非表示
if (msg.is_hidden_for?.includes(userId)) return null;




      return (
        <div key={`msg-${msg.id}`} style={{ marginBottom: "1.2rem" }}>
          {showDateSeparator && (
            <div style={{
    display: "flex",
    alignItems: "center",
    textAlign: "center",
    color: "#888",
    fontSize: "0.85rem",
    margin: "1rem 0",
  }}>
    <hr style={{ flex: 1, border: "none", borderTop: "1px solid #ccc" }} />
    <span style={{ padding: "0 0.75rem", fontWeight: "bold" }}>
      {currentDate.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" })}
    </span>
    <hr style={{ flex: 1, border: "none", borderTop: "1px solid #ccc" }} />
  </div>
)}  

<div
  style={{
    display: "flex",
    justifyContent: isMine ? "flex-end" : "flex-start",
    alignItems: "flex-end",
    gap: isMine ? "6px" : "0",  // 自分のメッセージだけ横並び用の隙間
  }}
>
  {/* 左下に表示（自分のメッセージのみ） */}
  {isMine && !msg.is_deleted && (
    <div style={{
      fontSize: "0.7rem",
      color: "#6b7280",
      lineHeight: "1.2",
      textAlign: "right",
      marginBottom: "2px"
    }}>
      {readers.length > 0 && (
        <div style={{ fontWeight: 500 }}>
          {readers.length === 1 ? "既読" : `既読${readers.length}`}
        </div>
      )}
      <div>
        {currentDate.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        })}
      </div>
    </div>
  )}

  {/* 吹き出し or 削除表示 */}
  {msg.is_deleted ? (
    <div style={{
      fontStyle: "italic",
      color: "#6b7280",
      fontSize: "0.9rem",
      textAlign: "center",
      margin: "0 auto"
    }}>
      メッセージの送信を取り消しました
    </div>
  ) : isImage ? (
    <img
      src={`http://localhost:8081${msg.content}`}
      alt="画像"
      style={{
        maxWidth: "300px",
        maxHeight: "200px",
        borderRadius: "12px",
        objectFit: "cover",
        display: "block"
      }}
    />
  ) : (
    <div style={{
      maxWidth: "70%",
      padding: "0.75rem 1rem",
      fontSize: "1rem",
      lineHeight: "1.4",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      backgroundColor: isMine ? "#f0616d" : "#e6e9f0",
      color: isMine ? "#fff" : "#2d3142",
      borderTopLeftRadius: "16px",
      borderTopRightRadius: "16px",
      borderBottomLeftRadius: isMine ? "16px" : "4px",
      borderBottomRightRadius: isMine ? "4px" : "16px",
      position: "relative"
    }}>
      {msg.content}

      {/* 編集済表示 */}
      {msg.edited && (
        <div style={{
          fontSize: "0.7rem",
          color: isMine ? "#ffecec" : "#888",
          marginTop: "0.25rem",
          textAlign: isMine ? "right" : "left",
        }}>
          編集済
        </div>
      )}
    </div>
  )}

  {/* 編集・削除メニュー */}
 {isMine && !msg.is_deleted && (
  <div style={{ position: "relative", marginLeft: "4px" }}>
    <div
      onClick={() => toggleMenu(msg.id)}
      style={{
        cursor: "pointer",
        color: "#6b7280",
        fontSize: "18px",
        padding: "0.2rem"
      }}
    >
      ⋮
    </div>

    {openMenuId === msg.id && (
  <div ref={menuRef} style={{
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: "4px",
    backgroundColor: "#fff",
    border: "1px solid #ccc",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    minWidth: "160px",
    zIndex: 100
  }}>
    <button
      onClick={() => handleEdit(msg)}
      style={{
        padding: "0.6rem 1rem",
        fontSize: "0.9rem",
        background: "none",
        border: "none",
        width: "100%",
        textAlign: "left",
        cursor: "pointer"
      }}
    >
      編集
    </button>
    <hr style={{ margin: "0.25rem 0", borderColor: "#eee" }} />
    <button
      onClick={() => handleHideForMe(msg.id)}
      style={{
        padding: "0.6rem 1rem",
        fontSize: "0.9rem",
        background: "none",
        border: "none",
        width: "100%",
        textAlign: "left",
        cursor: "pointer"
      }}
    >
      削除（自分だけ）
    </button>
    <hr style={{ margin: "0.25rem 0", borderColor: "#eee" }} />
    <button
      onClick={() => handleRecall(msg.id)}
      style={{
        padding: "0.6rem 1rem",
        fontSize: "0.9rem",
        background: "none",
        border: "none",
        width: "100%",
        textAlign: "left",
        cursor: "pointer"
      }}
    >
      送信取り消し
    </button>
  </div>
)}

  </div>
)}

</div>


          
          

        </div>
      );
    })}
    <div ref={messageEndRef} />
  </div>

      {/* 入力フォーム */}
<form onSubmit={handleSend} style={{
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  marginTop: "auto",
  position: "relative"
}}>
  {/* 絵文字 & アップロードボタン（上段） */}
  <div style={{
    display: "flex",
    gap: "1rem",
    alignItems: "center",
    paddingLeft: "0.5rem"
  }}>
    {/* 😊 ボタン */}
    <button
      type="button"
      onClick={() => setShowEmojiPicker((prev) => !prev)}
      style={{
        background: "none",
        border: "none",
        fontSize: "1.3rem",
        cursor: "pointer"
      }}
    >
      😊
    </button>

    {/* 📎 アップロードボタン */}
    <label htmlFor="file-upload" style={{
      cursor: "pointer",
      fontSize: "1.3rem"
    }}>
      📎
    </label>
    <input
      id="file-upload"
      type="file"
      accept="image/*"
      onChange={handleImageUpload}
      style={{ display: "none" }}
    />
  </div>

  {/* ピッカーの表示位置 */}
  {showEmojiPicker && (
    <div style={{
      position: "absolute",
      bottom: "4.5rem",
      left: "1rem",
      zIndex: 1000,
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
    }}>
      <EmojiPicker
        onEmojiClick={(emojiData) => {
          setInput((prev) => prev + emojiData.emoji);
          setShowEmojiPicker(false);
        }}
        autoFocusSearch={false}
      />
    </div>
  )}

  {/* 入力欄 + 送信（下段） */}
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: "0.5rem"
  }}>
    <input
      type="text"
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="メッセージを入力"
      style={{
        flex: 1,
        padding: "0.75rem",
        borderRadius: "12px",
        border: "1px solid #ccc",
        fontSize: "1rem"
      }}
    />
    <button type="submit" style={{
      padding: "0.6rem 1rem",
      backgroundColor: "#f0616d",
      color: "white",
      border: "none",
      borderRadius: "8px",
      fontWeight: "bold",
      fontSize: "0.9rem",
      cursor: "pointer"
    }}>
      送信
    </button>
  </div>
</form>



    </main>
  </div>
  </div>
)}
