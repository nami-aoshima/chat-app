import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuthGuard } from "../../utils/authGuard";


type Message = {
  id: number;
  room_id: number;
  sender_id: number;
  content: string;
  created_at: string;
};

export default function ChatRoomPage() {
  useAuthGuard(); // 🔐 認証ガード！

  const router = useRouter();
  const { room_id } = router.query;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const userId = typeof window !== "undefined" ? parseInt(localStorage.getItem("user_id") || "0") : 0;

  // メッセージ取得
  useEffect(() => {
    if (!token || !room_id) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`http://localhost:8081/messages?room_id=${room_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        setError("メッセージの取得に失敗しました");
      }
    };

    fetchMessages();
  }, [room_id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

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
          content: input,
        }),
      });

      const newMsg = await res.json();
      setMessages((prev) => [...prev, newMsg]);
      setInput("");
    } catch (err) {
      setError("送信に失敗しました");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>チャットルーム #{room_id}</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ marginBottom: "1rem" }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            <strong>{msg.sender_id === userId ? "あなた" : `ユーザー${msg.sender_id}`}</strong>: {msg.content}
            <br />
            <small>{new Date(msg.created_at).toLocaleString()}</small>
            <hr />
          </div>
        ))}
      </div>

      <form onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力..."
          style={{ width: "70%", marginRight: "10px" }}
        />
        <button type="submit">送信</button>
      </form>
    </div>
  );
}
