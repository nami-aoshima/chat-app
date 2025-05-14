// /pages/signup.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  // フォーム送信時の処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 入力バリデーション
    if (!username || !email || !password) {
      setError("すべてのフィールドを入力してください");
      return;
    }

    try {
      const res = await fetch("http://localhost:8081/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });

      if (!res.ok) {
        throw new Error("サインアップに失敗しました");
      }

      // サインアップ成功したらログイン画面へ遷移
      router.push("/login");
    } catch (error) {
      setError("サインアップに失敗しました。もう一度お試しください。");
    }
  };

  return (
    <div className="signup-container">
      <h2>サインアップ</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>ユーザー名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button type="submit">サインアップ</button>
      </form>
    </div>
  );
}
