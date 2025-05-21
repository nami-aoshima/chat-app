import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ProfileSetup() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [profileMessage, setProfileMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const savedUserId = localStorage.getItem('user_id');
    if (!savedUserId) {
      setError('ユーザーIDが見つかりません。ログインし直してください。');
    } else {
      setUserId(savedUserId);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    if (imageFile) {
      formData.append('image', imageFile);
    }
    formData.append('message', profileMessage);
    formData.append('user_id', userId);

    try {
      const res = await fetch('http://localhost:8081/api/profile', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error();
      router.push('/chat');
    } catch {
      setError('プロフィールの保存に失敗しました。');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Welcome</h2>
        <p style={styles.subtitle}>プロフィールを設定しましょう</p>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            style={styles.input}
          />
          <textarea
            placeholder="ひとこと自己紹介（任意）"
            value={profileMessage}
            onChange={(e) => setProfileMessage(e.target.value)}
            rows={3}
            style={{ ...styles.input, resize: 'none' }}
          />
          <button type="submit" style={styles.button}>
            保存してチャットへ
          </button>
        </form>

        <p style={styles.footer}>
          今は設定しない？{' '}
          <button style={styles.link} onClick={() => router.push('/chat')}>
            スキップ
          </button>
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
    color: '#2d3142',
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
