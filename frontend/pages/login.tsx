import { useState } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('http://localhost:8081/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_id', data.user_id);

      router.push('/chat');
    } catch (err) {
      console.error(err);
      setError('ログインできませんでした。ユーザー名かパスワードを確認してください');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Welcome Back</h2>
        <p style={styles.subtitle}>ログインしてチャットをはじめよう</p>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            type="text"
            placeholder="ユーザー名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
          <button type="submit" style={styles.button}>ログイン</button>
        </form>

        <p style={styles.footer}>
          アカウントをお持ちでないですか？{" "}
          <button style={styles.link} onClick={() => router.push('/signup')}>サインアップ</button>
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
    color: '#4a4e69',
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
    color: '#2d3142',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: 0,
  },
};
