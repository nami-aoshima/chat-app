package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
)

func UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// ==== user_id を取得 ====
	userIDStr := r.FormValue("user_id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	fmt.Println("📦 user_id:", userID)

	// ==== 現在のプロフィール情報を取得 ====
	var currentImageURL, currentMessage string
	err = db.QueryRow(`SELECT profile_image_url, profile_message FROM users WHERE id = $1`, userID).Scan(&currentImageURL, &currentMessage)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// ==== ファイル処理 ====
	file, handler, err := r.FormFile("image")
	imagePath := currentImageURL

	if err == nil {
		defer file.Close()

		imageDir := "public/images"
		if err := os.MkdirAll(imageDir, os.ModePerm); err != nil {
			http.Error(w, "Failed to create image directory", http.StatusInternalServerError)
			return
		}

		savePath := filepath.Join(imageDir, handler.Filename)
		dst, err := os.Create(savePath)
		if err != nil {
			http.Error(w, "Failed to create image file", http.StatusInternalServerError)
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			http.Error(w, "Failed to write image file", http.StatusInternalServerError)
			return
		}

		imagePath = "/images/" + handler.Filename
		fmt.Println("✅ 画像保存成功:", imagePath)
	} else {
		fmt.Println("📎 画像未選択または取得失敗:", err)
	}

	// ==== メッセージ取得 ====
	message := r.FormValue("message")
	if message == "" {
		message = currentMessage
		fmt.Println("📎 メッセージ未入力。現状のメッセージを保持")
	} else {
		fmt.Println("💬 メッセージ受信:", message)
	}

	// ==== DB 更新 ====
	query := `UPDATE users SET profile_image_url = $1, profile_message = $2 WHERE id = $3`
	res, err := db.Exec(query, imagePath, message, userID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to update profile: %s", err), http.StatusInternalServerError)
		return
	}

	rows, _ := res.RowsAffected()
	fmt.Printf("✅ DB更新完了: %d 行更新\n", rows)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Profile updated successfully"))
}
