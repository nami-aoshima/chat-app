package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// POST /upload
func UploadImageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	// multipart/form-data をパース
	err := r.ParseMultipartForm(10 << 20) // 10MB上限
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// フォームから画像ファイルを取得
	file, handler, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "Image file not found", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 保存先ディレクトリ
	imageDir := "public/uploads"
	if err := os.MkdirAll(imageDir, os.ModePerm); err != nil {
		http.Error(w, "Failed to create directory", http.StatusInternalServerError)
		return
	}

	// 保存ファイル名（同名対策に時間やUUIDを付けるとより安全）
	savePath := filepath.Join(imageDir, handler.Filename)
	dst, err := os.Create(savePath)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// ファイル保存
	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to write file", http.StatusInternalServerError)
		return
	}

	// URLパスとして返却
	imageURL := "/uploads/" + handler.Filename
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"url": "%s"}`, imageURL)
}
