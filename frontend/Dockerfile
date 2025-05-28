# ベースイメージ
FROM node:22

# 作業ディレクトリ
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# emoji-picker-react を含む依存関係のインストール
RUN npm install

# アプリの全コードをコピー
COPY . .

# 開発用ポートを公開
EXPOSE 3000

# Next.js の開発サーバーを起動
CMD ["npm", "run", "dev"]
