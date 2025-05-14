# ベースイメージ
FROM node:22

# 作業ディレクトリ
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm install

# その他全ファイルをコピー
COPY . .

# 開発用ポートを公開
EXPOSE 3000

# 開発サーバー起動
CMD ["npm", "run", "dev"]
