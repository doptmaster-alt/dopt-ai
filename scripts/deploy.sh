#!/bin/bash
# ============================================
# DIOPT AI - 배포 스크립트
# Usage:
#   ./scripts/deploy.sh staging    # 스테이징 배포
#   ./scripts/deploy.sh production # 프로덕션 배포
#   ./scripts/deploy.sh promote    # 스테이징 → 프로덕션 승격
# ============================================

set -e

ENVIRONMENT=${1:-staging}
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "========================================"
echo "  DIOPT AI 배포 - $ENVIRONMENT"
echo "  시간: $(date)"
echo "========================================"

# 함수: 배포 전 체크
pre_check() {
    echo "[1/5] 환경 체크..."

    if [ ! -f "$APP_DIR/.env.$ENVIRONMENT" ]; then
        echo "ERROR: .env.$ENVIRONMENT 파일이 없습니다!"
        echo "  .env.$ENVIRONMENT.example 를 복사하여 설정해주세요."
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        echo "ERROR: Docker가 설치되어 있지 않습니다!"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo "ERROR: Docker 데몬이 실행되지 않고 있습니다!"
        exit 1
    fi

    echo "  ✅ 환경 체크 완료"
}

# 함수: 백업
backup() {
    echo "[2/5] 데이터 백업..."
    BACKUP_DIR="$APP_DIR/backups/$ENVIRONMENT/$TIMESTAMP"
    mkdir -p "$BACKUP_DIR"

    CONTAINER="diopt-$ENVIRONMENT"

    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
        # 볼륨 데이터 백업
        docker cp "$CONTAINER:/app/data" "$BACKUP_DIR/data" 2>/dev/null || true
        docker cp "$CONTAINER:/app/uploads" "$BACKUP_DIR/uploads" 2>/dev/null || true
        docker cp "$CONTAINER:/app/learning" "$BACKUP_DIR/learning" 2>/dev/null || true
        echo "  ✅ 백업 완료: $BACKUP_DIR"
    else
        echo "  ⏭️ 기존 컨테이너 없음, 백업 스킵"
    fi
}

# 함수: 빌드
build() {
    echo "[3/5] Docker 이미지 빌드..."
    cd "$APP_DIR"
    docker compose build --no-cache "diopt-$ENVIRONMENT"
    echo "  ✅ 빌드 완료"
}

# 함수: 배포
deploy() {
    echo "[4/5] 컨테이너 배포..."
    cd "$APP_DIR"

    if [ "$ENVIRONMENT" = "production" ]; then
        docker compose --profile production up -d
    else
        docker compose --profile staging up -d
    fi

    echo "  ✅ 컨테이너 시작됨"
}

# 함수: 헬스체크
health_check() {
    echo "[5/5] 헬스체크..."

    PORT=3100
    if [ "$ENVIRONMENT" = "production" ]; then
        PORT=3000
    fi

    MAX_RETRIES=30
    RETRY=0

    while [ $RETRY -lt $MAX_RETRIES ]; do
        if curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
            echo "  ✅ 서버 정상 동작 확인!"
            curl -s "http://localhost:$PORT/api/health" | python3 -m json.tool 2>/dev/null || true
            echo ""
            echo "========================================"
            echo "  배포 완료!"
            if [ "$ENVIRONMENT" = "staging" ]; then
                echo "  URL: http://localhost:3100"
            else
                echo "  URL: http://localhost:3000"
            fi
            echo "========================================"
            return 0
        fi
        RETRY=$((RETRY + 1))
        echo "  ⏳ 서버 시작 대기... ($RETRY/$MAX_RETRIES)"
        sleep 2
    done

    echo "  ❌ 헬스체크 실패! 로그를 확인하세요:"
    echo "  docker logs diopt-$ENVIRONMENT"
    exit 1
}

# 함수: 스테이징 → 프로덕션 승격
promote() {
    echo "스테이징 → 프로덕션 승격"
    echo ""

    # 스테이징 헬스체크
    if ! curl -sf "http://localhost:3100/api/health" > /dev/null 2>&1; then
        echo "ERROR: 스테이징 서버가 정상 동작하지 않습니다!"
        echo "  먼저 스테이징 배포를 완료해주세요."
        exit 1
    fi

    echo "  ✅ 스테이징 서버 정상 확인"
    echo ""
    read -p "프로덕션으로 승격하시겠습니까? (y/N) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ENVIRONMENT="production"
        pre_check
        backup
        build
        deploy
        health_check
    else
        echo "승격 취소됨"
    fi
}

# 메인 실행
case $ENVIRONMENT in
    staging)
        pre_check
        backup
        build
        deploy
        health_check
        ;;
    production)
        pre_check
        backup
        build
        deploy
        health_check
        ;;
    promote)
        promote
        ;;
    *)
        echo "Usage: $0 {staging|production|promote}"
        exit 1
        ;;
esac
