# macOS移植ガイド

## 必要な修正点

### 1. システムコール番号の変更
Linux と macOS ではシステムコール番号が異なります。

**Linux (現在の実装)**:
```asm
mov rax, 41     ; sys_socket
mov rax, 49     ; sys_bind  
mov rax, 50     ; sys_listen
mov rax, 43     ; sys_accept
```

**macOS (必要な修正)**:
```asm
mov rax, 0x2000061  ; SYS_socket (macOS)
mov rax, 0x2000068  ; SYS_bind (macOS)
mov rax, 0x200006a  ; SYS_listen (macOS)
mov rax, 0x200001e  ; SYS_accept (macOS)
```

### 2. 呼び出し規約の違い
macOSでは異なるABIを使用します。

### 3. ライブラリパスの変更
**Makefile修正が必要**:
```makefile
# macOS用のライブラリパス
LDFLAGS = -L/usr/local/lib -lssl -lcrypto -lpthread
```

### 4. アセンブラの変更
macOSではNASMの代わりにyasmまたはgas（GNU Assembler）を使用することが推奨されます。

## 推奨される移植方法

### オプション1: Docker使用（推奨）
```bash
# Linuxコンテナ内で実行
docker run -it --rm -p 3003:3003 -v $(pwd):/app ubuntu:22.04
# コンテナ内でビルド・実行
```

### オプション2: 仮想マシン使用
- VMware Fusion または Parallels Desktop
- Ubuntu 22.04 LTS をインストール
- 現在のコードをそのまま使用可能

### オプション3: macOS完全移植
以下のファイルを修正する必要があります：
- `src/socket.asm` - システムコール番号
- `src/main.asm` - システムコール番号  
- `Makefile` - コンパイラフラグとライブラリパス
- 全てのアセンブリファイル - macOS ABI対応

## 実用性の評価

### 本番環境での使用について

**現在の状態**: 🔶 プロトタイプレベル
- 基本機能は実装済み
- HTTPレスポンス処理に問題あり
- 本番運用には追加開発が必要

**本番投入までに必要な作業**:
1. HTTPレスポンス処理の完全修正
2. エラーハンドリングの強化
3. ログシステムの実装
4. 負荷テストとパフォーマンス調整
5. セキュリティ監査
6. 監視・アラート機能の追加

**推定開発期間**: 2-3週間の追加開発

### 代替案の提案

**短期的解決策**:
1. 現在のNode.jsサーバーの最適化
2. nginxリバースプロキシの導入
3. Node.jsクラスタリングの活用

**中長期的解決策**:
1. Go言語での書き直し（パフォーマンス向上 + 開発効率）
2. Rust言語での実装（メモリ安全性 + パフォーマンス）
3. アセンブリ実装の完成（最高パフォーマンス）

## 結論

現在のアセンブリ実装は技術的に非常に興味深く、パフォーマンス面で大きな利点がありますが、本番環境での即座の使用には追加開発が必要です。

macOSでのテストには Docker または仮想マシンの使用を強く推奨します。
