package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	_ "github.com/lib/pq"        // PostgreSQL ドライバ（接続のために必要）
	"golang.org/x/crypto/bcrypt" // パスワードを安全に保存するためのハッシュ化ライブラリ
)

// DB接続用のグローバル変数（どの関数からも使えるようにする）
var db *sql.DB

// User構造体：JSONのリクエストから受け取るユーザー情報を表す
type User struct {
	Username     string `json:"username"`
	Email        string `json:"email"`
	Password     string `json:"password"`
	ProfileImage string `json:"profile_image"`
	ProfileMsg   string `json:"profile_message"`
}

// DBを初期化する関数（アプリ起動時に一度だけ呼ばれる）
func InitDB() {

	var err error

	// 環境変数から接続情報を読み取って接続文字列を作成
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"))

	// データベースへ接続（driver名: postgres）
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to the database:", err)
	}

	// 接続確認（pingが成功すればOK）
	if err = db.Ping(); err != nil {
		log.Fatal("Failed to ping the database:", err)
	}

	fmt.Println("Successfully connected to the database")
}

// サインアップAPIハンドラー（POST /signup）
func SignupHandler(w http.ResponseWriter, r *http.Request) {
	var user User

	// リクエストボディ（JSON）を user 構造体にデコード
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// パスワードをハッシュ化（セキュリティ対策）
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	// ユーザー情報をDBに保存するクエリ
	query := `INSERT INTO users (username, email, password_hash, profile_image_url, profile_message) 
              VALUES ($1, $2, $3, $4, $5) RETURNING id`

	var userID int

	// INSERT 実行 → 成功すれば自動でidが返る
	err = db.QueryRow(query, user.Username, user.Email, hashedPassword, user.ProfileImage, user.ProfileMsg).Scan(&userID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error creating user: %s", err), http.StatusInternalServerError)
		return
	}

	// 成功レスポンス（JSON形式で返す）
	response := map[string]interface{}{
		"id":       userID,
		"username": user.Username,
		"email":    user.Email,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// ユーザー削除API（GET /delete?id=○）
func DeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id") // クエリパラメータから id を取得

	if id == "" {
		http.Error(w, "Missing user ID", http.StatusBadRequest)
		return
	}

	// 指定したIDのユーザーを削除
	query := `DELETE FROM users WHERE id = $1`
	res, err := db.Exec(query, id)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error deleting user: %s", err), http.StatusInternalServerError)
		return
	}

	// 削除件数が0なら存在しなかった
	rows, _ := res.RowsAffected()
	if rows == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// 削除成功
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("User deleted successfully"))
}
