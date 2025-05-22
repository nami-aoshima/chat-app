// components/CreateGroupForm.tsx
import { useEffect, useState } from "react";

export default function CreateGroupForm({ onCreate }: { onCreate: (selectedIds: number[], groupName: string) => void }) {
  const [users, setUsers] = useState<{ id: number; username: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");

  // ユーザー一覧を取得
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("http://localhost:8081/users", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setUsers)
      .catch(console.error);
  }, []);

  const handleCheckboxChange = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length < 2 || !groupName.trim()) {
      alert("3人以上のメンバーとグループ名が必要です");
      return;
    }
    onCreate(selectedIds, groupName);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem" }}>
      <h2>グループ作成</h2>
      <input
        type="text"
        placeholder="グループ名"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        required
      />
      <div>
        <p>メンバーを選択（2人以上）:</p>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {users.map((user) => (
            <li key={user.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(user.id)}
                  onChange={() => handleCheckboxChange(user.id)}
                />
                {user.username}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <button type="submit" style={{ padding: "0.5rem 1rem", backgroundColor: "#f0616d", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
        作成する
      </button>
    </form>
  );
}
