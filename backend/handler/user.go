package handler

import (
	"encoding/json"
	"net/http"
)

// GetUsersHandler はすべてのユーザーの id と username を取得して返す API ハンドラー
func GetUsersHandler(w http.ResponseWriter, r *http.Request) {
	// 🔐 ① JWTトークンからユーザーIDを取得（＝認証チェック）
	// トークンが無効 or なしなら 401 を返して処理終了
	_, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// ✅ ② データベースから全ユーザーの id, username を取得
	rows, err := db.Query(`SELECT id, username FROM users`)
	if err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}
	defer rows.Close() // ← 最後に rows をクローズ（リソース解放）

	// 🧹 ③ 結果を受け取るための配列を用意（map型のスライス）
	var users []map[string]interface{}

	// 🌀 ④ 1件ずつ rows から取り出して配列に詰める
	for rows.Next() {
		var id int
		var username string

		// 行から id と username を読み取り（エラーハンドリングも忘れず）
		if err := rows.Scan(&id, &username); err != nil {
			http.Error(w, "Failed to scan user", http.StatusInternalServerError)
			return
		}

		// map型に変換してスライスに追加
		users = append(users, map[string]interface{}{
			"id":       id,
			"username": username,
		})
	}

	// 📤 ⑤ JSONとしてレスポンスを返す
	w.Header().Set("Content-Type", "application/json") // ヘッダーにJSONであることを明示
	json.NewEncoder(w).Encode(users)                   // usersスライスをJSONにして返却
}
