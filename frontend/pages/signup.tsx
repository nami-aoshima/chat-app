import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !email || !password) {
      setError("すべてのフィールドを入力してください");
      return;
    }

    try {
      const res = await fetch("http://localhost:8081/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) throw new Error();

      router.push("/login");
    } catch {
      setError("サインアップに失敗しました。もう一度お試しください。");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Welcome</h2>
        <p style={styles.subtitle}>新しいアカウントを作成</p>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="ユーザー名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
          />
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.button}>サインアップ</button>
        </form>

        <p style={styles.footer}>
          すでにアカウントをお持ちですか？{" "}
          <button style={styles.link} onClick={() => router.push('/login')}>ログイン</button>
        </p>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: '#fff5f4',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2rem',
  },
  card: {
    background: '#ffffff',
    padding: '2rem',
    borderRadius: '20px',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 6px 18px rgba(0,0,0,0.05)',
    textAlign: 'center',
  },
  title: {
    fontSize: '1.8rem',
    color: '#2d3142', // ネイビー
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#4a4e69', // グレー寄りネイビー
    marginBottom: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  input: {
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    borderRadius: '10px',
    border: '1px solid #ffbcbc',
    fontSize: '1rem',
    backgroundColor: '#fff',
  },
  button: {
    padding: '0.75rem',
    backgroundColor: '#f0616d',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  error: {
    color: 'red',
    fontSize: '0.9rem',
    marginBottom: '1rem',
  },
  footer: {
    marginTop: '1.5rem',
    fontSize: '0.9rem',
    color: '#4a4e69',
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#2d3142', // ネイビー
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: 0,
  },
};
