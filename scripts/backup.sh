#!/bin/bash
# ============================================
# DIOPT AI - 자동 백업 스크립트
# crontab: 0 3 * * * /path/to/diopt-ai/scripts/backup.sh
# ============================================

set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$APP_DIR/backups/daily/$TIMESTAMP"
KEEP_DAYS=30

echo "=== DIOPT AI 백업 시작 ==="
echo "시간: $(date)"

mkdir -p "$BACKUP_DIR"

# Production 데이터 백업
if docker ps --format '{{.Names}}' | grep -q "diopt-production"; then
    docker cp diopt-production:/app/data "$BACKUP_DIR/data" 2>/dev/null || true
    docker cp diopt-production:/app/uploads "$BACKUP_DIR/uploads" 2>/dev/null || true
    docker cp diopt-production:/app/learning "$BACKUP_DIR/learning" 2>/dev/null || true
    echo "✅ 프로덕션 데이터 백업 완료"
elif [ -d "$APP_DIR/data" ]; then
    cp -r "$APP_DIR/data" "$BACKUP_DIR/data"
    cp -r "$APP_DIR/uploads" "$BACKUP_DIR/uploads" 2>/dev/null || true
    cp -r "$APP_DIR/learning" "$BACKUP_DIR/learning" 2>/dev/null || true
    echo "✅ 로컬 데이터 백업 완료"
fi

# 압축
cd "$APP_DIR/backups/daily"
tar -czf "$TIMESTAMP.tar.gz" "$TIMESTAMP" && rm -rf "$TIMESTAMP"
echo "✅ 압축 완료: $TIMESTAMP.tar.gz"

# 오래된 백업 삭제
find "$APP_DIR/backups/daily" -name "*.tar.gz" -mtime +$KEEP_DAYS -delete
echo "✅ ${KEEP_DAYS}일 이상 오래된 백업 정리 완료"

echo "=== 백업 완료 ==="
