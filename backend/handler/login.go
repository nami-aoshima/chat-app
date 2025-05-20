package handler

import (
	"encoding/json"
	"fmt" // ログ出力に使う
	"net/http"
	"strconv"
	"time"

	"github.com/dgrijalva/jwt-go" // JWTトークン発行ライブラリ
	"golang.org/x/crypto/bcrypt"  // パスワード照合（ハッシュ比較）ライブラリ
)

// クライアントから受け取るログイン情報（JSON形式）
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// クライアントに返すレスポンス情報（トークンとユーザーID）
type LoginResponse struct {
	Token  string `json:"token"`
	UserID int    `json:"user_id"`
}

// ログイン処理を行うHTTPハンドラー（POST /login）
func LoginHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("✅ LoginHandler triggered") // デバッグログ（ログイン処理が呼ばれたか確認）

	// JSONリクエストを構造体にデコード
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// DBから該当ユーザーのidとパスワードハッシュを取得
	var userID int
	var storedPassword string
	query := `SELECT id, password_hash FROM users WHERE username = $1`
	err := db.QueryRow(query, req.Username).Scan(&userID, &storedPassword)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// 入力されたパスワードとDBのハッシュを比較
	err = bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(req.Password))
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// トークンの有効期限を24時間に設定
	expirationTime := time.Now().Add(24 * time.Hour)

	// トークンに含める情報（claims）を作成
	claims := &jwt.StandardClaims{
		ExpiresAt: expirationTime.Unix(), // 有効期限（UNIXタイム）
		Subject:   strconv.Itoa(userID),  // ユーザーIDを文字列で格納
	}

	// トークンを生成（署名付き）
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtKey) // jwtKey は事前に定義された秘密鍵
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// トークンとユーザーIDをクライアントに返す
	response := LoginResponse{
		Token:  tokenString,
		UserID: userID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
